import { HttpError, requireRole } from "./domain.mjs";
const limited = (v, min, max, label) => {
  if (typeof v !== "string" || v.trim().length < min || v.length > max)
    throw new HttpError(400, `Invalid ${label}`);
  return v.trim();
};
export function createCommunity({
  db,
  course,
  save,
  userKey,
  enrollmentKey,
  need,
  now,
  uuid,
}) {
  return async ({ method, path, body, claims }) => {
    const sub = claims?.sub,
      p = path.split("/").filter(Boolean);
    if (!sub) throw new HttpError(401, "Sign in required");
    const admin = (claims["cognito:groups"] || []).includes("MadarAdmins");
    if (path === "/instructor/insights" && method === "GET") {
      const profile = await db.get(userKey(sub, "PROFILE"));
      requireRole(profile, claims, "instructor");
      const courses = (await db.query("COURSE")).filter(
          (c) => c.ownerSub === sub,
        ),
        ids = new Set(courses.map((c) => c.id)),
        requests = (await db.query("PAYMENT")).filter((p) =>
          ids.has(p.courseId),
        ),
        reviews = (await db.query("REVIEW")).filter(
          (r) => ids.has(r.courseId) && r.status === "approved",
        ),
        questions = (await db.query("QUESTION")).filter(
          (q) => ids.has(q.courseId) && q.status === "visible",
        );
      return {
        courseCount: courses.length,
        awaitingReview: courses.filter((c) => c.status === "pending-review")
          .length,
        published: courses.filter((c) => c.status === "published").length,
        drafts: courses.filter((c) => c.status === "draft").length,
        approvedRequests: requests.filter((p) => p.status === "approved")
          .length,
        testApprovedAmountCents: requests
          .filter((p) => p.status === "approved" && p.mode === "test")
          .reduce((sum, p) => sum + p.amountCents, 0),
        manualApprovedAmountCents: requests
          .filter((p) => p.status === "approved" && p.mode !== "test")
          .reduce((sum, p) => sum + p.amountCents, 0),
        approvedReviewCount: reviews.length,
        averageRating: reviews.length
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : null,
        unansweredQuestions: questions.filter((q) => !q.reply).length,
        currency: "EGP",
        notice:
          "Amounts are approved request snapshots, not verified revenue, settlement or payouts. Free enrollments are not counted here.",
      };
    }
    if (path === "/admin/questions" && method === "GET") {
      requireRole(null, claims, "admin");
      return db.query("QUESTION");
    }
    if (p[0] === "admin" && p[1] === "questions" && p[2] && method === "POST") {
      requireRole(null, claims, "admin");
      if (!["visible", "hidden"].includes(body.status))
        throw new HttpError(400, "Choose visible or hidden");
      const old = await need({ PK: "QUESTION", SK: p[2] });
      await save(
        { ...old, status: body.status, moderatedAt: now(), moderatedBy: sub },
        old,
      );
      return { status: body.status };
    }
    if (p[0] !== "courses" || !p[1] || !["notes", "questions"].includes(p[2]))
      return undefined;
    const c = await course(p[1]),
      en = await db.get(enrollmentKey(sub, c.id)),
      owner = c.ownerSub === sub;
    if (p[2] === "notes") {
      if (!en) throw new HttpError(403, "Course access is locked");
      const lessonId = p[3];
      if (!c.lessons.some((l) => l.id === lessonId))
        throw new HttpError(400, "Unknown lesson");
      const k = userKey(sub, "NOTE#" + c.id + "#" + lessonId),
        old = await db.get(k);
      if (method === "GET")
        return {
          lessonId,
          text: old?.text || "",
          updatedAt: old?.updatedAt || null,
        };
      if (method === "PUT") {
        if (typeof body.text !== "string" || body.text.length > 8000)
          throw new HttpError(
            400,
            "Note must be text, maximum 8000 characters",
          );
        await save(
          { ...k, courseId: c.id, lessonId, text: body.text, updatedAt: now() },
          old,
        );
        return { lessonId, text: body.text };
      }
    }
    if (p[2] === "questions") {
      if (!en && !owner && !admin)
        throw new HttpError(403, "Enroll to access the course discussion");
      if (method === "GET" && p.length === 3)
        return (await db.query("QUESTION", c.id + "#"))
          .filter(
            (q) =>
              q.status === "visible" || q.userSub === sub || owner || admin,
          )
          .map((q) => ({
            id: q.id,
            courseId: c.id,
            title: q.title,
            text: q.text,
            displayName: q.displayName,
            createdAt: q.createdAt,
            status: q.status,
            reply: q.reply || null,
            replyAt: q.replyAt || null,
            canReply: owner,
            own: q.userSub === sub,
          }));
      if (method === "POST" && p.length === 3) {
        if (!en)
          throw new HttpError(403, "Only enrolled learners may ask questions");
        const id = c.id + "#" + uuid(),
          q = {
            PK: "QUESTION",
            SK: id,
            id,
            courseId: c.id,
            courseTitle: c.title,
            userSub: sub,
            title: limited(body.title, 5, 180, "question title"),
            text: limited(body.text, 10, 4000, "question text"),
            displayName: limited(
              body.displayName,
              2,
              60,
              "public display name",
            ),
            status: "visible",
            createdAt: now(),
          };
        await save(q);
        return { id, status: "visible" };
      }
      if (method === "POST" && p[3] && p[4] === "reply") {
        if (!owner)
          throw new HttpError(403, "Only this course instructor can reply");
        const q = await need({ PK: "QUESTION", SK: p[3] });
        if (q.courseId !== c.id)
          throw new HttpError(403, "Question belongs to another course");
        if (q.status !== "visible")
          throw new HttpError(409, "Hidden discussion cannot receive a reply");
        await save(
          {
            ...q,
            reply: limited(body.text, 5, 4000, "instructor reply"),
            replyAt: now(),
            repliedBy: sub,
          },
          q,
        );
        return { id: q.id, replied: true };
      }
    }
    return undefined;
  };
}
