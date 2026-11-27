import test from "node:test";
import assert from "node:assert/strict";
import { createService } from "../service.mjs";
import { parseAiQuiz, lessonSource, aiSystem } from "../ai-quiz.mjs";
const quiz = {
  passPercent: 70,
  questions: [
    {
      prompt: { en: "Where is access checked?", ar: "أين يتم التحقق؟" },
      options: [
        { en: "Backend", ar: "السيرفر" },
        { en: "Button", ar: "الزر" },
        { en: "Nowhere", ar: "لا مكان" },
      ],
      correctIndex: 0,
    },
  ],
};
const input = {
  title: { en: "Private course", ar: "كورس خاص" },
  subtitle: { en: "Clear description", ar: "وصف واضح" },
  category: "Cloud",
  language: "en",
  author: "Teacher",
  priceCents: 0,
  lessons: [
    {
      title: { en: "Access boundaries", ar: "حدود الوصول" },
      type: "text",
      minutes: 10,
      body: {
        en: "The backend must check enrollment.",
        ar: "يجب أن يتحقق السيرفر من الاشتراك.",
      },
    },
  ],
};
async function fixture({ enabled = true, generate } = {}) {
  const map = new Map(),
    k = (x) => JSON.stringify([x.PK, x.SK]);
  let calls = 0,
    id = 0,
    last;
  const db = {
    async get(key) {
      return structuredClone(map.get(k(key)));
    },
    async query(PK, prefix = "") {
      return [...map.values()]
        .filter((x) => x.PK === PK && x.SK.startsWith(prefix))
        .map((x) => structuredClone(x));
    },
    async atomic(writes) {
      for (const w of writes) {
        const old = map.get(k(w.item));
        if (w.version === undefined ? !!old : old?.version !== w.version) {
          const e = Error("Conflict");
          e.status = 409;
          throw e;
        }
      }
      for (const w of writes) map.set(k(w.item), structuredClone(w.item));
    },
  };
  const dispatch = createService({
    db,
    files: {},
    uuid: () => `course-${++id}`,
    now: () => "2026-11-20T18:00:00Z",
    ai: {
      enabled,
      modelId: "configured-test-model",
      region: "selected-test-region",
      async generate(arg) {
        calls++;
        last = arg;
        return generate
          ? generate(arg)
          : {
              text: JSON.stringify(quiz),
              usage: { inputTokens: 100, outputTokens: 100 },
            };
      },
    },
  });
  const call = (method, path, body = {}, sub = "teacher", admin = false) =>
    dispatch({
      method,
      path,
      body,
      claims: { sub, "cognito:groups": admin ? ["MadarAdmins"] : [] },
    });
  await call("POST", "/me/role", { role: "instructor" });
  const c = await call("POST", "/instructor/courses", input);
  const gen = (requestId = "request-id-00000001", extra = {}) =>
    call("POST", `/instructor/courses/${c.id}/ai-quiz`, {
      count: 1,
      consent: true,
      requestId,
      ...extra,
    });
  return {
    map,
    db,
    c,
    call,
    gen,
    get calls() {
      return calls;
    },
    get last() {
      return last;
    },
  };
}
test("Bedrock disabled by default and explicit consent required before any invocation", async () => {
  const f = await fixture({ enabled: false });
  assert.equal(
    (await f.call("GET", `/instructor/courses/${f.c.id}/ai-quiz`)).enabled,
    false,
  );
  await assert.rejects(f.gen(), (e) => e.status === 503);
  assert.equal(f.calls, 0);
  const g = await fixture();
  await assert.rejects(
    g.gen(undefined, { consent: false }),
    (e) => e.status === 400,
  );
  assert.equal(g.calls, 0);
});
test("only verified instructor owner can generate and only on an editable draft", async () => {
  const f = await fixture(),
    path = `/instructor/courses/${f.c.id}/ai-quiz`;
  await assert.rejects(
    f.call(
      "POST",
      path,
      { count: 1, consent: true, requestId: "request-id-00000001" },
      "student",
    ),
    (e) => e.status === 403,
  );
  await f.call("POST", "/me/role", { role: "instructor" }, "other");
  await assert.rejects(
    f.call("POST", path, {}, "other"),
    (e) => e.status === 403,
  );
  await f.call("POST", `/instructor/courses/${f.c.id}/publish`);
  await assert.rejects(f.gen(), (e) => e.status === 409);
  assert.equal(f.calls, 0);
});
test("model receives own saved text lessons only, never client prompt, user secrets or learner records", async () => {
  const f = await fixture();
  await f.db.atomic([
    {
      item: {
        PK: "USER#student",
        SK: "NOTE#private",
        text: "private-note-marker",
      },
    },
  ]);
  const r = await f.gen(undefined, {
    prompt: "caller-override-marker",
    modelId: "other-model",
    region: "elsewhere",
    studentNotes: "private-note-marker",
  });
  assert.equal(f.calls, 1);
  assert.equal(r.modelId, "configured-test-model");
  assert.ok(f.last.source.includes("backend must check enrollment"));
  assert.ok(!JSON.stringify(f.last).includes("caller-override-marker"));
  assert.ok(!JSON.stringify(f.last).includes("private-note-marker"));
  assert.equal(f.last.system, aiSystem);
  const own = (await f.call("GET", "/instructor/courses"))[0];
  assert.equal(own.quiz, null);
  assert.deepEqual(await f.call("GET", "/courses", {}, "visitor"), []);
});
test("repeated request ID reuses ready proposal without another billed call and conflicting inputs fail", async () => {
  const f = await fixture(),
    a = await f.gen(),
    b = await f.gen();
  assert.deepEqual(a, b);
  assert.equal(f.calls, 1);
  await assert.rejects(f.gen(undefined, { count: 2 }), (e) => e.status === 409);
});
test("schema malformed/truncated responses are rejected, failure is not retried and consumes a cap slot", async () => {
  const f = await fixture({ generate: async () => ({ text: "not JSON" }) });
  await assert.rejects(f.gen(), (e) => e.status === 502);
  await assert.rejects(f.gen(), (e) => e.status === 409);
  assert.equal(f.calls, 1);
  for (const v of [
    null,
    {},
    { ...quiz, questions: [] },
    { ...quiz, questions: [{ ...quiz.questions[0], correctIndex: 5 }] },
  ])
    assert.throws(
      () => parseAiQuiz(JSON.stringify(v), 1),
      (e) => e.status === 502,
    );
  assert.throws(
    () => parseAiQuiz("x".repeat(32001), 1),
    (e) => e.status === 502,
  );
});
test("timeout/failure never auto-retries or exposes provider exception data", async () => {
  const f = await fixture({
    generate: async () => {
      throw Error("provider-sensitive-marker");
    },
  });
  await assert.rejects(
    f.gen(),
    (e) => e.status === 502 && !e.message.includes("provider-sensitive-marker"),
  );
  assert.equal(f.calls, 1);
});
test("daily instructor attempt cap blocks the fourth model request", async () => {
  const f = await fixture();
  for (let i = 0; i < 3; i++) await f.gen("request-id-0000000" + i);
  await assert.rejects(f.gen("request-id-00000004"), (e) => e.status === 429);
  assert.equal(f.calls, 3);
});
test("platform daily cap blocks calls even from a fresh instructor", async () => {
  const f = await fixture();
  await f.db.atomic([
    { item: { PK: "AIQUOTA", SK: "2026-11-20", count: 20, version: 1 } },
  ]);
  await assert.rejects(f.gen(), (e) => e.status === 429);
  assert.equal(f.calls, 0);
});
test("adoption needs explicit review, current owner and unchanged draft, then deterministic quiz is persisted", async () => {
  const f = await fixture(),
    r = await f.gen(),
    path = `/instructor/courses/${f.c.id}/ai-quiz/adopt`;
  await assert.rejects(
    f.call("POST", path, { requestId: r.requestId, reviewed: false }),
    (e) => e.status === 400,
  );
  await f.call("POST", "/me/role", { role: "instructor" }, "other");
  await assert.rejects(
    f.call("POST", path, { requestId: r.requestId, reviewed: true }, "other"),
    (e) => e.status === 403,
  );
  await f.call("POST", path, { requestId: r.requestId, reviewed: true });
  const own = (await f.call("GET", "/instructor/courses"))[0];
  assert.equal(own.quiz.questions[0].correctIndex, 0);
  assert.equal(own.status, "draft");
  assert.equal(own.aiQuizProvenance.modelId, "configured-test-model");
  await assert.rejects(
    f.call("POST", path, { requestId: r.requestId, reviewed: true }),
    (e) => e.status === 409,
  );
});
test("stale lesson or version change prevents adoption instead of overwriting current draft", async () => {
  const f = await fixture(),
    r = await f.gen();
  await f.call("PUT", `/instructor/courses/${f.c.id}`, {
    ...input,
    title: { en: "Changed course", ar: "كورس معدل" },
  });
  await assert.rejects(
    f.call("POST", `/instructor/courses/${f.c.id}/ai-quiz/adopt`, {
      requestId: r.requestId,
      reviewed: true,
    }),
    (e) => e.status === 409,
  );
});
test("source size, video lessons, count and request identifier rejected before model invocation", async () => {
  const f = await fixture();
  for (const extra of [
    { count: 0 },
    { count: 4 },
    { requestId: "bad" },
    { requestId: {} },
  ])
    await assert.rejects(f.gen(undefined, extra), (e) => e.status === 400);
  assert.equal(f.calls, 0);
  assert.throws(
    () =>
      lessonSource({
        ...input,
        lessons: [{ ...input.lessons[0], type: "video" }],
      }),
    (e) => e.status === 400,
  );
  assert.throws(
    () =>
      lessonSource({
        ...input,
        lessons: [
          { ...input.lessons[0], body: { en: "a".repeat(12001), ar: "نص" } },
        ],
      }),
    (e) => e.status === 400,
  );
});
test("concurrent duplicate generation reservations permit at most one provider invocation", async () => {
  const f = await fixture(),
    results = await Promise.allSettled([f.gen(), f.gen()]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(f.calls, 1);
});
