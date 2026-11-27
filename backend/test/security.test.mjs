import test from "node:test";
import assert from "node:assert/strict";
import { createService } from "../service.mjs";
import { validateCourse, publicCourse, roleChoice } from "../domain.mjs";
const input = (priceCents = 10000) => ({
  title: { en: "A real course", ar: "كورس حقيقي" },
  subtitle: { en: "A clear description", ar: "وصف واضح للكورس" },
  category: "Cloud",
  language: "ar",
  author: "Test instructor",
  priceCents,
  lessons: [
    {
      title: { en: "First lesson", ar: "الدرس الأول" },
      minutes: 10,
      type: "text",
      body: { en: "Private lesson content", ar: "محتوى درس خاص" },
    },
  ],
});
function fixture() {
  const map = new Map(),
    k = (x) => JSON.stringify([x.PK, x.SK]);
  const db = {
    async get(key) {
      return structuredClone(map.get(k(key)));
    },
    async query(PK, prefix = "") {
      return [...map.values()]
        .filter((i) => i.PK === PK && i.SK.startsWith(prefix))
        .map((x) => structuredClone(x));
    },
    async atomic(writes) {
      for (const w of writes) {
        const prev = map.get(k(w.item));
        if (w.version === undefined ? !!prev : prev?.version !== w.version) {
          const e = Error("Conflict");
          e.status = 409;
          throw e;
        }
      }
      for (const w of writes) map.set(k(w.item), structuredClone(w.item));
    },
  };
  let count = 0;
  const files = {
    async upload(key, type, maxBytes) {
      return { key, type, maxBytes };
    },
    async head() {
      return { size: 1024, contentType: "image/png", version: "immutable-v1" };
    },
    async download(key, version) {
      return `signed:${key}:${version}`;
    },
  };
  const dispatch = createService({
    db,
    files,
    uuid: () => `id-${++count}`,
    now: () => new Date("2026-11-20T17:00:00Z").toISOString(),
    paymentMode: "manual",
    paymentInstructions: "TEST ONLY",
  });
  const call = (method, path, body = {}, sub = "student", admin = false) =>
    dispatch({
      method,
      path,
      body,
      claims: sub
        ? { sub, "cognito:groups": admin ? ["MadarAdmins"] : [] }
        : null,
    });
  async function publish(price = 10000) {
    await call("POST", "/me/role", { role: "instructor" }, "teacher");
    const c = await call(
      "POST",
      "/instructor/courses",
      input(price),
      "teacher",
    );
    await call("POST", `/instructor/courses/${c.id}/publish`, {}, "teacher");
    const submitted = (
      await call("GET", "/admin/courses", {}, "owner", true)
    )[0];
    await call(
      "POST",
      `/admin/courses/${c.id}/review`,
      {
        decision: "approved",
        note: "Content checked",
        contentChecked: true,
        submissionId: submitted.submissionId,
      },
      "owner",
      true,
    );
    return c;
  }
  return { call, publish, map, db, files };
}
test("public catalogue does not expose lesson text or private media keys", async () => {
  const f = fixture(),
    c = await f.publish();
  const list = await f.call("GET", "/courses", {}, null);
  assert.equal(list.length, 1);
  assert.equal(list[0].lessons, undefined);
  const detail = await f.call("GET", `/courses/${c.id}`, {}, null);
  assert.equal(detail.lessons[0].body, undefined);
  assert.equal(detail.lessons[0].mediaKey, undefined);
});
test("paid enroll and lesson content are denied before manual approval", async () => {
  const f = fixture(),
    c = await f.publish();
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/enroll`),
    (e) => e.status === 402,
  );
  await assert.rejects(
    f.call("GET", `/courses/${c.id}/lessons/lesson-1/media`),
    (e) => e.status === 403,
  );
});
test("receipt submission alone cannot unlock; admin approval atomically grants enrollment", async () => {
  const f = fixture(),
    c = await f.publish();
  const p = await f.call("POST", `/courses/${c.id}/payments`, {
    contentType: "image/png",
  });
  await f.call("POST", `/payments/${p.id}/submit`);
  await assert.rejects(
    f.call("GET", `/courses/${c.id}/lessons/lesson-1/media`),
    (e) => e.status === 403,
  );
  await f.call(
    "POST",
    `/admin/payments/${p.id}/review`,
    {
      decision: "approved",
      note: "Independently verified test transfer",
      verifiedTransfer: true,
    },
    "owner",
    true,
  );
  const lesson = await f.call("GET", `/courses/${c.id}/lessons/lesson-1/media`);
  assert.equal(lesson.body.en, "Private lesson content");
  assert.equal((await f.call("GET", "/me/enrollments")).length, 1);
  await assert.rejects(
    f.call(
      "POST",
      `/admin/payments/${p.id}/review`,
      { decision: "approved", note: "Duplicate", verifiedTransfer: true },
      "owner",
      true,
    ),
    (e) => e.status === 409,
  );
});
test("rejection leaves course locked", async () => {
  const f = fixture(),
    c = await f.publish(),
    p = await f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/jpeg",
    });
  await f.call("POST", `/payments/${p.id}/submit`);
  await f.call(
    "POST",
    `/admin/payments/${p.id}/review`,
    { decision: "rejected", note: "Transfer not received" },
    "owner",
    true,
  );
  assert.deepEqual(await f.call("GET", "/me/enrollments"), []);
});
test("students and instructors cannot use admin endpoints", async () => {
  const f = fixture();
  await assert.rejects(
    f.call("GET", "/admin/payments"),
    (e) => e.status === 403,
  );
  await f.call("POST", "/me/role", { role: "instructor" });
  await assert.rejects(
    f.call("GET", "/admin/payments"),
    (e) => e.status === 403,
  );
});
test("admin cannot be selected or set as a profile role", async () => {
  assert.throws(
    () => roleChoice("admin"),
    (e) => e.status === 400,
  );
  const f = fixture();
  await assert.rejects(
    f.call("POST", "/me/role", { role: "admin" }),
    (e) => e.status === 400,
  );
});
test("another instructor cannot publish or edit someone else’s draft", async () => {
  const f = fixture();
  for (const sub of ["teacher", "intruder"])
    await f.call("POST", "/me/role", { role: "instructor" }, sub);
  const c = await f.call("POST", "/instructor/courses", input(), "teacher");
  await assert.rejects(
    f.call("POST", `/instructor/courses/${c.id}/publish`, {}, "intruder"),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("PUT", `/instructor/courses/${c.id}`, input(0), "intruder"),
    (e) => e.status === 403,
  );
});
test("admin cannot approve own request or approve without independent transfer check", async () => {
  const f = fixture(),
    c = await f.publish(),
    p = await f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/png",
    });
  await f.call("POST", `/payments/${p.id}/submit`);
  await assert.rejects(
    f.call(
      "POST",
      `/admin/payments/${p.id}/review`,
      { decision: "approved", note: "Self", verifiedTransfer: true },
      "student",
      true,
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call(
      "POST",
      `/admin/payments/${p.id}/review`,
      { decision: "approved", note: "Not checked" },
      "owner",
      true,
    ),
    (e) => e.status === 400,
  );
});
test("request ownership enforced and receipt object version is frozen at submission", async () => {
  const f = fixture(),
    c = await f.publish(),
    p = await f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/png",
    });
  await assert.rejects(
    f.call("POST", `/payments/${p.id}/submit`, {}, "another-student"),
    (e) => e.status === 403,
  );
  await f.call("POST", `/payments/${p.id}/submit`);
  assert.match(
    (await f.call("GET", `/admin/payments/${p.id}/receipt`, {}, "owner", true))
      .url,
    /immutable-v1$/,
  );
});
test("free enrollment is idempotent, progress validates lesson and isolates user", async () => {
  const f = fixture(),
    c = await f.publish(0);
  await f.call("POST", `/courses/${c.id}/enroll`);
  await f.call("POST", `/courses/${c.id}/enroll`);
  assert.equal((await f.call("GET", "/me/enrollments")).length, 1);
  await assert.rejects(
    f.call("PUT", `/courses/${c.id}/progress`, { lessonId: "fake" }),
    (e) => e.status === 400,
  );
  await f.call("PUT", `/courses/${c.id}/progress`, { lessonId: "lesson-1" });
  await f.call("PUT", `/courses/${c.id}/progress`, { lessonId: "lesson-1" });
  assert.deepEqual((await f.call("GET", "/me/enrollments"))[0].completed, [
    "lesson-1",
  ]);
  assert.deepEqual(await f.call("GET", "/me/enrollments", {}, "other"), []);
});
test("rejects malformed currency amounts and unsafe receipt type", async () => {
  assert.throws(
    () => validateCourse(input(-1)),
    (e) => e.status === 400,
  );
  assert.throws(
    () => validateCourse(input(10.5)),
    (e) => e.status === 400,
  );
  const f = fixture(),
    c = await f.publish();
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/svg+xml",
    }),
    (e) => e.status === 400,
  );
});
test("concurrent approvals grant exactly one enrollment", async () => {
  const f = fixture(),
    c = await f.publish(),
    p = await f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/png",
    });
  await f.call("POST", `/payments/${p.id}/submit`);
  const result = await Promise.allSettled([
    f.call(
      "POST",
      `/admin/payments/${p.id}/review`,
      { decision: "approved", note: "Checked one", verifiedTransfer: true },
      "owner",
      true,
    ),
    f.call(
      "POST",
      `/admin/payments/${p.id}/review`,
      { decision: "approved", note: "Checked two", verifiedTransfer: true },
      "owner2",
      true,
    ),
  ]);
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await f.call("GET", "/me/enrollments")).length, 1);
});
test("payment amount and owner come from server, never from caller fields", async () => {
  const f = fixture(),
    c = await f.publish(19950),
    p = await f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/png",
      amountCents: 1,
      userSub: "victim",
    });
  const actual = (await f.call("GET", "/me/payments")).find(
    (x) => x.id === p.id,
  );
  assert.equal(actual.amountCents, 19950);
  assert.equal(actual.userSub, "student");
  assert.deepEqual(await f.call("GET", "/me/payments", {}, "victim"), []);
});
test("an incomplete video draft cannot be published", async () => {
  const f = fixture();
  await f.call("POST", "/me/role", { role: "instructor" }, "teacher");
  const body = input(0);
  body.lessons = [{ ...body.lessons[0], type: "video" }];
  const c = await f.call("POST", "/instructor/courses", body, "teacher");
  await assert.rejects(
    f.call("POST", `/instructor/courses/${c.id}/publish`, {}, "teacher"),
    (e) => e.status === 400,
  );
});
test("course publication rejects media belonging to another instructor", async () => {
  const f = fixture();
  await f.call("POST", "/me/role", { role: "instructor" }, "teacher");
  const body = input(0);
  body.lessons = [
    {
      ...body.lessons[0],
      type: "video",
      mediaKey: "courses/another-user/other-course/video",
    },
  ];
  const c = await f.call("POST", "/instructor/courses", body, "teacher");
  await assert.rejects(
    f.call("POST", `/instructor/courses/${c.id}/publish`, {}, "teacher"),
    (e) => e.status === 403,
  );
});
const quizInput = () => ({
  passPercent: 100,
  questions: [
    {
      prompt: { en: "Who grants access?", ar: "مين يمنح الوصول؟" },
      options: [
        { en: "The backend", ar: "السيرفر" },
        { en: "Any receipt", ar: "أي إيصال" },
      ],
      correctIndex: 0,
    },
  ],
});
async function quizCourse(f) {
  await f.call("POST", "/me/role", { role: "instructor" }, "teacher");
  const c = await f.call(
    "POST",
    "/instructor/courses",
    { ...input(0), quiz: quizInput() },
    "teacher",
  );
  await f.call("POST", `/instructor/courses/${c.id}/publish`, {}, "teacher");
  const submitted = (
    await f.call("GET", "/admin/courses", {}, "owner", true)
  )[0];
  await f.call(
    "POST",
    `/admin/courses/${c.id}/review`,
    {
      decision: "approved",
      note: "Content checked",
      contentChecked: true,
      submissionId: submitted.submissionId,
    },
    "owner",
    true,
  );
  return c;
}
test("saved courses are isolated, can be removed and do not grant enrollment", async () => {
  const f = fixture(),
    c = await f.publish();
  await f.call("POST", "/me/saved", { courseId: c.id, saved: true });
  assert.deepEqual(await f.call("GET", "/me/saved"), [c.id]);
  assert.deepEqual(await f.call("GET", "/me/saved", {}, "other"), []);
  assert.deepEqual(await f.call("GET", "/me/enrollments"), []);
  await f.call("POST", "/me/saved", { courseId: c.id, saved: false });
  assert.deepEqual(await f.call("GET", "/me/saved"), []);
});
test("quiz answer keys never appear in public metadata or enrolled learner quiz", async () => {
  const f = fixture(),
    c = await quizCourse(f);
  const meta = await f.call("GET", `/courses/${c.id}`, {}, null);
  assert.equal(meta.hasQuiz, true);
  assert.equal(meta.quiz, undefined);
  await assert.rejects(
    f.call("GET", `/courses/${c.id}/quiz`),
    (e) => e.status === 403,
  );
  await f.call("POST", `/courses/${c.id}/enroll`);
  const q = await f.call("GET", `/courses/${c.id}/quiz`);
  assert.equal(q.questions[0].correctIndex, undefined);
  assert.equal(JSON.stringify(q).includes("correctIndex"), false);
});
test("quiz requires all lessons and validates answers, ignores caller score/pass flags", async () => {
  const f = fixture(),
    c = await quizCourse(f);
  await f.call("POST", `/courses/${c.id}/enroll`);
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/quiz`, {
      answers: [0],
      score: 100,
      passed: true,
    }),
    (e) => e.status === 409,
  );
  await f.call("PUT", `/courses/${c.id}/progress`, { lessonId: "lesson-1" });
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/quiz`, { answers: [99] }),
    (e) => e.status === 400,
  );
  const result = await f.call("POST", `/courses/${c.id}/quiz`, {
    answers: [1],
    score: 100,
    passed: true,
  });
  assert.equal(result.score, 0);
  assert.equal(result.passed, false);
});
test("completion certificate requires every lesson and passing quiz; stable issued record", async () => {
  const f = fixture(),
    c = await quizCourse(f);
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/certificate`, {
      learnerName: "Test learner",
    }),
    (e) => e.status === 403,
  );
  await f.call("POST", `/courses/${c.id}/enroll`);
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/certificate`, {
      learnerName: "Test learner",
    }),
    (e) => e.status === 409,
  );
  await f.call("PUT", `/courses/${c.id}/progress`, { lessonId: "lesson-1" });
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/certificate`, {
      learnerName: "Test learner",
    }),
    (e) => e.status === 409,
  );
  await f.call("POST", `/courses/${c.id}/quiz`, { answers: [0] });
  const cert = await f.call("POST", `/courses/${c.id}/certificate`, {
    learnerName: "Test learner",
  });
  assert.equal(cert.quizScore, 100);
  assert.match(cert.notice, /Not accredited/);
  const again = await f.call("POST", `/courses/${c.id}/certificate`, {
    learnerName: "Changed name",
  });
  assert.equal(again.id, cert.id);
  assert.equal(again.learnerName, "Test learner");
  await assert.rejects(
    f.call("GET", `/courses/${c.id}/certificate`, {}, "other"),
    (e) => e.status === 403,
  );
});
test("later quiz failure cannot remove a previously earned pass", async () => {
  const f = fixture(),
    c = await quizCourse(f);
  await f.call("POST", `/courses/${c.id}/enroll`);
  await f.call("PUT", `/courses/${c.id}/progress`, { lessonId: "lesson-1" });
  await f.call("POST", `/courses/${c.id}/quiz`, { answers: [0] });
  await f.call("POST", `/courses/${c.id}/quiz`, { answers: [1] });
  const en = (await f.call("GET", "/me/enrollments"))[0];
  assert.equal(en.quizPassed, true);
  assert.equal(en.quizScore, 100);
  assert.equal(en.quizAttempts, 2);
});
test("reviews require enrolled lesson completion and one moderated record per student", async () => {
  const f = fixture(),
    c = await f.publish(0),
    body = {
      rating: 5,
      text: "A thoughtful and helpful course",
      displayName: "Test learner",
    };
  await assert.rejects(
    f.call("PUT", `/courses/${c.id}/reviews`, body),
    (e) => e.status === 403,
  );
  await f.call("POST", `/courses/${c.id}/enroll`);
  await assert.rejects(
    f.call("PUT", `/courses/${c.id}/reviews`, body),
    (e) => e.status === 403,
  );
  await f.call("PUT", `/courses/${c.id}/progress`, { lessonId: "lesson-1" });
  await f.call("PUT", `/courses/${c.id}/reviews`, body);
  assert.deepEqual(await f.call("GET", `/courses/${c.id}/reviews`), []);
  const pending = await f.call("GET", "/admin/reviews", {}, "owner", true);
  assert.equal(pending.length, 1);
  await assert.rejects(
    f.call("POST", `/admin/reviews/${pending[0].id}`, { decision: "approved" }),
    (e) => e.status === 403,
  );
  await f.call(
    "POST",
    `/admin/reviews/${pending[0].id}`,
    { decision: "approved" },
    "owner",
    true,
  );
  assert.equal((await f.call("GET", `/courses/${c.id}/reviews`)).length, 1);
  await f.call("PUT", `/courses/${c.id}/reviews`, { ...body, rating: 4 });
  assert.deepEqual(await f.call("GET", `/courses/${c.id}/reviews`), []);
  assert.equal(
    (await f.call("GET", "/admin/reviews", {}, "owner", true)).length,
    1,
  );
});
test("instructor cannot review own course and invalid rating is rejected", async () => {
  const f = fixture(),
    c = await f.publish(0);
  for (const sub of ["teacher", "student"]) {
    await f.call("POST", `/courses/${c.id}/enroll`, {}, sub);
    await f.call(
      "PUT",
      `/courses/${c.id}/progress`,
      { lessonId: "lesson-1" },
      sub,
    );
  }
  await assert.rejects(
    f.call(
      "PUT",
      `/courses/${c.id}/reviews`,
      {
        rating: 5,
        text: "My own course is really good",
        displayName: "Teacher",
      },
      "teacher",
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("PUT", `/courses/${c.id}/reviews`, {
      rating: 9,
      text: "A useful course indeed",
      displayName: "Learner",
    }),
    (e) => e.status === 400,
  );
});
test("published metadata update keeps lessons, quiz, access and pending price quote unchanged", async () => {
  const f = fixture(),
    c = await f.publish(19950);
  const p = await f.call("POST", `/courses/${c.id}/payments`, {
    contentType: "image/png",
  });
  await f.call(
    "PUT",
    `/instructor/courses/${c.id}/details`,
    {
      title: { en: "Updated title", ar: "عنوان جديد للكورس" },
      subtitle: { en: "Updated description", ar: "وصف جديد للكورس" },
      priceCents: 29950,
      lessons: [],
      ownerSub: "intruder",
    },
    "teacher",
  );
  const actual = await f.call("GET", `/courses/${c.id}`, {}, null);
  assert.equal(actual.lessons.length, 1);
  assert.equal(actual.priceCents, 29950);
  assert.equal((await f.call("GET", "/me/payments"))[0].amountCents, 19950);
  await f.call("POST", `/payments/${p.id}/submit`);
  await f.call(
    "POST",
    `/admin/payments/${p.id}/review`,
    {
      decision: "approved",
      note: "Original amount checked",
      verifiedTransfer: true,
    },
    "owner",
    true,
  );
  assert.equal((await f.call("GET", "/me/enrollments")).length, 1);
  await assert.rejects(
    f.call(
      "PUT",
      `/instructor/courses/${c.id}/details`,
      { title: actual.title, subtitle: actual.subtitle, priceCents: 0 },
      "other",
    ),
    (e) => e.status === 403,
  );
});
test("published curriculum and answer key remain immutable even through details endpoint", async () => {
  const f = fixture(),
    c = await quizCourse(f);
  await f.call(
    "PUT",
    `/instructor/courses/${c.id}/details`,
    {
      title: c.title,
      subtitle: c.subtitle,
      priceCents: 0,
      quiz: { ...quizInput(), passPercent: 50 },
    },
    "teacher",
  );
  const actual = (await f.call("GET", "/instructor/courses", {}, "teacher"))[0];
  assert.equal(actual.quiz.passPercent, 100);
  await assert.rejects(
    f.call("PUT", `/instructor/courses/${c.id}`, input(0), "teacher"),
    (e) => e.status === 409,
  );
});
test("quiz validation rejects invalid pass marks and invalid correct-answer indices", () => {
  assert.throws(
    () =>
      validateCourse({ ...input(0), quiz: { ...quizInput(), passPercent: 0 } }),
    (e) => e.status === 400,
  );
  const q = quizInput();
  q.questions[0].correctIndex = 8;
  assert.throws(
    () => validateCourse({ ...input(0), quiz: q }),
    (e) => e.status === 400,
  );
});
test("completion record snapshots survive later metadata and price changes", async () => {
  const f = fixture(),
    c = await f.publish(0);
  await f.call("POST", `/courses/${c.id}/enroll`);
  await f.call("PUT", `/courses/${c.id}/progress`, {
    lessonId: "lesson-1",
    quizPassed: true,
    quizScore: 100,
  });
  const cert = await f.call("POST", `/courses/${c.id}/certificate`, {
    learnerName: "Original learner",
  });
  assert.equal(cert.quizScore, null);
  await f.call(
    "PUT",
    `/instructor/courses/${c.id}/details`,
    {
      title: { en: "New marketing title", ar: "عنوان تسويقي جديد" },
      subtitle: c.subtitle,
      priceCents: 99900,
    },
    "teacher",
  );
  const again = await f.call("GET", `/courses/${c.id}/certificate`);
  assert.equal(again.courseTitle.en, cert.courseTitle.en);
  assert.equal(again.issuedAt, cert.issuedAt);
});
const questionBody = () => ({
  displayName: "Test learner",
  title: "How do I protect private lesson files?",
  text: "I understand the browser needs a URL, but where should course permission be checked?",
});
test("private notes require enrollment, validate lesson and stay isolated from teacher and other students", async () => {
  const f = fixture(),
    c = await f.publish(0);
  await assert.rejects(
    f.call("GET", `/courses/${c.id}/notes/lesson-1`),
    (e) => e.status === 403,
  );
  await f.call("POST", `/courses/${c.id}/enroll`);
  await f.call("PUT", `/courses/${c.id}/notes/lesson-1`, {
    text: "Only my own learning note",
    userSub: "other",
  });
  assert.equal(
    (await f.call("GET", `/courses/${c.id}/notes/lesson-1`)).text,
    "Only my own learning note",
  );
  await f.call("POST", `/courses/${c.id}/enroll`, {}, "other");
  assert.equal(
    (await f.call("GET", `/courses/${c.id}/notes/lesson-1`, {}, "other")).text,
    "",
  );
  await assert.rejects(
    f.call("GET", `/courses/${c.id}/notes/lesson-1`, {}, "teacher"),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("PUT", `/courses/${c.id}/notes/missing`, { text: "Invalid" }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    f.call("PUT", `/courses/${c.id}/notes/lesson-1`, {
      text: "x".repeat(8001),
    }),
    (e) => e.status === 400,
  );
  await f.call("PUT", `/courses/${c.id}/notes/lesson-1`, { text: "" });
  assert.equal(
    (await f.call("GET", `/courses/${c.id}/notes/lesson-1`)).text,
    "",
  );
});
test("only enrolled learners can ask; own instructor can read and answer without enrolling", async () => {
  const f = fixture(),
    c = await f.publish(0);
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/questions`, questionBody()),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("GET", `/courses/${c.id}/questions`),
    (e) => e.status === 403,
  );
  await f.call("POST", `/courses/${c.id}/enroll`);
  const q = await f.call("POST", `/courses/${c.id}/questions`, {
    ...questionBody(),
    userSub: "someone-else",
  });
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/questions/${q.id}/reply`, {
      text: "A fake instructor answer",
    }),
    (e) => e.status === 403,
  );
  await f.call(
    "POST",
    `/courses/${c.id}/questions/${q.id}/reply`,
    {
      text: "Check authorization on the backend, then issue a short-lived URL.",
    },
    "teacher",
  );
  const rows = await f.call("GET", `/courses/${c.id}/questions`);
  assert.equal(rows[0].reply.startsWith("Check authorization"), true);
  assert.equal(rows[0].userSub, undefined);
  assert.equal(rows[0].repliedBy, undefined);
  assert.equal(rows[0].canReply, false);
});
test("another instructor cannot answer, cross-course reply and hidden discussion reply are denied", async () => {
  const f = fixture(),
    c = await f.publish(0),
    other = await f.publish(0);
  await f.call("POST", `/courses/${c.id}/enroll`);
  const q = await f.call("POST", `/courses/${c.id}/questions`, questionBody());
  await f.call("POST", "/me/role", { role: "instructor" }, "intruder");
  await assert.rejects(
    f.call(
      "POST",
      `/courses/${c.id}/questions/${q.id}/reply`,
      { text: "Unauthorized reply" },
      "intruder",
    ),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call(
      "POST",
      `/courses/${other.id}/questions/${q.id}/reply`,
      { text: "Wrong course reply" },
      "teacher",
    ),
    (e) => e.status === 403,
  );
  await f.call(
    "POST",
    `/admin/questions/${q.id}`,
    { status: "hidden" },
    "owner",
    true,
  );
  await assert.rejects(
    f.call(
      "POST",
      `/courses/${c.id}/questions/${q.id}/reply`,
      { text: "Hidden thread reply" },
      "teacher",
    ),
    (e) => e.status === 409,
  );
});
test("question moderation requires admin, hiding removes whole thread for other enrolled students", async () => {
  const f = fixture(),
    c = await f.publish(0);
  for (const who of ["student", "other"])
    await f.call("POST", `/courses/${c.id}/enroll`, {}, who);
  const q = await f.call("POST", `/courses/${c.id}/questions`, questionBody());
  await assert.rejects(
    f.call("GET", "/admin/questions"),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("POST", `/admin/questions/${q.id}`, { status: "hidden" }),
    (e) => e.status === 403,
  );
  await f.call(
    "POST",
    `/admin/questions/${q.id}`,
    { status: "hidden" },
    "owner",
    true,
  );
  assert.equal(
    (await f.call("GET", `/courses/${c.id}/questions`, {}, "other")).length,
    0,
  );
  const own = await f.call("GET", `/courses/${c.id}/questions`);
  assert.equal(own.length, 1);
  assert.equal(own[0].status, "hidden");
  await f.call(
    "POST",
    `/admin/questions/${q.id}`,
    { status: "visible" },
    "owner",
    true,
  );
  assert.equal(
    (await f.call("GET", `/courses/${c.id}/questions`, {}, "other")).length,
    1,
  );
});
test("question and reply length/shape validated rather than allowing arbitrary metadata", async () => {
  const f = fixture(),
    c = await f.publish(0);
  await f.call("POST", `/courses/${c.id}/enroll`);
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/questions`, {
      ...questionBody(),
      text: "x",
    }),
    (e) => e.status === 400,
  );
  const q = await f.call("POST", `/courses/${c.id}/questions`, questionBody());
  await assert.rejects(
    f.call(
      "POST",
      `/courses/${c.id}/questions/${q.id}/reply`,
      { text: "x".repeat(4001) },
      "teacher",
    ),
    (e) => e.status === 400,
  );
});
test("instructor insights use only own course request snapshots, no invented enrollments/revenue", async () => {
  const f = fixture(),
    c = await f.publish(19950),
    p = await f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/png",
    });
  await f.call("POST", `/payments/${p.id}/submit`);
  await f.call(
    "POST",
    `/admin/payments/${p.id}/review`,
    {
      decision: "approved",
      note: "Test ledger checked",
      verifiedTransfer: true,
    },
    "owner",
    true,
  );
  await assert.rejects(
    f.call("GET", "/instructor/insights"),
    (e) => e.status === 403,
  );
  const own = await f.call("GET", "/instructor/insights", {}, "teacher");
  assert.equal(own.approvedRequests, 1);
  assert.equal(own.manualApprovedAmountCents, 19950);
  assert.equal(own.testApprovedAmountCents, 0);
  assert.equal(own.averageRating, null);
  assert.equal(own.studentCount, undefined);
  assert.match(own.notice, /not verified revenue/);
  await f.call("POST", "/me/role", { role: "instructor" }, "another");
  const another = await f.call("GET", "/instructor/insights", {}, "another");
  assert.equal(another.approvedRequests, 0);
  assert.equal(another.manualApprovedAmountCents, 0);
});

async function draft(f, body = input(0), teacher = "teacher") {
  await f.call("POST", "/me/role", { role: "instructor" }, teacher);
  return f.call("POST", "/instructor/courses", body, teacher);
}
async function submit(f, c, teacher = "teacher") {
  await f.call("POST", `/instructor/courses/${c.id}/publish`, {}, teacher);
  return (await f.call("GET", "/admin/courses", {}, "owner", true)).find(
    (x) => x.id === c.id,
  );
}
const approveBody = (c) => ({
  decision: "approved",
  note: "Content checked by separate owner",
  contentChecked: true,
  submissionId: c.submissionId,
});
test("new course submissions stay private and locked until a separate admin approves", async () => {
  const f = fixture(),
    c = await draft(f),
    pending = await submit(f, c);
  assert.equal(pending.status, "pending-review");
  assert.deepEqual(await f.call("GET", "/courses", {}, null), []);
  await assert.rejects(
    f.call("GET", `/courses/${c.id}`, {}, null),
    (e) => e.status === 404,
  );
  await assert.rejects(
    f.call("GET", "/admin/courses"),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/enroll`),
    (e) => e.status === 404,
  );
  await assert.rejects(
    f.call("PUT", `/instructor/courses/${c.id}`, input(0), "teacher"),
    (e) => e.status === 409,
  );
  await assert.rejects(
    f.call("PUT", `/instructor/courses/${c.id}/details`, input(0), "teacher"),
    (e) => e.status === 409,
  );
  await f.call(
    "POST",
    `/admin/courses/${c.id}/review`,
    approveBody(pending),
    "owner",
    true,
  );
  assert.equal((await f.call("GET", "/courses", {}, null)).length, 1);
  await f.call("POST", `/courses/${c.id}/enroll`);
  await assert.rejects(
    f.call(
      "POST",
      `/admin/courses/${c.id}/review`,
      approveBody(pending),
      "owner",
      true,
    ),
    (e) => e.status === 409,
  );
});
test("rejection and withdrawal allow revision but stale submission approval is refused", async () => {
  const f = fixture(),
    c = await draft(f),
    first = await submit(f, c);
  await f.call(
    "POST",
    `/admin/courses/${c.id}/review`,
    {
      decision: "rejected",
      note: "Revise the lesson explanation",
      submissionId: first.submissionId,
    },
    "owner",
    true,
  );
  let own = (await f.call("GET", "/instructor/courses", {}, "teacher"))[0];
  assert.equal(own.status, "draft");
  assert.equal(own.reviewNote, "Revise the lesson explanation");
  await f.call("PUT", `/instructor/courses/${c.id}`, input(0), "teacher");
  const second = await submit(f, c);
  assert.notEqual(second.submissionId, first.submissionId);
  await assert.rejects(
    f.call(
      "POST",
      `/admin/courses/${c.id}/review`,
      approveBody(first),
      "owner",
      true,
    ),
    (e) => e.status === 409,
  );
  await assert.rejects(
    f.call("POST", `/instructor/courses/${c.id}/withdraw`, {}, "other"),
    (e) => e.status === 403,
  );
  await f.call("POST", `/instructor/courses/${c.id}/withdraw`, {}, "teacher");
  assert.deepEqual(
    await f.call("GET", "/admin/courses", {}, "owner", true),
    [],
  );
  await assert.rejects(
    f.call(
      "POST",
      `/admin/courses/${c.id}/review`,
      approveBody(second),
      "owner",
      true,
    ),
    (e) => e.status === 409,
  );
});
test("course review requires verified admin, separate reviewer, note and explicit content check", async () => {
  const f = fixture(),
    c = await draft(f),
    pending = await submit(f, c),
    body = approveBody(pending);
  await assert.rejects(
    f.call("POST", `/admin/courses/${c.id}/review`, body, "teacher"),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("POST", `/admin/courses/${c.id}/review`, body, "teacher", true),
    (e) => e.status === 403,
  );
  for (const invalid of [
    { ...body, note: "" },
    { ...body, contentChecked: false },
    { ...body, decision: "publish-now" },
  ])
    await assert.rejects(
      f.call("POST", `/admin/courses/${c.id}/review`, invalid, "owner", true),
      (e) => e.status === 400,
    );
});
test("submitted video review and approval retain the exact version reviewed", async () => {
  const f = fixture(),
    c = await draft(f),
    body = input(0);
  body.lessons = [
    {
      ...body.lessons[0],
      type: "video",
      mediaKey: `courses/teacher/${c.id}/movie`,
    },
  ];
  await f.call("PUT", `/instructor/courses/${c.id}`, body, "teacher");
  f.files.head = async () => ({
    contentType: "video/mp4",
    size: 2000,
    version: "submitted-v1",
  });
  const pending = await submit(f, c),
    lesson = pending.lessons[0];
  f.files.head = async () => ({
    contentType: "video/mp4",
    size: 2000,
    version: "later-v2",
  });
  const signed = await f.call(
    "GET",
    `/admin/courses/${c.id}/lessons/${lesson.id}/media`,
    {},
    "owner",
    true,
  );
  assert.ok(signed.url.endsWith(":submitted-v1"));
  await assert.rejects(
    f.call(
      "GET",
      `/admin/courses/${c.id}/lessons/${lesson.id}/media`,
      {},
      "teacher",
    ),
    (e) => e.status === 403,
  );
  await f.call(
    "POST",
    `/admin/courses/${c.id}/review`,
    approveBody(pending),
    "owner",
    true,
  );
  const actual = (await f.call("GET", "/instructor/courses", {}, "teacher"))[0];
  assert.equal(actual.lessons[0].mediaVersion, "submitted-v1");
});
test("video submission without immutable storage version is refused", async () => {
  const f = fixture(),
    c = await draft(f),
    body = input(0);
  body.lessons = [
    {
      ...body.lessons[0],
      type: "video",
      mediaKey: `courses/teacher/${c.id}/movie`,
    },
  ];
  await f.call("PUT", `/instructor/courses/${c.id}`, body, "teacher");
  f.files.head = async () => ({ contentType: "video/mp4", size: 2000 });
  await assert.rejects(submit(f, c), (e) => e.status === 400);
});
test("reports require enrollment and valid fields, use verified identity, remain private to reporter and admin", async () => {
  const f = fixture(),
    c = await f.publish(0),
    body = {
      reason: "content",
      details: "Please check this lesson statement",
      userSub: "victim",
    };
  await assert.rejects(
    f.call("POST", `/courses/${c.id}/reports`, body),
    (e) => e.status === 403,
  );
  await f.call("POST", `/courses/${c.id}/enroll`);
  for (const invalid of [
    { ...body, reason: "auto-refund" },
    { ...body, details: "short" },
    { ...body, details: "x".repeat(2001) },
  ])
    await assert.rejects(
      f.call("POST", `/courses/${c.id}/reports`, invalid),
      (e) => e.status === 400,
    );
  const r = await f.call("POST", `/courses/${c.id}/reports`, body);
  const own = await f.call("GET", "/me/reports");
  assert.equal(own[0].id, r.id);
  assert.equal(own[0].userSub, undefined);
  assert.deepEqual(await f.call("GET", "/me/reports", {}, "victim"), []);
  assert.deepEqual(await f.call("GET", "/me/reports", {}, "teacher"), []);
  await assert.rejects(
    f.call("GET", "/admin/reports"),
    (e) => e.status === 403,
  );
  const admin = await f.call("GET", "/admin/reports", {}, "owner", true);
  assert.equal(admin[0].userSub, "student");
});
test("report resolution is admin-only and does not silently hide, revoke access or refund", async () => {
  const f = fixture(),
    c = await f.publish(0);
  await f.call("POST", `/courses/${c.id}/enroll`);
  const r = await f.call("POST", `/courses/${c.id}/reports`, {
    reason: "other",
    details: "Please review this course explanation",
  });
  await assert.rejects(
    f.call("POST", `/admin/reports/${r.id}`, { note: "Checked" }),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.call("POST", `/admin/reports/${r.id}`, { note: "" }, "owner", true),
    (e) => e.status === 400,
  );
  await f.call(
    "POST",
    `/admin/reports/${r.id}`,
    { note: "Reviewed the concern; follow-up recorded" },
    "owner",
    true,
  );
  assert.equal((await f.call("GET", "/me/reports"))[0].status, "resolved");
  assert.equal((await f.call("GET", "/me/enrollments")).length, 1);
  assert.equal((await f.call("GET", "/courses", {}, null)).length, 1);
  await assert.rejects(
    f.call("POST", `/admin/reports/${r.id}`, { note: "Repeat" }, "owner", true),
    (e) => e.status === 409,
  );
});
test("question report validates course membership and hidden-thread audience", async () => {
  const f = fixture(),
    a = await f.publish(0),
    b = await f.publish(0);
  await f.call("POST", `/courses/${a.id}/enroll`);
  await f.call("POST", `/courses/${b.id}/enroll`);
  const q = await f.call("POST", `/courses/${a.id}/questions`, {
    title: "A clear question",
    text: "A detailed question about access",
    displayName: "Learner",
  });
  const body = {
    reason: "harassment",
    details: "Please check the discussion wording",
    questionId: q.id,
  };
  await assert.rejects(
    f.call("POST", `/courses/${b.id}/reports`, body),
    (e) => e.status === 400,
  );
  await f.call(
    "POST",
    `/admin/questions/${q.id}`,
    { status: "hidden" },
    "owner",
    true,
  );
  await f.call("POST", `/courses/${a.id}/reports`, body);
  await f.call("POST", `/courses/${a.id}/enroll`, {}, "other");
  await assert.rejects(
    f.call("POST", `/courses/${a.id}/reports`, body, "other"),
    (e) => e.status === 404,
  );
});
test("report discussion snapshot is server-owned and does not change after instructor reply", async () => {
  const f = fixture(),
    c = await f.publish(0);
  await f.call("POST", `/courses/${c.id}/enroll`);
  const q = await f.call("POST", `/courses/${c.id}/questions`, {
    title: "Explain course access",
    text: "Please explain how the backend checks access",
    displayName: "Learner",
  });
  await f.call("POST", `/courses/${c.id}/reports`, {
    reason: "content",
    details: "Please review the technical explanation",
    questionId: q.id,
    questionSnapshot: { title: "forged" },
  });
  await f.call(
    "POST",
    `/courses/${c.id}/questions/${q.id}/reply`,
    { text: "Access is checked against verified identity and enrollment" },
    "teacher",
  );
  const report = (await f.call("GET", "/me/reports"))[0];
  assert.equal(report.questionSnapshot.title, "Explain course access");
  assert.equal(report.questionSnapshot.reply, null);
  for (const questionId of [[], {}, 7, "x".repeat(251)])
    await assert.rejects(
      f.call("POST", `/courses/${c.id}/reports`, {
        reason: "content",
        details: "Please review this discussion snapshot",
        questionId,
      }),
      (e) => e.status === 400,
    );
});
test("suspended-versioning null versions cannot be accepted as immutable receipt or video evidence", async () => {
  const f = fixture(),
    c = await f.publish(),
    p = await f.call("POST", `/courses/${c.id}/payments`, {
      contentType: "image/png",
    });
  f.files.head = async () => ({
    contentType: "image/png",
    size: 1000,
    version: "null",
  });
  await assert.rejects(
    f.call("POST", `/payments/${p.id}/submit`),
    (e) => e.status === 400,
  );
  const d = await draft(f),
    body = input(0);
  body.lessons = [
    {
      ...body.lessons[0],
      type: "video",
      mediaKey: `courses/teacher/${d.id}/movie`,
    },
  ];
  await f.call("PUT", `/instructor/courses/${d.id}`, body, "teacher");
  f.files.head = async () => ({
    contentType: "video/mp4",
    size: 2000,
    version: "null",
  });
  await assert.rejects(submit(f, d), (e) => e.status === 400);
});
