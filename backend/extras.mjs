import { HttpError, requireOwner, requireRole } from "./domain.mjs";
import { scoreQuiz, assertCertificate } from "./learning-domain.mjs";
export function createExtras({
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
      parts = path.split("/").filter(Boolean);
    if (!sub) throw new HttpError(401, "Sign in required");
    if (path === "/me/saved") {
      if (method === "GET")
        return (await db.query("USER#" + sub, "SAVED#"))
          .filter((x) => x.saved !== false)
          .map((x) => x.courseId);
      if (method === "POST") {
        const c = await course(body.courseId),
          k = userKey(sub, "SAVED#" + c.id),
          old = await db.get(k);
        await save({ ...k, courseId: c.id, saved: body.saved !== false }, old);
        return { courseId: c.id, saved: body.saved !== false };
      }
    }
    if (path === "/admin/reviews" && method === "GET") {
      requireRole(null, claims, "admin");
      return (await db.query("REVIEW")).filter((r) => r.status === "pending");
    }
    if (
      parts[0] === "admin" &&
      parts[1] === "reviews" &&
      method === "POST" &&
      parts[2]
    ) {
      requireRole(null, claims, "admin");
      if (!["approved", "rejected"].includes(body.decision))
        throw new HttpError(400, "Invalid moderation decision");
      const old = await need({ PK: "REVIEW", SK: parts[2] });
      await save(
        { ...old, status: body.decision, moderatedAt: now(), moderatedBy: sub },
        old,
      );
      return { status: body.decision };
    }
    if (parts[0] !== "courses" || !parts[1]) return undefined;
    const c = await course(parts[1]),
      ek = enrollmentKey(sub, c.id),
      en = await db.get(ek),
      kind = parts[2];
    if (kind === "reviews") {
      if (method === "GET")
        return (await db.query("REVIEW", c.id + "#"))
          .filter((x) => x.status === "approved")
          .map(({ rating, text, displayName, updatedAt }) => ({
            rating,
            text,
            displayName,
            updatedAt,
          }));
      if (method === "PUT") {
        if (!en || !en.completed?.length)
          throw new HttpError(
            403,
            "Complete at least one enrolled lesson before reviewing",
          );
        if (c.ownerSub === sub)
          throw new HttpError(403, "You cannot review your own course");
        if (
          !Number.isInteger(body.rating) ||
          body.rating < 1 ||
          body.rating > 5 ||
          typeof body.text !== "string" ||
          body.text.trim().length < 10 ||
          body.text.length > 2000 ||
          typeof body.displayName !== "string" ||
          body.displayName.trim().length < 2 ||
          body.displayName.length > 60
        )
          throw new HttpError(
            400,
            "Provide 1-5 stars, a 10-2000 character review, and a 2-60 character public display name",
          );
        const k = { PK: "REVIEW", SK: c.id + "#" + sub },
          old = await db.get(k);
        await save(
          {
            ...k,
            id: c.id + "#" + sub,
            courseId: c.id,
            courseTitle: c.title,
            rating: body.rating,
            text: body.text.trim(),
            displayName: body.displayName.trim(),
            status: "pending",
            updatedAt: now(),
          },
          old,
        );
        return { status: "pending" };
      }
    }
    if (kind === "quiz") {
      if (!en) throw new HttpError(403, "Course access is locked");
      if (!c.quiz) throw new HttpError(404, "No quiz for this course");
      if (method === "GET")
        return {
          passPercent: c.quiz.passPercent,
          questions: c.quiz.questions.map(({ correctIndex, ...q }) => q),
        };
      if (method === "POST") {
        if (!c.lessons.every((l) => en.completed?.includes(l.id)))
          throw new HttpError(
            409,
            "Complete the lessons before taking the quiz",
          );
        const result = scoreQuiz(c.quiz, body.answers);
        await save(
          {
            ...en,
            quizAttempts: (en.quizAttempts || 0) + 1,
            quizScore: Math.max(en.quizScore || 0, result.score),
            quizPassed: !!en.quizPassed || result.passed,
            lastQuizAt: now(),
          },
          en,
        );
        return result;
      }
    }
    if (kind === "certificate") {
      if (!en) throw new HttpError(403, "Enroll first");
      const ck = userKey(sub, "CERT#" + c.id),
        old = await db.get(ck);
      if (method === "GET") {
        if (!old) throw new HttpError(404, "No certificate issued yet");
        return old;
      }
      if (method === "POST") {
        if (old) return old;
        assertCertificate(c, en);
        if (
          typeof body.learnerName !== "string" ||
          body.learnerName.trim().length < 2 ||
          body.learnerName.length > 100
        )
          throw new HttpError(400, "Enter a 2-100 character learner name");
        const cert = {
          ...ck,
          id: uuid(),
          courseId: c.id,
          courseTitle: c.title,
          learnerName: body.learnerName.trim(),
          issuedAt: now(),
          quizScore: en.quizScore ?? null,
          criteria: c.quiz
            ? "All lessons marked complete and course quiz passed"
            : "All lessons marked complete",
          notice:
            "Course completion record only. Not accredited. Learner name is self-reported.",
        };
        await save(cert);
        return cert;
      }
    }
    return undefined;
  };
}
