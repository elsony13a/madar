import { api } from "./api.js";
import { config } from "./config.js";
export function learningTools(ctx) {
  const { dialog, esc, text, lang, toast, safe, refresh } = ctx,
    $ = (s) => document.querySelector(s),
    w = (en, ar) => (lang() === "ar" ? ar : en);
  function modal(html) {
    $("#dialog-content").innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  function courseActions(c, enrolled) {
    return `<div class="course-tools"><button class="button-outline" id="save-course">♡ ${w("Save course", "حفظ الكورس")}</button><button class="button-outline" id="course-reviews">${w("Student reviews", "تقييمات الطلاب")}</button>${enrolled ? `<button class="button-outline" id="write-review">${w("Write a review", "اكتب تقييم")}</button>` : ""}</div>`;
  }
  function bindCourse(c, enrolled) {
    $("#save-course").onclick = () =>
      safe(async () => {
        const saved = await api.saved(),
          isSaved = saved.includes(c.id);
        await api.saveCourse(c.id, !isSaved);
        $("#save-course").textContent = !isSaved
          ? w("Saved ✓", "اتحفظ ✓")
          : w("Save course", "حفظ الكورس");
      });
    $("#course-reviews").onclick = () => safe(() => reviews(c));
    if (enrolled) $("#write-review").onclick = () => reviewForm(c);
  }
  function playerActions(c, en) {
    const complete = c.lessons.every((l) => en?.completed.includes(l.id));
    return `<section class="learning-milestone"><p class="eyebrow">${w("MAKE IT COUNT", "اختبر تقدمك")}</p><h3>${w("Finish with confidence.", "اختم رحلتك بثقة.")}</h3><p>${w("Mark every lesson complete" + (c.hasQuiz || c.quiz ? ", then pass the course quiz." : "."), "علّم كل الدروس كمكتملة" + (c.hasQuiz || c.quiz ? "، وبعدها اجتز اختبار الكورس." : "."))}</p><div class="course-tools">${c.hasQuiz || c.quiz ? `<button class="button-outline" id="take-quiz" ${complete ? "" : "disabled"}>${en?.quizPassed ? "✓ " : ""}${w("Course quiz", "اختبار الكورس")}</button>` : ""}<button class="button-outline" id="get-certificate" ${complete && (!(c.hasQuiz || c.quiz) || en?.quizPassed) ? "" : "disabled"}>${w("Completion record", "شهادة الإكمال")}</button><button class="text-button" id="player-review">${w("Write a review", "اكتب تقييم")}</button></div>${en?.quizScore !== undefined ? `<p class="fine-print">${w("Best quiz score", "أفضل نتيجة")}: <bdi>${en.quizScore}%</bdi></p>` : ""}<p class="fine-print">${w("Self-paced course completion, not an accredited qualification.", "إثبات إكمال كورس ذاتي التعلم، مش مؤهل معتمد.")}</p></section>`;
  }
  function bindPlayer(c) {
    if ($("#take-quiz")) $("#take-quiz").onclick = () => safe(() => quiz(c));
    $("#get-certificate").onclick = () => certificateForm(c);
    $("#player-review").onclick = () => reviewForm(c);
  }
  async function quiz(c) {
    const q = await api.quiz(c.id);
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("COURSE KNOWLEDGE CHECK", "اختبار فهم الكورس")}</p><h2 id="dialog-title">${esc(text(c.title))}</h2><div class="test-notice">${w("Pass mark", "نسبة النجاح")}: <bdi>${q.passPercent}%</bdi>. ${w("Retry as you learn. This is not a proctored exam.", "ممكن تعيد المحاولة. ده مش امتحان مراقب.")}</div><form class="form-grid" id="quiz-form">${q.questions.map((question, i) => `<fieldset class="quiz-question"><legend>${i + 1}. ${esc(text(question.prompt))}</legend>${question.options.map((option, j) => `<label class="quiz-option"><input type="radio" name="q${i}" value="${j}" required><span>${esc(text(option))}</span></label>`).join("")}</fieldset>`).join("")}<button class="button-primary">${w("Check my answers", "اعرض نتيجتي")}</button></form></div>`,
    );
    $("#quiz-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const f = new FormData(e.target),
          result = await api.submitQuiz(
            c.id,
            q.questions.map((_, i) => Number(f.get("q" + i))),
          );
        await refresh();
        modal(
          `<div class="auth-content"><span class="auth-symbol">${result.passed ? "✳" : "↗"}</span><p class="eyebrow">${w("YOUR RESULT", "نتيجتك")}</p><h2 id="dialog-title"><bdi>${result.score}%</bdi></h2><h3>${result.passed ? w("A new milestone. Well done.", "خطوة جديدة. أحسنت.") : w("Keep going. You can try again.", "كمّل، تقدر تحاول تاني.")}</h3><p>${result.passed ? w("Your best score is saved. You can now issue your completion record.", "اتحفظت أفضل نتيجتك. تقدر تطلب شهادة الإكمال.") : w("Review the lessons and take another attempt.", "راجع الدروس وجرّب محاولة جديدة.")}</p><button class="button-primary" id="quiz-next">${result.passed ? w("View completion record", "شهادة الإكمال") : w("Try again", "حاول مرة تانية")}</button></div>`,
        );
        $("#quiz-next").onclick = () =>
          result.passed ? certificateForm(c) : safe(() => quiz(c));
      });
    };
  }
  function certificateForm(c) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("YOUR LEARNING, RECORDED", "سجّل إنجازك")}</p><h2 id="dialog-title">${w("A record of your next step.", "إثبات لخطوتك الجديدة.")}</h2><p>${esc(text(c.title))}</p><form class="form-grid" id="certificate-form"><label>${w("Learner name for this record", "اسم المتعلم في الشهادة")}<input name="learnerName" required minlength="2" maxlength="100" autocomplete="name"></label><div class="test-notice">${w("The name is self-reported and fixed after issue. Completion means all lessons marked complete" + (c.hasQuiz || c.quiz ? " and the course quiz passed." : ".") + " This is not an accredited qualification or identity verification.", "الاسم يكتبه المتعلم ويثبت بعد الإصدار. الإكمال يعني تعليم كل الدروس كمكتملة" + (c.hasQuiz || c.quiz ? " واجتياز الاختبار." : ".") + " دي مش شهادة اعتماد أو تحقق من الهوية.")}</div><button class="button-primary">${w("Issue / view my record", "إصدار أو عرض الشهادة")}</button></form></div>`,
    );
    $("#certificate-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const cert = await api.certificate(
          c.id,
          new FormData(e.target).get("learnerName"),
        );
        showCertificate(cert);
      });
    };
  }
  function showCertificate(cert) {
    const date = new Intl.DateTimeFormat(lang() === "ar" ? "ar-EG" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(cert.issuedAt));
    modal(
      `<div class="detail-content"><h2 class="sr-only" id="dialog-title">${w("Course completion record", "شهادة إكمال الكورس")}</h2><div class="completion-certificate" id="completion-certificate"><p class="certificate-brand">MADAR / مدار</p><div class="certificate-star">✳</div><p class="eyebrow">${w("COURSE COMPLETION RECORD", "شهادة إكمال كورس")}</p><h2>${esc(cert.learnerName)}</h2><p>${w("completed the self-paced course", "أكمل الكورس ذاتي التعلم")}</p><h3>${esc(text(cert.courseTitle))}</h3><div class="certificate-rule"></div><p>${esc(date)}</p><p class="fine-print">${esc(cert.criteria)}</p>${cert.quizScore !== null ? `<p class="fine-print">${w("Quiz score", "نتيجة الاختبار")}: <bdi>${cert.quizScore}%</bdi></p>` : ""}<p class="fine-print" dir="ltr">ID: ${esc(cert.id)}</p><div class="test-notice">${config.mode === "demo" ? w("LOCAL DEMO · Not accredited · No independent verification", "معاينة محلية · غير معتمدة · بدون تحقق مستقل") : w("Completion record · Not accredited", "شهادة إكمال · غير معتمدة")}<br>${w("Self-reported learner name. No public verification link is provided.", "اسم المتعلم ذاتي الإدخال. لا يوجد رابط تحقق عام.")}</div></div><button class="button-primary wide" id="download-certificate">${w("Download printable record", "تنزيل شهادة قابلة للطباعة")}</button></div>`,
    );
    $("#download-certificate").onclick = () => {
      const content = $("#completion-certificate").outerHTML,
        css = `*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f7f5ed;color:#123e36;margin:0;padding:30px}.completion-certificate{max-width:760px;margin:auto;border:2px solid #809a75;padding:55px;text-align:center;background:white;overflow-wrap:anywhere}.certificate-brand{letter-spacing:.15em;font-size:16px;font-weight:bold}.certificate-star{font-size:60px;color:#a5633d}.eyebrow{font-size:12px;letter-spacing:.1em}h2{font-size:38px;overflow-wrap:anywhere}h3{font-size:25px;line-height:1.5}.certificate-rule{height:1px;background:#bdc9b5;margin:30px}.fine-print{font-size:12px;line-height:1.7}.test-notice{font-size:11px;border:1px solid #ccc;padding:15px;margin-top:25px}@media(max-width:600px){body{padding:15px}.completion-certificate{padding:30px 20px}h2{font-size:28px}h3{font-size:22px}}@media print{body{padding:0}.completion-certificate{border:1px solid #809a75}}`,
        html =
          '<!doctype html><html lang="' +
          lang() +
          '" dir="' +
          (lang() === "ar" ? "rtl" : "ltr") +
          '"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Madar completion record</title><style>' +
          css +
          "</style>" +
          content +
          "</html>",
        blob = new Blob([html], { type: "text/html;charset=utf-8" }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "Madar-Completion-" + cert.id + ".html";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(
        w(
          "Open the downloaded file and use browser Print to save a PDF.",
          "افتح الملف ونفذ طباعة من المتصفح لو عايزه PDF.",
        ),
      );
    };
  }
  async function reviews(c) {
    const items = await api.reviews(c.id),
      average = items.length
        ? (items.reduce((s, r) => s + r.rating, 0) / items.length).toFixed(1)
        : null;
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("ENROLLED LEARNER VOICES", "آراء طلاب مشتركين")}</p><h2 id="dialog-title">${w("Reviews, not promises.", "تجارب، مش وعود.")}</h2><p>${esc(text(c.title))}</p>${average ? `<p class="review-average">★ <bdi>${average} / 5</bdi> <small>(${items.length})</small></p>` : `<p class="test-notice">${w("No approved reviews yet. No ratings have been invented.", "مفيش تقييمات معتمدة لسه. مفيش نجوم أو أرقام وهمية.")}</p>`}${items.map((r) => `<article class="dashboard-panel"><strong>${esc(r.displayName)}</strong><span class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span><p class="review-text">${esc(r.text)}</p></article>`).join("")}</div>`,
    );
  }
  function reviewForm(c) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("SHARE YOUR EXPERIENCE", "شارك تجربتك")}</p><h2 id="dialog-title">${w("What helped you learn?", "إيه اللي ساعدك تتعلم؟")}</h2><p>${esc(text(c.title))}</p><form class="form-grid" id="review-course-form"><label>${w("Public display name", "اسمك الظاهر للجميع")}<input name="displayName" required minlength="2" maxlength="60"></label><label>${w("Rating", "التقييم")}<select name="rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${n} / 5</option>`).join("")}</select></label><label>${w("Your review", "تجربتك")}<textarea name="text" required minlength="10" maxlength="2000"></textarea></label><p class="fine-print">${w("One review per enrolled learner, after at least one completed lesson. Reviews and edits are checked by the owner before appearing. Your display name and review will be visible to other signed-in learners after approval.", "تقييم واحد لكل طالب مشترك بعد إكمال درس واحد على الأقل. المالك يراجع التقييم وأي تعديل قبل ظهوره. اسمك الظاهر والتقييم سيظهران للمستخدمين المسجلين بعد الموافقة.")}</p><button class="button-primary">${w("Send for moderation", "إرسال للمراجعة")}</button></form></div>`,
    );
    $("#review-course-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const f = new FormData(e.target);
        await api.submitReview(c.id, {
          displayName: f.get("displayName"),
          rating: Number(f.get("rating")),
          text: f.get("text"),
        });
        dialog.close();
        toast(
          w("Review pending moderation.", "التقييم في انتظار مراجعة المالك."),
        );
      });
    };
  }
  async function moderation() {
    const items = await api.pendingReviews();
    modal(
      `<div class="detail-content"><p class="eyebrow">MADAR / OWNER</p><h2 id="dialog-title">${w("Review moderation", "مراجعة التقييمات")}</h2>${items.length ? items.map((r) => `<article class="dashboard-panel"><h3>${esc(text(r.courseTitle))}</h3><strong>${esc(r.displayName)}</strong><span class="review-stars">${"★".repeat(r.rating)}</span><p class="review-text">${esc(r.text)}</p><div class="course-tools"><button class="button-outline" data-moderate="${esc(r.id)}" data-decision="approved">${w("Approve", "قبول")}</button><button class="button-outline danger" data-moderate="${esc(r.id)}" data-decision="rejected">${w("Reject", "رفض")}</button></div></article>`).join("") : `<p>${w("No reviews awaiting moderation.", "مفيش تقييمات في انتظار المراجعة.")}</p>`}</div>`,
    );
    document.querySelectorAll("[data-moderate]").forEach(
      (b) =>
        (b.onclick = () =>
          safe(async () => {
            await api.moderateReview(b.dataset.moderate, b.dataset.decision);
            await moderation();
          })),
    );
  }
  return { courseActions, bindCourse, playerActions, bindPlayer, moderation };
}
