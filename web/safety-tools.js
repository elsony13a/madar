import { api } from "./api.js";
export function safetyTools({ dialog, esc, text, lang, toast, safe, refresh }) {
  const $ = (s) => document.querySelector(s),
    w = (en, ar) => (lang() === "ar" ? ar : en);
  function modal(html) {
    $("#dialog-content").innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  const bilingual = (v) =>
    `<div class="bilingual-review"><p dir="ltr">${esc(v?.en || "")}</p><p dir="rtl">${esc(v?.ar || "")}</p></div>`;
  async function queue() {
    const rows = await api.submittedCourses();
    modal(
      `<div class="detail-content"><p class="eyebrow">MADAR / OWNER</p><h2 id="dialog-title">${w("Course publication review", "مراجعة نشر الكورسات")}</h2><p class="test-notice">${w("Courses stay out of the catalogue until approved by a separate owner account. This is human content review, not malware scanning or legal clearance. Published metadata changes are not reviewed again in this version.", "الكورس مش بيظهر في الكتالوج قبل موافقة حساب مالك منفصل. دي مراجعة بشرية للمحتوى، مش فحص ملفات ضارة أو تصريح قانوني. تعديل بيانات الكورس بعد النشر لا يمر بالمراجعة مرة أخرى في النسخة دي.")}</p>${rows.length ? rows.map((c) => `<article class="dashboard-panel"><h3 dir="auto">${esc(text(c.title))}</h3><p>${esc(c.author)} · ${c.lessons.length} ${w("lessons", "دروس")}</p><button class="button-outline" data-review-course="${esc(c.id)}">${w("Read submitted content", "قراءة المحتوى المرسل")}</button></article>`).join("") : `<p>${w("No courses awaiting review.", "مفيش كورسات قيد المراجعة.")}</p>`}</div>`,
    );
    document
      .querySelectorAll("[data-review-course]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            submission(rows.find((c) => c.id === b.dataset.reviewCourse))),
      );
  }
  function submission(c) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("LOCKED SUBMISSION", "محتوى مرسل ومقفل للتعديل")}</p><h2 id="dialog-title">${w("Read before publishing.", "اقرأ قبل النشر.")}</h2>${bilingual(c.title)}${bilingual(c.subtitle)}<p dir="auto">${esc(c.author)} · EGP ${(c.priceCents / 100).toFixed(2)}</p>${c.lessons.map((l) => `<section class="dashboard-panel">${bilingual(l.title)}${l.type === "text" ? bilingual(l.body) : `<button class="button-outline" data-review-video="${esc(l.id)}">${w("Play submitted video", "تشغيل الفيديو المرسل")}</button><div id="video-${esc(l.id)}"></div>`}</section>`).join("")}${c.quiz ? `<section class="dashboard-panel"><h3>${w("Quiz and answer key", "الاختبار ومفتاح الإجابة")} · ${c.quiz.passPercent}%</h3>${c.quiz.questions.map((q) => `${bilingual(q.prompt)}<ol>${q.options.map((o, i) => `<li>${i === q.correctIndex ? "✓ " : ""}${bilingual(o)}</li>`).join("")}</ol>`).join("")}</section>` : ""}<form id="course-review-form" class="form-grid"><label>${w("Note to the instructor", "ملاحظة تظهر للمدرّس")}<textarea dir="auto" name="note" minlength="3" maxlength="1000" required rows="4"></textarea></label><label class="check-row"><input type="checkbox" name="checked">${w("I checked the bilingual lesson content and available video/quiz content. Approval is my review decision, not an automated safety guarantee.", "راجعت محتوى الدروس باللغتين والفيديو والاختبار الموجودين. الموافقة قرار مراجعة مني وليست ضمان أمان آلي.")}</label><div class="actions"><button class="button-primary" name="decision" value="approved">${w("Approve and publish", "موافقة ونشر")}</button><button class="button-outline" name="decision" value="rejected">${w("Return to draft", "إرجاع للمسودة")}</button></div></form></div>`,
    );
    document.querySelectorAll("[data-review-video]").forEach(
      (b) =>
        (b.onclick = () =>
          safe(async () => {
            const r = await api.reviewVideo(c.id, b.dataset.reviewVideo);
            const container = document.getElementById(
              "video-" + b.dataset.reviewVideo,
            );
            container.innerHTML = `<video class="review-video" controls src="${esc(r.url)}"></video>`;
          })),
    );
    $("#course-review-form").onsubmit = (e) => {
      e.preventDefault();
      const decision = e.submitter.value;
      safe(async () => {
        const f = new FormData(e.target);
        await api.reviewCourse(c.id, {
          decision,
          note: f.get("note"),
          contentChecked: f.has("checked"),
          submissionId: c.submissionId,
        });
        await refresh();
        await queue();
        toast(w("Course review saved", "اتحفظت مراجعة الكورس"));
      });
    };
  }
  function report(c, questionId = null) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("LEARNER SAFETY", "أمان المتعلم")}</p><h2 id="dialog-title">${w("Report a concern", "الإبلاغ عن مشكلة")}</h2><p dir="auto">${esc(text(c.title))}</p><p class="test-notice">${w("The platform owner receives this report and your account identity. It is not sent to the instructor or other learners through this app. This is not emergency support, legal advice or a promise of response time. No automatic refund, removal or access change. Demo roles share browser storage.", "مالك المنصة يشوف البلاغ وهوية حسابك. التطبيق لا يرسله للمدرّس أو لباقي الطلاب. ده مش دعم طوارئ أو استشارة قانونية أو وعد بوقت رد. مفيش استرداد أو حذف أو تغيير صلاحيات تلقائي. أدوار المعاينة بتشترك في بيانات المتصفح.")}</p><form id="report-form" class="form-grid"><label>${w("Reason", "السبب")}<select name="reason"><option value="content">${w("Harmful or misleading content", "محتوى ضار أو مضلل")}</option><option value="harassment">${w("Harassment or abuse", "تحرش أو إساءة")}</option><option value="copyright">${w("Copyright concern", "مشكلة حقوق نشر")}</option><option value="other">${w("Other", "سبب آخر")}</option></select></label><label>${w("What should the owner review?", "إيه اللي محتاج مراجعة المالك؟")}<textarea name="details" dir="auto" minlength="10" maxlength="2000" required rows="6"></textarea></label><small>${w("Do not include passwords, payment credentials or sensitive personal records.", "متكتبش كلمات سر أو بيانات دفع سرية أو سجلات شخصية حساسة.")}</small><button class="button-primary">${w("Send report to owner", "إرسال البلاغ للمالك")}</button></form></div>`,
    );
    $("#report-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const f = new FormData(e.target);
        await api.reportCourse(c.id, {
          reason: f.get("reason"),
          details: f.get("details"),
          ...(questionId ? { questionId } : {}),
        });
        await reports(false);
        toast(w("Report recorded", "اتسجل البلاغ"));
      });
    };
  }
  const reasonLabel = (r) =>
    ({
      content: w("Harmful or misleading content", "محتوى ضار أو مضلل"),
      harassment: w("Harassment or abuse", "تحرش أو إساءة"),
      copyright: w("Copyright concern", "مشكلة حقوق نشر"),
      other: w("Other", "سبب آخر"),
    })[r] || r;
  async function reports(admin = false) {
    const rows = await api.reports(admin);
    modal(
      `<div class="detail-content"><p class="eyebrow">MADAR / ${admin ? "OWNER" : "LEARNER"}</p><h2 id="dialog-title">${admin ? w("Learner reports", "بلاغات الطلاب") : w("My reports", "بلاغاتي")}</h2><p class="fine-print">${w("Resolving a report records a note visible to its reporter. It does not hide content, refund money or revoke access. Use the separate moderation controls when appropriate.", "إغلاق البلاغ يسجل ملاحظة تظهر لصاحبه. لا يخفي المحتوى أو يسترد أموالًا أو يلغي الاشتراك. استخدم أدوات المراجعة المنفصلة عند الحاجة.")}</p>${rows.length ? rows.map((r) => `<article class="dashboard-panel"><h3 dir="auto">${esc(text(r.courseTitle))}</h3><span class="status-badge">${r.status === "open" ? w("Open", "مفتوح") : w("Resolved", "تمت المراجعة")}</span><p>${esc(reasonLabel(r.reason))}${r.questionId ? " · " + w("Course discussion", "نقاش الكورس") : ""}</p><p class="review-text" dir="auto">${esc(r.details)}</p>${admin && r.userSub ? `<small>${w("Reporter account ID", "معرف حساب صاحب البلاغ")}: <bdi>${esc(r.userSub)}</bdi></small>` : ""}${r.questionSnapshot ? `<section class="reported-snapshot"><p class="eyebrow">${w("DISCUSSION SNAPSHOT AT REPORT TIME", "نسخة النقاش وقت البلاغ")}</p><h4 dir="auto">${esc(r.questionSnapshot.title)}</h4><p class="review-text" dir="auto">${esc(r.questionSnapshot.text)}</p>${r.questionSnapshot.reply ? `<p class="review-text" dir="auto">${esc(r.questionSnapshot.reply)}</p>` : ""}</section>` : ""}${r.resolutionNote ? `<div class="instructor-answer"><p class="review-text" dir="auto">${esc(r.resolutionNote)}</p></div>` : ""}${admin && r.status === "open" ? `<form class="form-grid" data-resolve-report="${esc(r.id)}"><label>${w("Note visible to the reporter", "ملاحظة تظهر لصاحب البلاغ")}<textarea dir="auto" name="note" minlength="3" maxlength="1000" required></textarea></label><button class="button-outline">${w("Record resolution", "تسجيل نتيجة المراجعة")}</button></form>` : ""}</article>`).join("") : `<p>${w("No reports recorded.", "مفيش بلاغات مسجلة.")}</p>`}</div>`,
    );
    document.querySelectorAll("[data-resolve-report]").forEach(
      (f) =>
        (f.onsubmit = (e) => {
          e.preventDefault();
          safe(async () => {
            await api.resolveReport(
              f.dataset.resolveReport,
              new FormData(f).get("note"),
            );
            await reports(true);
          });
        }),
    );
  }
  return { queue, report, reports };
}
