import { sampleQuiz } from "./sample-quiz.js";
import { config } from "./config.js";
import { courses as samples } from "./data.js";
import { accessToken } from "./auth.js";
const key = "madar.demo.v2";
function initial() {
  return {
    courses: structuredClone(samples),
    enrollments: [],
    payments: [],
    profile: { role: "student" },
    questions: [],
    notes: {},
    reports: [],
    saved: [],
    reviews: [],
    certificates: [],
  };
}
function read() {
  try {
    const state = JSON.parse(localStorage.getItem(key)) || initial();
    state.questions ||= [];
    state.reports ||= [];
    state.notes ||= {};
    state.saved ||= [];
    state.reviews ||= [];
    state.certificates ||= [];
    const cloud = state.courses.find((c) => c.id === "aws-foundations");
    if (cloud && cloud.quiz === undefined)
      cloud.quiz = structuredClone(sampleQuiz);
    state.courses.forEach((c) => (c.hasQuiz = !!c.quiz));
    return state;
  } catch {
    return initial();
  }
}
function write(state) {
  localStorage.setItem(key, JSON.stringify(state));
}
async function request(path, options = {}, auth = false) {
  const headers = { "content-type": "application/json", ...options.headers };
  if (auth) headers.Authorization = `Bearer ${await accessToken()}`;
  const response = await fetch(config.apiBaseUrl.replace(/\/$/, "") + path, {
    ...options,
    headers,
  });
  const result = await response
    .json()
    .catch(() => ({ message: `Request failed (${response.status})` }));
  if (!response.ok)
    throw Error(result.message || `Request failed (${response.status})`);
  return result;
}
const post = (path, body = {}) =>
  request(path, { method: "POST", body: JSON.stringify(body) }, true);
const demo = config.mode === "demo";
function localEnrollment(state, id) {
  const en = state.enrollments.find((e) => e.courseId === id);
  if (!en) throw Error("Enroll first");
  return en;
}
function localCourse(state, id) {
  const c = state.courses.find((c) => c.id === id);
  if (!c) throw Error("Course not found");
  return c;
}

