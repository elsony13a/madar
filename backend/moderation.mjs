import { HttpError, requireRole, requireOwner } from "./domain.mjs";
const validText = (value, min, max, label) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    throw new HttpError(400, `Invalid ${label}`);
  return value.trim();
};
export function createModeration({
  db,
  course,
  save,
  need,
  userKey,
  enrollmentKey,
  files,
  now,
  uuid,
}) {
  return async ({ method, path, body, claims }) => {
    const p = path.split("/").filter(Boolean),
      sub = claims?.sub;
    if (!sub) throw new HttpError(401, "Sign in required");
    if (path === "/admin/courses" && method === "GET") {
      requireRole(null, claims, "admin");
      return (await db.query("COURSE")).filter(
        (c) => c.status === "pending-review",
      );
    }
    if (p[0] === "admin" && p[1] === "courses" && p[2]) {
      requireRole(null, claims, "admin");
      const c = await course(p[2], false);
      if (c.status !== "pending-review")
        throw new HttpError(409, "Course is no longer awaiting review");
      if (method === "GET" && p[3] === "lessons" && p[4] && p[5] === "media") {
        const l = c.lessons.find((l) => l.id === p[4]);
        if (!l || l.type !== "video" || !l.mediaVersion)
          throw new HttpError(404, "No submitted video");
        return { url: await files.download(l.mediaKey, l.mediaVersion, 120) };
      }
      if (method === "POST" && p[3] === "review") {
        if (body.submissionId !== c.submissionId)
          throw new HttpError(
            409,
            "Submission changed. Reopen and review the current content",
          );
        if (c.ownerSub === sub)
          throw new HttpError(
            403,
            "A separate owner account must review your course",
          );
        if (!["approved", "rejected"].includes(body.decision))
          throw new HttpError(400, "Choose approved or rejected");
        const reviewNote = validText(body.note, 3, 1000, "course review note");
        if (body.decision === "approved" && body.contentChecked !== true)
          throw new HttpError(400, "Confirm you checked the submitted content");
        const status = body.decision === "approved" ? "published" : "draft";
        await save(
          {
            ...c,
            status,
            contentReviewStatus: body.decision,
            reviewNote,
            reviewedAt: now(),
            reviewedBy: sub,
            ...(status === "published" ? { publishedAt: now() } : {}),
          },
          c,
        );
        return { id: c.id, status };
      }
    }
    if (
      p[0] === "instructor" &&
      p[1] === "courses" &&
      p[2] &&
      p[3] === "withdraw" &&
      method === "POST"
    ) {
      requireRole(await db.get(userKey(sub, "PROFILE")), claims, "instructor");
      const c = await course(p[2], false);
      requireOwner(c, sub);
      if (c.status !== "pending-review")
        throw new HttpError(409, "Only pending submissions may be withdrawn");
      await save(
        {
          ...c,
          status: "draft",
          contentReviewStatus: "withdrawn",
          withdrawnAt: now(),
        },
        c,
      );
      return { id: c.id, status: "draft" };
    }
    if (p[0] === "courses" && p[1] && p[2] === "reports" && method === "POST") {
      const c = await course(p[1]);
      if (!(await db.get(enrollmentKey(sub, c.id))))
        throw new HttpError(403, "Enroll before reporting course content");
      if (
        !["content", "harassment", "copyright", "other"].includes(body.reason)
      )
        throw new HttpError(400, "Choose a report reason");
      const details = validText(body.details, 10, 2000, "report details");
      let questionId = null,
        questionSnapshot = null;
      if (body.questionId !== undefined && body.questionId !== null) {
        if (typeof body.questionId !== "string" || body.questionId.length > 250)
          throw new HttpError(400, "Invalid question reference");
        const q = await need({ PK: "QUESTION", SK: body.questionId });
        if (q.courseId !== c.id)
          throw new HttpError(400, "Question belongs to another course");
        if (q.status === "hidden" && q.userSub !== sub)
          throw new HttpError(404, "Question not found");
        questionId = q.id;
        questionSnapshot = {
          title: q.title,
          text: q.text,
          reply: q.reply || null,
          displayName: q.displayName,
          status: q.status,
        };
      }
      const id = c.id + "#" + uuid();
      await save({
        PK: "REPORT",
        SK: id,
        id,
        courseId: c.id,
        courseTitle: c.title,
        userSub: sub,
        questionId,
        questionSnapshot,
        reason: body.reason,
        details,
        status: "open",
        createdAt: now(),
      });
      return { id, status: "open" };
    }
    if (path === "/me/reports" && method === "GET")
      return (await db.query("REPORT"))
        .filter((r) => r.userSub === sub)
        .map(({ userSub, reviewedBy, PK, SK, version, ...r }) => r);
    if (path === "/admin/reports" && method === "GET") {
      requireRole(null, claims, "admin");
      return db.query("REPORT");
    }
    if (p[0] === "admin" && p[1] === "reports" && p[2] && method === "POST") {
      requireRole(null, claims, "admin");
      const r = await need({ PK: "REPORT", SK: p[2] });
      if (r.status !== "open")
        throw new HttpError(409, "Report is already resolved");
      const resolutionNote = validText(body.note, 3, 1000, "resolution note");
      await save(
        {
          ...r,
          status: "resolved",
          resolutionNote,
          reviewedAt: now(),
          reviewedBy: sub,
        },
        r,
      );
      return { id: r.id, status: "resolved" };
    }
    return undefined;
  };
}
