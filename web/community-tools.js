import { api } from "./api.js";
import { config } from "./config.js";
export function communityTools({
  dialog,
  esc,
  text,
  lang,
  toast,
  safe,
  reportConcern,
}) {
  const $ = (s) => document.querySelector(s),
    w = (en, ar) => (lang() === "ar" ? ar : en),
    money = (n) =>
      new Intl.NumberFormat(lang() === "ar" ? "ar-EG" : "en-EG", {
        style: "currency",
        currency: "EGP",
      }).format(n / 100);
  function modal(html) {
    $("#dialog-content").innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  async function notes(c, lesson) {
    const note = await api.note(c.id, lesson.id);
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("YOUR PRIVATE NOTEBOOK", "دفترك الخاص")}</p><h2 id="dialog-title">${esc(text(lesson.title))}</h2><p class="test-notice">${w("Only your account can read this note through the app. Do not put passwords, payment details or sensitive personal data here.", "الملاحظة خاصة بحسابك داخل التطبيق. متكتبش كلمات سر أو بيانات دفع أو معلومات شخصية حساسة هنا.")}${config.mode === "demo" ? "<br>" + w("Local demo roles share this browser. This is not private from someone using the same browser.", "أدوار المعاينة تشترك في نفس المتصفح، فالملاحظة مش مخفية عن اللي بيستخدم نفس المتصفح.") : ""}</p><form class="form-grid" id="note-form"><label>${w("Ideas, questions and next steps", "أفكارك وأسئلتك وخطواتك القادمة")}<textarea dir="auto" name="text" maxlength="8000" rows="10">${esc(note.text)}</textarea></label><small id="note-count">${note.text.length} / 8000</small><button class="button-primary">${w("Save my note", "حفظ ملاحظتي")}</button><p class="fine-print">${w("Manual save. Clear the text and save to remove its contents. Notes are not sent to the instructor.", "الحفظ يدوي. امسح النص واحفظ لمسح المحتوى. الملاحظات لا تُرسل للمدرّس.")}</p></form></div>`,
    );
    $("#note-form textarea").oninput = (e) =>
      ($("#note-count").textContent = e.target.value.length + " / 8000");
    $("#note-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        await api.saveNote(c.id, lesson.id, new FormData(e.target).get("text"));
        toast(w("Private note saved", "اتحفظت الملاحظة"));
      });
    };
  }
  async function questions(c, instructor = false) {
    const rows = await api.questions(c.id);
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("LEARN TOGETHER", "نتعلم مع بعض")}</p><h2 id="dialog-title">${w("Course questions", "أسئلة الكورس")}</h2><p>${esc(text(c.title))}</p><div class="test-notice">${w("Your display name and question are visible to enrolled learners and the course instructor. The owner can hide inappropriate discussions. Do not share secrets or personal contact details.", "اسمك الظاهر وسؤالك بيظهروا للطلاب المشتركين ومدرّس الكورس. المالك يقدر يخفي النقاشات غير المناسبة. متشاركش أسرار أو بيانات تواصل شخصية.")}</div>${instructor ? "" : `<button class="button-primary" id="ask-question">+ ${w("Ask a question", "اسأل سؤال")}</button>`}<div>${rows.length ? rows.map((q) => `<article class="dashboard-panel question-thread"><div class="question-heading"><h3 dir="auto">${esc(q.title)}</h3><span class="status-badge">${q.reply ? w("Answered", "تم الرد") : w("Open", "مفتوح")}${q.status === "hidden" ? " · " + w("Hidden", "مخفي") : ""}</span></div><small>${esc(q.displayName)}</small>${q.status === "hidden" ? `<p class="test-notice">${w("The owner hid this discussion. It is not shown to other learners.", "المالك أخفى النقاش. مش بيظهر لباقي الطلاب.")}</p>` : ""}<p class="review-text" dir="auto">${esc(q.text)}</p>${q.reply ? `<div class="instructor-answer"><p class="eyebrow">${w("INSTRUCTOR RESPONSE", "رد المدرّس")}</p><p class="review-text" dir="auto">${esc(q.reply)}</p></div>` : ""}${!instructor ? `<button class="text-button" data-report-question="${esc(q.id)}">${w("Report concern", "الإبلاغ عن مشكلة")}</button>` : ""}${q.canReply && q.status === "visible" ? `<button class="button-outline" data-reply-question="${esc(q.id)}">${q.reply ? w("Update reply", "تعديل الرد") : w("Reply", "الرد")}</button>` : ""}</article>`).join("") : `<p class="dashboard-empty">${w("No questions yet. A clear question can help everyone learn.", "مفيش أسئلة لسه. السؤال الواضح ممكن يفيد الكل.")}</p>`}</div></div>`,
    );
    document
      .querySelectorAll("[data-report-question]")
      .forEach(
        (b) => (b.onclick = () => reportConcern(c, b.dataset.reportQuestion)),
      );
    if ($("#ask-question")) $("#ask-question").onclick = () => askForm(c);
    document.querySelectorAll("[data-reply-question]").forEach(
      (b) =>
        (b.onclick = () =>
          replyForm(
            c,
            rows.find((q) => q.id === b.dataset.replyQuestion),
          )),
    );
  }
  function askForm(c) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("A QUESTION IS A GOOD START", "السؤال بداية كويسة")}</p><h2 id="dialog-title">${w("What are you working through?", "إيه اللي محتاج تفهمه؟")}</h2><form class="form-grid" id="question-form"><label>${w("Public display name", "اسم العرض في النقاش")}<input dir="auto" name="displayName" minlength="2" maxlength="60" required></label><label>${w("Question title", "عنوان السؤال")}<input dir="auto" name="title" minlength="5" maxlength="180" required></label><label>${w("Context and your question", "التفاصيل والسؤال")}<textarea dir="auto" name="text" minlength="10" maxlength="4000" required rows="6"></textarea></label><p class="fine-print">${w("Visible to enrolled learners and the instructor. This is not private support or a promise of a reply time.", "ظاهر للطلاب المشتركين والمدرّس. ده مش دعم خاص ولا وعد بوقت رد.")}</p><button class="button-primary">${w("Post question", "نشر السؤال")}</button></form></div>`,
    );
    $("#question-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const f = new FormData(e.target);
        await api.askQuestion(c.id, {
          displayName: f.get("displayName"),
          title: f.get("title"),
          text: f.get("text"),
        });
        await questions(c);
        toast(w("Question posted", "اتنشر السؤال"));
      });
    };
  }
  function replyForm(c, q) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("INSTRUCTOR RESPONSE", "رد المدرّس")}</p><h2 id="dialog-title" dir="auto">${esc(q.title)}</h2><p class="review-text" dir="auto">${esc(q.text)}</p><form class="form-grid" id="reply-form"><label>${w("Reply to the course discussion", "ردك في نقاش الكورس")}<textarea dir="auto" name="text" required minlength="5" maxlength="4000" rows="7">${esc(q.reply || "")}</textarea></label><button class="button-primary">${w("Save instructor reply", "حفظ رد المدرّس")}</button></form></div>`,
    );
    $("#reply-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        await api.replyQuestion(c.id, q.id, new FormData(e.target).get("text"));
        await questions(c, true);
      });
    };
  }
  async function moderation() {
    const rows = await api.allQuestions();
    modal(
      `<div class="detail-content"><p class="eyebrow">MADAR / OWNER</p><h2 id="dialog-title">${w("Discussion moderation", "مراجعة النقاشات")}</h2><p class="fine-print">${w("Hide or restore the whole thread, including instructor replies. This is not deletion or an abuse-reporting system.", "إخفاء أو استعادة النقاش كاملًا بما فيه ردود المدرّس. ده مش حذف نهائي أو نظام بلاغات إساءة.")}</p>${rows.length ? rows.map((q) => `<article class="dashboard-panel"><p class="eyebrow">${esc(text(q.courseTitle))}</p><h3 dir="auto">${esc(q.title)}</h3><small>${esc(q.displayName)}</small><p class="review-text" dir="auto">${esc(q.text)}</p>${q.reply ? `<div class="instructor-answer"><p class="review-text" dir="auto">${esc(q.reply)}</p></div>` : ""}<button class="button-outline" data-moderate-question="${esc(q.id)}" data-status="${q.status === "visible" ? "hidden" : "visible"}">${q.status === "visible" ? w("Hide discussion", "إخفاء النقاش") : w("Restore discussion", "استعادة النقاش")}</button></article>`).join("") : `<p>${w("No discussions yet.", "مفيش نقاشات لسه.")}</p>`}</div>`,
    );
    document.querySelectorAll("[data-moderate-question]").forEach(
      (b) =>
        (b.onclick = () =>
          safe(async () => {
            await api.moderateQuestion(
              b.dataset.moderateQuestion,
              b.dataset.status,
            );
            await moderation();
          })),
    );
  }
  async function insights() {
    const data = await api.insights();
    const metrics = [
      [w("Your courses", "كورساتك"), data.courseCount],
      [w("Published", "منشور"), data.published],
      [w("Drafts", "مسودات"), data.drafts],
      [w("Awaiting review", "قيد المراجعة"), data.awaitingReview],
      [w("Unanswered questions", "أسئلة بدون رد"), data.unansweredQuestions],
      [w("Approved reviews", "تقييمات مقبولة"), data.approvedReviewCount],
      [
        w("Average approved rating", "متوسط التقييمات المقبولة"),
        data.averageRating === null
          ? w("Not available", "غير متاح")
          : data.averageRating.toFixed(1) + " / 5",
      ],
      [
        w("Approved payment requests", "طلبات دفع مقبولة"),
        data.approvedRequests,
      ],
    ];
    modal(
      `<div class="detail-content"><p class="eyebrow">MADAR / STUDIO</p><h2 id="dialog-title">${w("Know where you stand.", "اعرف وضع كورساتك.")}</h2><div class="insights-grid">${metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong><bdi>${value}</bdi></strong></div>`).join("")}</div><div class="dashboard-panel"><p>${w("Approved TEST request amounts", "مجموع مبالغ الطلبات التجريبية المقبولة")}: <strong><bdi>${money(data.testApprovedAmountCents)}</bdi></strong></p><p>${w("Approved MANUAL request amounts", "مجموع مبالغ الطلبات اليدوية المقبولة")}: <strong><bdi>${money(data.manualApprovedAmountCents)}</bdi></strong></p></div><div class="test-notice">${w("These are stored request snapshots, not verified revenue, provider settlement, earnings or payouts. Free enrollments are not counted here. No money moves from this dashboard.", "دي بيانات طلبات محفوظة، مش إيراد مؤكد أو تسوية من مزود دفع أو أرباح أو تحويلات. الاشتراكات المجانية مش محسوبة هنا. اللوحة مش بتحول فلوس.")}</div></div>`,
    );
  }
  return { notes, questions, moderation, insights };
}