export const api = {
  async aiQuizStatus(id) {
    return demo
      ? { enabled: false, simulation: true, maxQuestions: 3 }
      : request(
          `/instructor/courses/${encodeURIComponent(id)}/ai-quiz`,
          {},
          true,
        );
  },
  async generateAiQuiz(id, body) {
    if (!demo)
      return post(
        `/instructor/courses/${encodeURIComponent(id)}/ai-quiz`,
        body,
      );
    const s = read(),
      c = localCourse(s, id);
    if (c.status !== "draft") throw Error("Only editable drafts");
    const examples = [
      {
        prompt: {
          en: "Where should protected-course access be checked?",
          ar: "أين يجب التحقق من الوصول للكورس الخاص؟",
        },
        options: [
          { en: "On the backend", ar: "في السيرفر" },
          { en: "Only by hiding a button", ar: "بإخفاء الزر فقط" },
          { en: "Nowhere", ar: "لا يوجد تحقق" },
        ],
        correctIndex: 0,
      },
      {
        prompt: {
          en: "Does a receipt upload alone unlock a paid course?",
          ar: "هل رفع الإيصال وحده يفتح الكورس المدفوع؟",
        },
        options: [
          { en: "Yes, always", ar: "نعم دائمًا" },
          { en: "No, owner approval is required", ar: "لا، يجب موافقة المالك" },
          { en: "Only the filename matters", ar: "اسم الملف فقط هو المهم" },
        ],
        correctIndex: 1,
      },
      {
        prompt: {
          en: "What kind of record is the sample completion certificate?",
          ar: "ما نوع سجل الإكمال التجريبي؟",
        },
        options: [
          { en: "An accredited degree", ar: "درجة علمية معتمدة" },
          { en: "Identity verification", ar: "تحقق من الهوية" },
          { en: "A self-paced completion record", ar: "سجل إكمال ذاتي التعلم" },
        ],
        correctIndex: 2,
      },
    ];
    const proposal = {
      requestId: body.requestId,
      quiz: { passPercent: 70, questions: examples.slice(0, body.count) },
      modelId: "LOCAL HAND-WRITTEN SAMPLE",
      region: "none",
      source: JSON.stringify(c.lessons),
      courseId: id,
      notice:
        "Fixed example only, not generated from your lessons and no Bedrock request.",
    };
    s.aiProposals ||= {};
    s.aiProposals[body.requestId] = proposal;
    write(s);
    return proposal;
  },
  async adoptAiQuiz(id, requestId, reviewed) {
    if (!demo)
      return post(
        `/instructor/courses/${encodeURIComponent(id)}/ai-quiz/adopt`,
        { requestId, reviewed },
      );
    const s = read(),
      c = localCourse(s, id),
      p = s.aiProposals?.[requestId];
    if (
      !reviewed ||
      !p ||
      p.courseId !== id ||
      p.source !== JSON.stringify(c.lessons) ||
      c.status !== "draft"
    )
      throw Error("Proposal unavailable, unreviewed or lessons changed");
    c.quiz = p.quiz;
    delete s.aiProposals[requestId];
    write(s);
    return { status: "adopted" };
  },
  async submittedCourses() {
    return demo
      ? read().courses.filter((c) => c.status === "pending-review")
      : request("/admin/courses", {}, true);
  },
  async withdrawCourse(id) {
    if (!demo)
      return post(`/instructor/courses/${encodeURIComponent(id)}/withdraw`);
    const s = read(),
      c = localCourse(s, id);
    if (c.status !== "pending-review") throw Error("Submission is not pending");
    c.status = "draft";
    c.contentReviewStatus = "withdrawn";
    write(s);
    return c;
  },
  async reviewCourse(id, body) {
    if (!demo)
      return post(`/admin/courses/${encodeURIComponent(id)}/review`, body);
    const s = read(),
      c = localCourse(s, id);
    if (c.status !== "pending-review" || c.submissionId !== body.submissionId)
      throw Error("Submission changed; reopen the queue");
    if (body.decision === "approved" && !body.contentChecked)
      throw Error("Check the content first");
    Object.assign(c, {
      status: body.decision === "approved" ? "published" : "draft",
      contentReviewStatus: body.decision,
      reviewNote: body.note,
    });
    write(s);
    return c;
  },
  async reviewVideo(id, lessonId) {
    return request(
      `/admin/courses/${encodeURIComponent(id)}/lessons/${encodeURIComponent(lessonId)}/media`,
      {},
      true,
    );
  },
  async reportCourse(id, body) {
    if (!demo) return post(`/courses/${encodeURIComponent(id)}/reports`, body);
    const s = read();
    localEnrollment(s, id);
    const c = localCourse(s, id),
      r = {
        ...body,
        id: crypto.randomUUID(),
        courseId: id,
        courseTitle: c.title,
        status: "open",
        createdAt: new Date().toISOString(),
      };
    if (body.questionId) {
      const q = s.questions.find((q) => q.id === body.questionId);
      if (q)
        r.questionSnapshot = {
          title: q.title,
          text: q.text,
          reply: q.reply || null,
          displayName: q.displayName,
          status: q.status,
        };
    }
    s.reports.push(r);
    write(s);
    return r;
  },
  async reports(admin = false) {
    return demo
      ? read().reports
      : request(admin ? "/admin/reports" : "/me/reports", {}, true);
  },
  async resolveReport(id, note) {
    if (!demo)
      return post(`/admin/reports/${encodeURIComponent(id)}`, { note });
    const s = read(),
      r = s.reports.find((r) => r.id === id);
    if (!r || r.status !== "open") throw Error("Report no longer open");
    Object.assign(r, { status: "resolved", resolutionNote: note });
    write(s);
    return r;
  },
  async note(id, lessonId) {
    if (!demo)
      return request(
        `/courses/${encodeURIComponent(id)}/notes/${encodeURIComponent(lessonId)}`,
        {},
        true,
      );
    const s = read();
    localEnrollment(s, id);
    return { text: s.notes[id + "#" + lessonId] || "" };
  },
  async saveNote(id, lessonId, text) {
    if (typeof text !== "string" || text.length > 8000)
      throw Error("Maximum 8000 characters");
    if (!demo)
      return request(
        `/courses/${encodeURIComponent(id)}/notes/${encodeURIComponent(lessonId)}`,
        { method: "PUT", body: JSON.stringify({ text }) },
        true,
      );
    const s = read();
    localEnrollment(s, id);
    s.notes[id + "#" + lessonId] = text;
    write(s);
    return { text };
  },
  async questions(id) {
    if (!demo)
      return request(`/courses/${encodeURIComponent(id)}/questions`, {}, true);
    const s = read(),
      c = localCourse(s, id),
      role = sessionStorage.getItem("madar.demo.role") || "student";
    if (role === "student") localEnrollment(s, id);
    return s.questions
      .filter(
        (q) =>
          q.courseId === id &&
          (q.status === "visible" ||
            role === "instructor" ||
            role === "admin" ||
            q.demoOwner),
      )
      .map((q) => ({
        ...q,
        canReply: role === "instructor" && c.ownerSub === "demo-instructor",
      }));
  },
  async askQuestion(id, body) {
    if (!demo)
      return post(`/courses/${encodeURIComponent(id)}/questions`, body);
    const s = read();
    localEnrollment(s, id);
    if (
      body.title.trim().length < 5 ||
      body.text.trim().length < 10 ||
      body.displayName.trim().length < 2
    )
      throw Error("Add a title, question and display name");
    const q = {
      ...body,
      id: crypto.randomUUID(),
      courseId: id,
      courseTitle: localCourse(s, id).title,
      status: "visible",
      createdAt: new Date().toISOString(),
      demoOwner: true,
    };
    s.questions.push(q);
    write(s);
    return q;
  },
  async replyQuestion(id, qid, text) {
    if (!demo)
      return post(
        `/courses/${encodeURIComponent(id)}/questions/${encodeURIComponent(qid)}/reply`,
        { text },
      );
    const s = read(),
      c = localCourse(s, id),
      q = s.questions.find((q) => q.id === qid);
    if (
      c.ownerSub !== "demo-instructor" ||
      sessionStorage.getItem("madar.demo.role") !== "instructor"
    )
      throw Error("Only this course instructor can reply");
    if (q.status !== "visible") throw Error("Discussion is hidden");
    if (text.trim().length < 5 || text.length > 4000)
      throw Error("Reply must be 5-4000 characters");
    q.reply = text.trim();
    q.replyAt = new Date().toISOString();
    write(s);
    return { replied: true };
  },
  async allQuestions() {
    return demo ? read().questions : request("/admin/questions", {}, true);
  },
  async moderateQuestion(id, status) {
    if (!demo)
      return post(`/admin/questions/${encodeURIComponent(id)}`, { status });
    const s = read(),
      q = s.questions.find((q) => q.id === id);
    q.status = status;
    write(s);
    return { status };
  },
  async insights() {
    if (!demo) return request("/instructor/insights", {}, true);
    const s = read(),
      mine = s.courses.filter((c) => c.ownerSub === "demo-instructor"),
      ids = new Set(mine.map((c) => c.id)),
      payments = s.payments.filter(
        (p) => ids.has(p.courseId) && p.status === "approved",
      ),
      reviews = s.reviews.filter(
        (r) => ids.has(r.courseId) && r.status === "approved",
      );
    return {
      courseCount: mine.length,
      awaitingReview: mine.filter((c) => c.status === "pending-review").length,
      published: mine.filter((c) => c.status === "published").length,
      drafts: mine.filter((c) => c.status === "draft").length,
      approvedRequests: payments.length,
      testApprovedAmountCents: payments.reduce((n, p) => n + p.amountCents, 0),
      manualApprovedAmountCents: 0,
      approvedReviewCount: reviews.length,
      averageRating: reviews.length
        ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length
        : null,
      unansweredQuestions: s.questions.filter(
        (q) => ids.has(q.courseId) && q.status === "visible" && !q.reply,
      ).length,
      currency: "EGP",
    };
  },

  async saved() {
    return demo ? read().saved : request("/me/saved", {}, true);
  },
  async saveCourse(id, saved) {
    if (!demo) return post("/me/saved", { courseId: id, saved });
    const s = read();
    s.saved = s.saved.filter((x) => x !== id);
    if (saved) s.saved.push(id);
    write(s);
    return { saved };
  },
  async quiz(id) {
    if (!demo)
      return request(`/courses/${encodeURIComponent(id)}/quiz`, {}, true);
    const s = read();
    localEnrollment(s, id);
    const c = localCourse(s, id);
    if (!c.quiz) throw Error("No quiz");
    return {
      passPercent: c.quiz.passPercent,
      questions: c.quiz.questions.map(({ correctIndex, ...q }) => q),
    };
  },
  async submitQuiz(id, answers) {
    if (!demo)
      return post(`/courses/${encodeURIComponent(id)}/quiz`, { answers });
    const s = read(),
      c = localCourse(s, id),
      en = localEnrollment(s, id);
    if (!c.lessons.every((l) => en.completed.includes(l.id)))
      throw Error("Complete the lessons first");
    if (
      !c.quiz ||
      answers.length !== c.quiz.questions.length ||
      answers.some(
        (a, i) =>
          !Number.isInteger(a) ||
          a < 0 ||
          a >= c.quiz.questions[i].options.length,
      )
    )
      throw Error("Answer every question");
    const score = Math.round(
        (c.quiz.questions.filter((q, i) => q.correctIndex === answers[i])
          .length /
          answers.length) *
          100,
      ),
      passed = score >= c.quiz.passPercent;
    en.quizAttempts = (en.quizAttempts || 0) + 1;
    en.quizScore = Math.max(en.quizScore || 0, score);
    en.quizPassed = !!en.quizPassed || passed;
    write(s);
    return { score, passed, passPercent: c.quiz.passPercent };
  },
  async certificate(id, learnerName) {
    if (!demo)
      return post(`/courses/${encodeURIComponent(id)}/certificate`, {
        learnerName,
      });
    const s = read(),
      c = localCourse(s, id),
      en = localEnrollment(s, id);
    if (!c.lessons.every((l) => en.completed.includes(l.id)))
      throw Error("Complete every lesson first");
    if (c.quiz && !en.quizPassed) throw Error("Pass the quiz first");
    if (learnerName.trim().length < 2 || learnerName.length > 100)
      throw Error("Enter a 2-100 character name");
    let cert = s.certificates.find((x) => x.courseId === id);
    if (!cert) {
      cert = {
        id: crypto.randomUUID(),
        courseId: id,
        courseTitle: c.title,
        learnerName: learnerName.trim(),
        issuedAt: new Date().toISOString(),
        quizScore: en.quizScore ?? null,
        criteria: c.quiz
          ? "All lessons marked complete and course quiz passed"
          : "All lessons marked complete",
        notice:
          "Local demo completion record only. Not accredited. Name is self-reported.",
        demo: true,
      };
      s.certificates.push(cert);
      write(s);
    }
    return cert;
  },
  async reviews(id) {
    return demo
      ? read().reviews.filter(
          (x) => x.courseId === id && x.status === "approved",
        )
      : request(`/courses/${encodeURIComponent(id)}/reviews`, {}, true);
  },
  async submitReview(id, body) {
    if (!demo)
      return request(
        `/courses/${encodeURIComponent(id)}/reviews`,
        { method: "PUT", body: JSON.stringify(body) },
        true,
      );
    const s = read(),
      en = localEnrollment(s, id),
      c = localCourse(s, id);
    if (!en.completed.length) throw Error("Complete at least one lesson first");
    if (
      c.ownerSub === "demo-instructor" &&
      sessionStorage.getItem("madar.demo.role") === "instructor"
    )
      throw Error("You cannot review your own course");
    if (
      !Number.isInteger(body.rating) ||
      body.rating < 1 ||
      body.rating > 5 ||
      body.text.trim().length < 10 ||
      body.displayName.trim().length < 2
    )
      throw Error(
        "Add a rating, public name and review of at least 10 characters",
      );
    const old = s.reviews.find((x) => x.courseId === id);
    if (old) Object.assign(old, body, { status: "pending" });
    else
      s.reviews.push({
        ...body,
        id: crypto.randomUUID(),
        courseId: id,
        courseTitle: c.title,
        status: "pending",
        updatedAt: new Date().toISOString(),
      });
    write(s);
    return { status: "pending" };
  },
  async pendingReviews() {
    return demo
      ? read().reviews.filter((r) => r.status === "pending")
      : request("/admin/reviews", {}, true);
  },
  async moderateReview(id, decision) {
    if (!demo)
      return post(`/admin/reviews/${encodeURIComponent(id)}`, { decision });
    const s = read(),
      r = s.reviews.find((r) => r.id === id);
    r.status = decision;
    write(s);
    return { status: decision };
  },
  async updateDetails(id, body) {
    if (!demo)
      return request(
        `/instructor/courses/${encodeURIComponent(id)}/details`,
        { method: "PUT", body: JSON.stringify(body) },
        true,
      );
    const s = read(),
      c = localCourse(s, id);
    if (c.status !== "published")
      throw Error("Only published course details may be edited here");
    Object.assign(c, body);
    write(s);
    return c;
  },

  async me() {
    return demo
      ? { ...read().profile, sub: "demo-student", needsRole: false }
      : request("/me", {}, true);
  },
  async role(role) {
    if (!["student", "instructor"].includes(role))
      throw Error("Invalid account type");
    if (!demo) return post("/me/role", { role });
    const s = read();
    s.profile.role = role;
    write(s);
    return { role };
  },
  async list() {
    return demo
      ? read().courses.filter((c) => !c.status || c.status === "published")
      : request("/courses");
  },
  async detail(id) {
    return demo
      ? read().courses.find((c) => c.id === id)
      : request(`/courses/${encodeURIComponent(id)}`);
  },
  async enrollments() {
    return demo ? read().enrollments : request("/me/enrollments", {}, true);
  },
  async enroll(id) {
    if (!demo) return post(`/courses/${encodeURIComponent(id)}/enroll`);
    const s = read(),
      c = s.courses.find((c) => c.id === id);
    if (c.priceCents !== 0)
      throw Error("Approval is required for a paid course");
    let item = s.enrollments.find((x) => x.courseId === id);
    if (!item) {
      item = {
        courseId: id,
        completed: [],
        enrolledAt: new Date().toISOString(),
      };
      s.enrollments.push(item);
      write(s);
    }
    return item;
  },
  async progress(id, lessonId) {
    if (!demo)
      return request(
        `/courses/${encodeURIComponent(id)}/progress`,
        { method: "PUT", body: JSON.stringify({ lessonId }) },
        true,
      );
    const s = read(),
      item = s.enrollments.find((x) => x.courseId === id);
    if (!item) throw Error("Enroll before saving progress.");
    if (!item.completed.includes(lessonId)) item.completed.push(lessonId);
    write(s);
    return item;
  },
  async media(id, lessonId) {
    return request(
      `/courses/${encodeURIComponent(id)}/lessons/${encodeURIComponent(lessonId)}/media`,
      {},
      true,
    );
  },
  async paymentMethod() {
    return demo
      ? {
          enabled: true,
          mode: "test",
          instructions:
            "TEST WORKFLOW ONLY. Do not transfer money. Select a sample receipt image to test the review journey.",
          currency: "EGP",
        }
      : request("/payment-method", {}, true);
  },
  async payments(admin = false) {
    return demo
      ? read().payments
      : request(admin ? "/admin/payments" : "/me/payments", {}, true);
  },
  async submitPayment(courseId, file) {
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      throw Error("Choose a JPG or PNG, maximum 5 MB.");
    if (!demo) {
      const r = await post(
        `/courses/${encodeURIComponent(courseId)}/payments`,
        { contentType: file.type },
      );
      await upload(r.upload, file);
      return post(`/payments/${encodeURIComponent(r.id)}/submit`);
    }
    if (file.size > 1024 * 1024)
      throw Error("Local demo receipts must be below 1 MB. AWS limit is 5 MB.");
    const receipt = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const s = read(),
      c = s.courses.find((c) => c.id === courseId),
      id = crypto.randomUUID();
    s.payments.push({
      id,
      courseId,
      courseTitle: c.title,
      userSub: "demo-student",
      amountCents: c.priceCents,
      currency: "EGP",
      mode: "test",
      status: "pending",
      createdAt: new Date().toISOString(),
      receipt,
    });
    write(s);
    return { id, status: "pending" };
  },
  async receipt(id) {
    return demo
      ? { url: read().payments.find((p) => p.id === id)?.receipt }
      : request(`/admin/payments/${encodeURIComponent(id)}/receipt`, {}, true);
  },
  async review(id, decision, note, verifiedTransfer, testMode = false) {
    if (!demo)
      return post(`/admin/payments/${encodeURIComponent(id)}/review`, {
        decision,
        note,
        ...(testMode
          ? { verifiedTest: verifiedTransfer }
          : { verifiedTransfer }),
      });
    if (note.trim().length < 3) throw Error("Add a review note.");
    if (decision === "approved" && !verifiedTransfer)
      throw Error("Confirm manual verification.");
    const s = read(),
      p = s.payments.find((p) => p.id === id);
    if (p.status !== "pending")
      throw Error("This request has already been reviewed.");
    p.status = decision;
    p.reviewNote = note;
    if (
      decision === "approved" &&
      !s.enrollments.some((e) => e.courseId === p.courseId)
    )
      s.enrollments.push({
        courseId: p.courseId,
        completed: [],
        enrolledAt: new Date().toISOString(),
      });
    write(s);
    return p;
  },
  async instructorCourses() {
    return demo
      ? read().courses.filter((c) => c.ownerSub === "demo-instructor")
      : request("/instructor/courses", {}, true);
  },
  async createCourse(body) {
    if (!demo) return post("/instructor/courses", body);
    const s = read(),
      id = crypto.randomUUID(),
      c = {
        ...body,
        id,
        status: "draft",
        ownerSub: "demo-instructor",
        color: {
          Cloud: "cloud",
          Design: "design",
          Development: "code",
          Data: "data",
          Business: "product",
        }[body.category],
        hours: body.lessons.reduce((n, l) => n + l.minutes, 0) + " min",
        tag: { en: "NEW PERSPECTIVE", ar: "منظور جديد" },
        lessons: body.lessons.map((l, i) => ({
          ...l,
          id: "lesson-" + (i + 1),
        })),
      };
    s.courses.push(c);
    write(s);
    return c;
  },
  async updateCourse(id, body) {
    if (!demo)
      return request(
        `/instructor/courses/${encodeURIComponent(id)}`,
        { method: "PUT", body: JSON.stringify(body) },
        true,
      );
    const s = read(),
      c = s.courses.find((c) => c.id === id);
    if (c.status !== "draft") throw Error("Only drafts may be edited");
    Object.assign(c, body);
    write(s);
    return c;
  },
  async publish(id) {
    if (!demo)
      return post(`/instructor/courses/${encodeURIComponent(id)}/publish`);
    const s = read(),
      c = s.courses.find((c) => c.id === id);
    if (c.status !== "draft") throw Error("Only drafts may be submitted");
    c.status = "pending-review";
    c.submissionId = crypto.randomUUID();
    c.contentReviewStatus = "pending";
    write(s);
    return c;
  },
  async uploadVideo(id, file) {
    if (demo)
      throw Error(
        "Video upload needs AWS mode. Use a text lesson in the local demo.",
      );
    if (
      !["video/mp4", "video/webm"].includes(file.type) ||
      file.size > 100 * 1024 * 1024
    )
      throw Error("Use MP4 or WebM, maximum 100 MB.");
    const r = await post(
      `/instructor/courses/${encodeURIComponent(id)}/media-upload`,
      { contentType: file.type },
    );
    await upload(r, file);
    return r.key;
  },
};
async function upload(target, file) {
  const form = new FormData();
  Object.entries(target.fields).forEach(([k, v]) => form.append(k, v));
  form.append("file", file);
  const r = await fetch(target.url, { method: "POST", body: form });
  if (!r.ok) throw Error(`Upload failed (${r.status})`);
}
