import { createAiQuiz } from "./ai-quiz.mjs";
import { createModeration } from "./moderation.mjs";
import { createCommunity } from "./community.mjs";
import { createExtras } from "./extras.mjs";
import { randomUUID } from "node:crypto";
import {
  HttpError,
  requireRole,
  requireOwner,
  assertCanEnroll,
  assertReview,
  roleChoice,
  validateCourse,
  publicCourse,
} from "./domain.mjs";
export function createService({
  db,
  files,
  now = () => new Date().toISOString(),
  uuid = randomUUID,
  paymentInstructions = "",
  paymentMode = "disabled",
  ai = null,
}) {
  const effectiveInstructions =
    paymentMode === "test"
      ? "TEST ONLY. Do not transfer money. Submit a synthetic receipt for a simulated review."
      : paymentInstructions;
  const paymentsEnabled =
    ["test", "manual"].includes(paymentMode) && !!effectiveInstructions;
  const key = (PK, SK) => ({ PK, SK });
  const userKey = (sub, SK) => key("USER#" + sub, SK);
  const courseKey = (id) => key("COURSE", id);
  const paymentKey = (id) => key("PAYMENT", id);
  const need = async (k, message = "Not found") => {
    const x = await db.get(k);
    if (!x) throw new HttpError(404, message);
    return x;
  };
  const save = async (item, previous) =>
    db.atomic([
      {
        item: { ...item, version: (previous?.version || 0) + 1 },
        version: previous?.version,
      },
    ]);
  const enrollmentKey = (sub, id) => userKey(sub, "ENROLL#" + id);
  async function course(id, published = true) {
    const c = await need(courseKey(id), "Course not found");
    if (published && c.status !== "published")
      throw new HttpError(404, "Course not found");
    return c;
  }
  async function enrolled(sub, id) {
    if (!(await db.get(enrollmentKey(sub, id))))
      throw new HttpError(403, "Course access is locked");
  }
  const aiQuiz = createAiQuiz({ db, course, userKey, need, now, ai });
  const moderation = createModeration({
    db,
    course,
    save,
    need,
    userKey,
    enrollmentKey,
    files,
    now,
    uuid,
  });
  const community = createCommunity({
    db,
    course,
    save,
    userKey,
    enrollmentKey,
    need,
    now,
    uuid,
  });
  const extras = createExtras({
    db,
    course,
    save,
    userKey,
    enrollmentKey,
    need,
    now,
    uuid,
  });
  return async function dispatch({ method, path, body = {}, claims = null }) {
    const parts = path.split("/").filter(Boolean),
      sub = claims?.sub;
    if (method === "GET" && path === "/courses") {
      const result = await db.query("COURSE");
      return result
        .filter((c) => c.status === "published")
        .map((c) => publicCourse(c));
    }
    if (method === "GET" && parts[0] === "courses" && parts.length === 2)
      return publicCourse(await course(parts[1]), true);
    if (!sub) throw new HttpError(401, "Sign in required");
    const pk = userKey(sub, "PROFILE"),
      profile = await db.get(pk);
    const isAdmin = (claims["cognito:groups"] || []).includes("MadarAdmins");
    if (method === "GET" && path === "/me")
      return {
        sub,
        role: isAdmin ? "admin" : profile?.role || "student",
        needsRole: !profile,
      };
    if (method === "POST" && path === "/me/role") {
      const role = roleChoice(body.role);
      if (profile?.role === "instructor" && role === "student")
        return { role: "instructor" };
      await save({ ...pk, role, updatedAt: now() }, profile);
      return { role };
    }
    if (method === "GET" && path === "/me/enrollments")
      return (await db.query("USER#" + sub, "ENROLL#")).map(
        ({
          courseId,
          completed,
          enrolledAt,
          quizScore,
          quizPassed,
          quizAttempts,
        }) => ({
          courseId,
          completed,
          enrolledAt,
          quizScore,
          quizPassed,
          quizAttempts,
        }),
      );
    if (method === "GET" && path === "/me/payments")
      return (await db.query("PAYMENT"))
        .filter((p) => p.userSub === sub)
        .map(({ receiptVersion, receiptKey, ...p }) => p);
    if (method === "GET" && path === "/payment-method")
      return {
        enabled: paymentsEnabled,
        mode: paymentMode,
        instructions: effectiveInstructions,
        currency: "EGP",
        notice:
          "Manual review only. Uploading a receipt does not confirm a transfer.",
      };
    const aiResult = await aiQuiz({ method, path, body, claims });
    if (aiResult !== undefined) return aiResult;
    const moderationResult = await moderation({ method, path, body, claims });
    if (moderationResult !== undefined) return moderationResult;
    const communityResult = await community({ method, path, body, claims });
    if (communityResult !== undefined) return communityResult;
    const extra = await extras({ method, path, body, claims });
    if (extra !== undefined) return extra;
    if (parts[0] === "instructor") {
      requireRole(profile, claims, "instructor");
      if (method === "GET" && path === "/instructor/courses")
        return (await db.query("COURSE")).filter((c) => c.ownerSub === sub);
      if (method === "POST" && path === "/instructor/courses") {
        const id = uuid(),
          c = {
            ...courseKey(id),
            ...validateCourse(body),
            id,
            ownerSub: sub,
            status: "draft",
            createdAt: now(),
          };
        await save(c);
        return c;
      }
      if (parts[1] === "courses" && parts[2]) {
        const id = parts[2],
          c = await course(id, false);
        requireOwner(c, sub);
        if (method === "PUT" && parts[3] === "details") {
          if (c.status !== "published")
            throw new HttpError(
              409,
              "Only published course details may be edited here",
            );
          const validated = validateCourse({
            ...c,
            title: body.title,
            subtitle: body.subtitle,
            priceCents: body.priceCents,
          });
          const updated = {
            ...c,
            title: validated.title,
            subtitle: validated.subtitle,
            priceCents: validated.priceCents,
            metadataRevision: (c.metadataRevision || 0) + 1,
            updatedAt: now(),
          };
          await save(updated, c);
          return publicCourse(updated, true);
        }
        if (c.status !== "draft")
          throw new HttpError(
            409,
            "This submission is locked. Withdraw a pending course before editing. Published lesson content stays fixed.",
          );
        if (method === "PUT" && parts.length === 3) {
          const updated = { ...c, ...validateCourse(body), updatedAt: now() };
          await save(updated, c);
          return updated;
        }
        if (method === "POST" && parts[3] === "media-upload") {
          if (!["video/mp4", "video/webm"].includes(body.contentType))
            throw new HttpError(400, "Use MP4 or WebM");
          const mediaKey = `courses/${sub}/${id}/${uuid()}`;
          return files.upload(mediaKey, body.contentType, 100 * 1024 * 1024);
        }
        if (method === "POST" && parts[3] === "publish") {
          for (const l of c.lessons)
            if (l.type === "video") {
              if (typeof l.mediaKey !== "string")
                throw new HttpError(
                  400,
                  "Upload every video before publishing",
                );
              if (!l.mediaKey.startsWith(`courses/${sub}/${id}/`))
                throw new HttpError(403, "Invalid lesson media ownership");
              const head = await files.head(l.mediaKey);
              if (
                !["video/mp4", "video/webm"].includes(head.contentType) ||
                head.size > 100 * 1024 * 1024 ||
                !head.version ||
                head.version === "null"
              )
                throw new HttpError(400, "Invalid video");
              l.mediaVersion = head.version;
            }
          await save(
            {
              ...c,
              status: "pending-review",
              contentReviewStatus: "pending",
              submittedAt: now(),
              submissionId: uuid(),
            },
            c,
          );
          return { id, status: "pending-review" };
        }
      }
    }
    if (parts[0] === "courses" && parts[1]) {
      const id = parts[1],
        c = await course(id),
        ek = enrollmentKey(sub, id);
      if (method === "POST" && parts[2] === "enroll") {
        assertCanEnroll(c);
        const existing = await db.get(ek);
        if (existing) return existing;
        const item = { ...ek, courseId: id, completed: [], enrolledAt: now() };
        await save(item);
        return item;
      }
      if (method === "PUT" && parts[2] === "progress") {
        const en = await need(ek, "Enroll first");
        if (!c.lessons.some((l) => l.id === body.lessonId))
          throw new HttpError(400, "Unknown lesson");
        const completed = [
          ...new Set([...(en.completed || []), body.lessonId]),
        ];
        await save({ ...en, completed }, en);
        return { courseId: id, completed };
      }
      if (method === "GET" && parts[2] === "lessons" && parts[4] === "media") {
        await enrolled(sub, id);
        const l = c.lessons.find((l) => l.id === parts[3]);
        if (!l) throw new HttpError(404, "Lesson not found");
        return l.type === "video"
          ? {
              type: "video",
              url: await files.download(l.mediaKey, l.mediaVersion, 120),
            }
          : { type: "text", body: l.body };
      }
      if (method === "POST" && parts[2] === "payments") {
        if (!paymentsEnabled)
          throw new HttpError(
            503,
            "Manual payment is not configured. Do not transfer money.",
          );
        if (c.priceCents === 0) throw new HttpError(400, "Use free enrollment");
        if (await db.get(ek)) throw new HttpError(409, "Already enrolled");
        if (!["image/jpeg", "image/png"].includes(body.contentType))
          throw new HttpError(400, "Use a JPG or PNG receipt");
        const id = uuid(),
          receiptKey = `receipts/${sub}/${id}`,
          item = {
            ...paymentKey(id),
            id,
            userSub: sub,
            courseId: c.id,
            courseTitle: c.title,
            amountCents: c.priceCents,
            currency: "EGP",
            mode: paymentMode,
            status: "awaiting-upload",
            receiptKey,
            createdAt: now(),
          };
        await save(item);
        return {
          id,
          upload: await files.upload(
            receiptKey,
            body.contentType,
            5 * 1024 * 1024,
          ),
        };
      }
    }
    if (parts[0] === "payments" && method === "POST" && parts[2] === "submit") {
      const p = await need(paymentKey(parts[1]));
      if (p.userSub !== sub) throw new HttpError(403, "Not your request");
      if (p.status !== "awaiting-upload")
        throw new HttpError(409, "Already submitted");
      const h = await files.head(p.receiptKey);
      if (
        !["image/jpeg", "image/png"].includes(h.contentType) ||
        h.size > 5 * 1024 * 1024 ||
        !h.version ||
        h.version === "null"
      )
        throw new HttpError(400, "Invalid receipt upload");
      await save(
        {
          ...p,
          status: "pending",
          receiptVersion: h.version,
          submittedAt: now(),
        },
        p,
      );
      return { id: p.id, status: "pending" };
    }
    if (parts[0] === "admin") {
      requireRole(profile, claims, "admin");
      if (method === "GET" && path === "/admin/payments")
        return (await db.query("PAYMENT")).map(
          ({ receiptKey, receiptVersion, ...p }) => p,
        );
      if (parts[1] === "payments" && parts[2]) {
        const p = await need(paymentKey(parts[2]));
        if (method === "GET" && parts[3] === "receipt") {
          if (!p.receiptVersion)
            throw new HttpError(409, "Receipt not submitted");
          return {
            url: await files.download(p.receiptKey, p.receiptVersion, 120),
          };
        }
        if (method === "POST" && parts[3] === "review") {
          assertReview(p, sub);
          if (!["approved", "rejected"].includes(body.decision))
            throw new HttpError(400, "Invalid review decision");
          if (
            typeof body.note !== "string" ||
            body.note.trim().length < 3 ||
            body.note.length > 1000
          )
            throw new HttpError(400, "Add a review note/reference");
          if (
            body.decision === "approved" &&
            (p.mode === "test"
              ? body.verifiedTest !== true
              : body.verifiedTransfer !== true)
          )
            throw new HttpError(
              400,
              p.mode === "test"
                ? "Confirm simulated test verification first"
                : "Confirm independent transfer verification first",
            );
          const updated = {
            ...p,
            status: body.decision,
            reviewedBy: sub,
            reviewedAt: now(),
            reviewNote: body.note.trim(),
            version: p.version + 1,
          };
          const writes = [{ item: updated, version: p.version }];
          if (body.decision === "approved") {
            await course(p.courseId);
            writes.push({
              item: {
                ...enrollmentKey(p.userSub, p.courseId),
                courseId: p.courseId,
                completed: [],
                enrolledAt: now(),
                paymentId: p.id,
                version: 1,
              },
            });
          }
          await db.atomic(writes);
          return { id: p.id, status: updated.status };
        }
      }
    }
    throw new HttpError(404, "Route not found");
  };
}
