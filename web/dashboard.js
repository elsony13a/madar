import { aiQuizTools } from "./ai-quiz-tools.js";
import { quizAuthoring } from "./quiz-authoring.js";
import { api } from "./api.js";
import { config } from "./config.js";
export function dashboards(ctx) {
  const {
      main,
      dialog,
      esc,
      text,
      lang: language,
      toast,
      safe,
      refresh,
      getRole,
      setRole,
      moderateReviews,
      community,
      safety,
    } = ctx,
    $ = (s) => document.querySelector(s),
    ar = () => language() === "ar",
    w = (en, arabic) => (ar() ? arabic : en);
  const money = (n) =>
    new Intl.NumberFormat(ar() ? "ar-EG" : "en-EG", {
      style: "currency",
      currency: "EGP",
    }).format(n / 100);
  const aiTools = aiQuizTools({
    dialog,
    esc,
    lang: language,
    safe,
    toast,
    onAdopt: () => show("instructor"),
  });
  function modal(content) {
    $("#dialog-content").innerHTML = content;
    if (!dialog.open) dialog.showModal();
  }
  async function show(kind) {
    main.innerHTML = `<section class="section"><p>${w("Loading…", "جاري التحميل…")}</p></section>`;
    if (kind === "instructor") {
      const items = await api.instructorCourses();
      main.innerHTML = `<section class="section">${tabs()}<div class="dashboard-top"><div><p class="eyebrow">MADAR / STUDIO</p><h1 class="page-title">${w("Teach what you know.", "شارك اللي تعرفه.")}</h1><p class="muted">${w("Build a bilingual draft. Submit it for owner review before publication.", "اكتب مسودة باللغتين، وابعته لمراجعة المالك قبل النشر.")}</p></div><button class="button-outline" id="instructor-insights">${w("Course insights", "ملخص الكورسات")}</button><button class="button-primary" id="new-course">+ ${w("Create a course", "كورس جديد")}</button></div><div class="test-notice">${w("Published lesson content and quizzes stay fixed to protect learner progress. You can update the title, description and price. Private video uploads require AWS.", "محتوى الدروس والاختبار ثابت بعد النشر للحفاظ على تقدم الطلاب. تقدر تعدّل العنوان والوصف والسعر. الفيديو الخاص يحتاج AWS.")}</div><div class="dashboard-panel">${items.length ? items.map((c) => `<div class="request-row"><div><strong>${esc(text(c.title))}</strong><small>${esc(c.language.toUpperCase())} · ${money(c.priceCents)} · ${c.lessons.length} ${w("lessons", "دروس")}</small>${c.reviewNote ? `<small class="review-text" dir="auto">${esc(c.reviewNote)}</small>` : ""}</div><div class="actions"><span class="status-badge">${status(c.status)}</span>${c.status === "pending-review" ? `<button class="button-outline" data-withdraw="${esc(c.id)}">${w("Withdraw to edit", "سحب الطلب للتعديل")}</button>` : ""}${c.status === "published" ? `<button class="button-outline" data-instructor-questions="${esc(c.id)}">${w("Questions", "الأسئلة")}</button>` : ""}${c.status === "published" ? `<button class="button-outline" data-edit-details="${esc(c.id)}">${w("Edit details / price", "تعديل البيانات والسعر")}</button>` : ""}${c.status === "draft" ? `<button class="button-outline" data-ai-quiz="${esc(c.id)}">${w("Bedrock quiz draft", "مسودة اختبار Bedrock")}</button><button class="button-outline" data-preview-draft="${esc(c.id)}">${w("Review draft", "مراجعة المسودة")}</button><button class="button-outline" data-edit-draft="${esc(c.id)}">${w("Edit", "تعديل")}</button><button class="button-outline" data-publish="${esc(c.id)}">${w("Submit for review", "إرسال للمراجعة")}</button>` : ""}</div></div>`).join("") : `<p class="dashboard-empty">${w("Your first course starts here.", "أول كورس ليك يبدأ هنا.")}</p>`}</div></section>`;
      bindTabs();
      main
        .querySelectorAll("[data-ai-quiz]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              safe(() =>
                aiTools.open(items.find((c) => c.id === b.dataset.aiQuiz)),
              )),
        );
      main.querySelectorAll("[data-withdraw]").forEach(
        (b) =>
          (b.onclick = () =>
            safe(async () => {
              await api.withdrawCourse(b.dataset.withdraw);
              await show("instructor");
            })),
      );
      main
        .querySelectorAll("[data-edit-details]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              editDetails(items.find((c) => c.id === b.dataset.editDetails))),
        );
      $("#instructor-insights").onclick = () =>
        safe(() => community.insights());
      main.querySelectorAll("[data-instructor-questions]").forEach(
        (b) =>
          (b.onclick = () =>
            safe(() =>
              community.questions(
                items.find((c) => c.id === b.dataset.instructorQuestions),
                true,
              ),
            )),
      );
      $("#new-course").onclick = () => courseForm();
      main
        .querySelectorAll("[data-preview-draft]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              previewDraft(items.find((c) => c.id === b.dataset.previewDraft))),
        );
      main
        .querySelectorAll("[data-edit-draft]")
        .forEach(
          (b) =>
            (b.onclick = () =>
              courseForm(items.find((c) => c.id === b.dataset.editDraft))),
        );
      main.querySelectorAll("[data-publish]").forEach(
        (b) =>
          (b.onclick = () =>
            safe(async () => {
              await api.publish(b.dataset.publish);
              await refresh();
              await show("instructor");
              toast(w("Submitted for owner review", "اترسل لمراجعة المالك"));
            })),
      );
      return;
    }
    const admin = kind === "admin",
      items = await api.payments(admin);
    main.innerHTML = `<section class="section">${tabs()}<p class="eyebrow">${admin ? "MADAR / OWNER" : w("MY ACCOUNT", "حسابي")}</p><h1 class="page-title">${admin ? w("Payment review", "مراجعة طلبات الدفع") : w("Your payment requests", "طلبات الدفع الخاصة بك")}</h1>${admin ? `<button class="button-outline" id="publication-queue">${w("Review course publications", "مراجعة نشر الكورسات")}</button><button class="button-outline" id="learner-reports">${w("Learner reports", "بلاغات الطلاب")}</button><button class="button-outline" id="moderate-reviews">${w("Moderate course reviews", "مراجعة تقييمات الكورسات")}</button><button class="button-outline" id="moderate-questions">${w("Moderate discussions", "مراجعة النقاشات")}</button>` : ""}<button class="button-outline" id="my-reports">${w("My reports", "بلاغاتي")}</button><p class="muted">${w("A receipt is evidence to review, not confirmation of money received.", "إثبات التحويل محتاج مراجعة، ومش تأكيد لوصول الفلوس.")}</p>${config.mode === "demo" ? `<div class="test-notice">${w("TEST WORKFLOW. No money moves. Owner and learner views share this browser for testing only. Real admin permissions are checked on the backend.", "تجربة فقط. مفيش تحويل أموال. عرض المالك والطالب بيستخدموا نفس المتصفح للاختبار، وصلاحية الأدمن الحقيقية بيتحقق منها السيرفر.")}</div>` : ""}<div class="dashboard-panel">${items.length ? items.map((p) => `<div class="request-row"><div><strong>${esc(text(p.courseTitle))}</strong><small dir="ltr">${esc(p.id.slice(0, 8))} · ${money(p.amountCents)} ${p.mode === "test" ? "· TEST ONLY" : ""}</small><small>${esc(p.reviewNote || "")}</small></div><div class="actions"><span class="status-badge">${status(p.status)}</span>${admin && p.status === "pending" ? `<button class="button-outline" data-review="${esc(p.id)}">${w("Review receipt", "مراجعة الإثبات")}</button>` : ""}</div></div>`).join("") : `<p class="dashboard-empty">${w("No payment requests yet.", "مفيش طلبات دفع لسه.")}</p>`}</div>${getRole() === "student" ? `<button class="button-outline" id="become-instructor">${w("Become an instructor", "انضم كمدرّس")}</button>` : ""}${config.mode === "demo" ? `<button class="text-button" id="switch-demo">${w("Switch test role", "تغيير دور التجربة")} ↗</button>` : ""}</section>`;
    bindTabs();
    $("#my-reports").onclick = () => safe(() => safety.reports(false));
    if ($("#publication-queue"))
      $("#publication-queue").onclick = () => safe(() => safety.queue());
    if ($("#learner-reports"))
      $("#learner-reports").onclick = () => safe(() => safety.reports(true));
    if ($("#moderate-questions"))
      $("#moderate-questions").onclick = () =>
        safe(() => community.moderation());
    if ($("#moderate-reviews"))
      $("#moderate-reviews").onclick = () => safe(moderateReviews);
    if ($("#become-instructor"))
      $("#become-instructor").onclick = () =>
        safe(async () => {
          await api.role("instructor");
          setRole("instructor");
          await refresh();
        });
    if ($("#switch-demo")) $("#switch-demo").onclick = demoRoles;
    main
      .querySelectorAll("[data-review]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            safe(() => review(items.find((p) => p.id === b.dataset.review)))),
      );
  }
  function status(s) {
    return (
      {
        "pending-review": w("Awaiting owner review", "قيد مراجعة المالك"),
        draft: w("Draft", "مسودة"),
        published: w("Published", "منشور"),
        pending: w("Pending review", "قيد المراجعة"),
        approved: w("Approved", "مقبول"),
        rejected: w("Rejected", "مرفوض"),
        "awaiting-upload": w("Upload incomplete", "الرفع لم يكتمل"),
      }[s] || esc(s)
    );
  }
  async function review(p) {
    const r = await api.receipt(p.id);
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("OWNER REVIEW", "مراجعة المالك")}</p><h2 id="dialog-title">${esc(text(p.courseTitle))}</h2><p>${money(p.amountCents)}</p><div id="receipt-image"></div><form id="review-form" class="form-grid"><label>${w("Transfer reference / review note", "مرجع التحويل أو ملاحظة المراجعة")}<textarea name="note" required minlength="3" maxlength="1000"></textarea></label><label style="display:flex;align-items:flex-start;gap:10px"><input type="checkbox" name="verified" style="width:20px;margin-top:5px">${p.mode === "test" ? w("I completed this simulated test review. No money was transferred.", "راجعت تجربة المحاكاة. لم يتم تحويل أي أموال.") : w("I independently checked the transfer in the receiving account. A screenshot alone is not proof.", "راجعت وصول التحويل بشكل مستقل في حساب الاستلام. الصورة لوحدها مش دليل كافي.")}</label><div class="actions"><button class="button-primary" type="submit" name="decision" value="approved">${w("Approve & unlock", "قبول وفتح الكورس")}</button> <button class="button-outline danger" type="submit" name="decision" value="rejected">${w("Reject request", "رفض الطلب")}</button></div></form></div>`,
    );
    const img = document.createElement("img");
    img.src = r.url;
    img.alt = w("Submitted payment receipt", "إثبات التحويل المرفوع");
    img.style =
      "max-width:100%;max-height:350px;object-fit:contain;background:#fff;margin:15px 0;";
    $("#receipt-image").append(img);
    $("#review-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const f = new FormData(e.target),
          decision = e.submitter.value;
        await api.review(
          p.id,
          decision,
          f.get("note"),
          f.get("verified") === "on",
          p.mode === "test",
        );
        dialog.close();
        await refresh();
        await show("admin");
        toast(w("Review saved", "اتحفظ قرار المراجعة"));
      });
    };
  }
  async function payment(course) {
    const method = await api.paymentMethod();
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("MANUAL TRANSFER REQUEST", "طلب تحويل يدوي")}</p><h2 id="dialog-title">${esc(text(course.title))}</h2><h3>${money(course.priceCents)} ${method.mode === "test" ? "· TEST ONLY" : ""}</h3><div class="test-notice">${esc(method.instructions || w("Payments are not configured. Do not transfer money.", "الدفع غير مفعل. متحوّلش أي فلوس."))}</div><p>${w("Upload a JPG or PNG receipt, up to 5 MB. Your course stays locked until the owner approves the transfer.", "ارفع إثبات JPG أو PNG بحد أقصى 5 MB. الكورس هيفضل مقفول لحد قبول المالك للتحويل.")}</p><form class="form-grid" id="receipt-form"><label>${w("Receipt image", "صورة إثبات التحويل")}<input name="receipt" type="file" accept="image/png,image/jpeg" required ${!method.enabled ? "disabled" : ""}></label><button class="button-primary" ${!method.enabled ? "disabled" : ""}>${w("Submit for review", "إرسال للمراجعة")}</button></form><p class="fine-print">${w("This is not a payment gateway. A human must verify settlement. No card details or wallet PIN is collected.", "دي مش بوابة دفع. لازم شخص يراجع وصول التحويل. لا يتم جمع بيانات بطاقات أو PIN للمحفظة.")}</p></div>`,
    );
    $("#receipt-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const btn = e.target.querySelector("button");
        btn.disabled = true;
        try {
          await api.submitPayment(course.id, e.target.receipt.files[0]);
          dialog.close();
          toast(
            w(
              "Pending owner review. Course is still locked.",
              "الطلب قيد مراجعة المالك. الكورس لسه مقفول.",
            ),
          );
        } finally {
          btn.disabled = false;
        }
      });
    };
  }
  function lessonFields(i) {
    return `<fieldset class="lesson-edit dashboard-panel" data-lesson-edit><legend>${w("Lesson", "درس")} ${i}</legend><div class="form-grid"><label>English title<input name="lessonEn" required maxlength="180"></label><label>عنوان الدرس بالعربي<input name="lessonAr" required maxlength="180" dir="rtl"></label><label>${w("Minutes", "الدقائق")}<input name="minutes" type="number" min="1" max="600" value="10" required></label><label>${w("Lesson format", "نوع الدرس")}<select name="lessonType"><option value="text">${w("Text lesson", "درس نصي")}</option>${config.mode === "aws" ? `<option value="video">${w("Private video", "فيديو خاص")}</option>` : ""}</select></label><label>English lesson text<textarea name="bodyEn" maxlength="12000"></textarea></label><label>محتوى الدرس بالعربي<textarea name="bodyAr" maxlength="12000" dir="rtl"></textarea></label>${config.mode === "aws" ? `<label>${w("Video, MP4/WebM up to 100 MB", "فيديو MP4 أو WebM حتى 100 MB")}<input type="file" name="video" accept="video/mp4,video/webm"></label>` : ""}</div></fieldset>`;
  }
  function courseForm(existing) {
    modal(
      `<div class="detail-content"><p class="eyebrow">MADAR / STUDIO</p><h2 id="dialog-title">${w("Create your course", "أنشئ كورسك")}</h2><form class="form-grid" id="course-form"><label>English title<input name="titleEn" required minlength="3" maxlength="180"></label><label>عنوان الكورس بالعربي<input name="titleAr" required minlength="3" maxlength="180" dir="rtl"></label><label>English description<textarea name="descriptionEn" required minlength="3" maxlength="180"></textarea></label><label>الوصف بالعربي<textarea name="descriptionAr" required minlength="3" maxlength="180" dir="rtl"></textarea></label><label>${w("Your display name", "اسمك الظاهر")}<input name="author" required minlength="2" maxlength="80"></label><label>${w("Category", "المجال")}<select name="category">${["Cloud", "Design", "Development", "Data", "Business"].map((c) => `<option>${c}</option>`).join("")}</select></label><label>${w("Teaching language", "لغة الشرح")}<select name="language"><option value="ar">العربية</option><option value="en">English</option></select></label><label>${w("Level", "المستوى")}<select name="level"><option value="Beginner">${w("Beginner", "مبتدئ")}</option><option value="Intermediate">${w("Intermediate", "متوسط")}</option></select></label><label>${w("Price in EGP, 0 means free", "السعر بالجنيه المصري، صفر يعني مجاني")}<input name="price" type="number" value="0" min="0" max="1000000" step="0.01" required></label><div id="lesson-editors">${existing ? existing.lessons.map((_, i) => lessonFields(i + 1)).join("") : lessonFields(1)}</div><button class="button-outline" type="button" id="add-lesson">+ ${w("Add lesson", "إضافة درس")}</button><div id="quiz-authoring"></div><button class="button-primary" type="submit">${w("Save private draft", "حفظ المسودة الخاصة")}</button><p class="fine-print">${w("Drafts do not appear to students. Publish only after reviewing your content and price.", "المسودة مش بتظهر للطلاب. راجع المحتوى والسعر قبل النشر.")}</p></form></div>`,
    );
    const readQuiz = quizAuthoring({
      container: $("#quiz-authoring"),
      quiz: existing?.quiz,
      lang: language(),
    });
    if (existing) {
      const form = $("#course-form");
      const fields = {
        titleEn: existing.title.en,
        titleAr: existing.title.ar,
        descriptionEn: existing.subtitle.en,
        descriptionAr: existing.subtitle.ar,
        author: existing.author,
        category: existing.category,
        language: existing.language,
        level: existing.level,
        price: existing.priceCents / 100,
      };
      for (const [key, value] of Object.entries(fields))
        form.elements[key].value = value;
      form.querySelectorAll("[data-lesson-edit]").forEach((el, i) => {
        const l = existing.lessons[i];
        const values = {
          lessonEn: l.title.en,
          lessonAr: l.title.ar,
          minutes: l.minutes,
          lessonType: l.type || "text",
          bodyEn: l.body?.en || "",
          bodyAr: l.body?.ar || "",
        };
        for (const [key, value] of Object.entries(values))
          el.querySelector(`[name="${key}"]`).value = value;
      });
    }
    $("#add-lesson").onclick = () => {
      const n = document.querySelectorAll("[data-lesson-edit]").length;
      if (n >= 50) return;
      $("#lesson-editors").insertAdjacentHTML("beforeend", lessonFields(n + 1));
    };
    $("#course-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const f = new FormData(e.target),
          editors = [...e.target.querySelectorAll("[data-lesson-edit]")],
          videos = [];
        const lessons = editors.map((el, i) => {
          const value = (name) =>
            el.querySelector(`[name="${name}"]`)?.value || "";
          const type = value("lessonType");
          if (type === "video") {
            const file = el.querySelector('[name="video"]').files[0];
            if (!file) {
              const old = existing?.lessons[i];
              if (old?.type === "video" && old.mediaKey)
                return {
                  ...old,
                  title: { en: value("lessonEn"), ar: value("lessonAr") },
                  minutes: Number(value("minutes")),
                };
              throw Error(
                w(
                  "Select a video for every video lesson.",
                  "اختار فيديو لكل درس فيديو.",
                ),
              );
            }
            videos.push({ index: i, file });
            return {
              title: { en: value("lessonEn"), ar: value("lessonAr") },
              minutes: Number(value("minutes")),
              type: "video",
            };
          }
          if (!value("bodyEn").trim() || !value("bodyAr").trim())
            throw Error(
              w(
                "Add lesson text in both languages.",
                "اكتب محتوى الدرس باللغتين.",
              ),
            );
          return {
            title: { en: value("lessonEn"), ar: value("lessonAr") },
            minutes: Number(value("minutes")),
            type: "text",
            body: { en: value("bodyEn"), ar: value("bodyAr") },
          };
        });
        const body = {
          title: { en: f.get("titleEn"), ar: f.get("titleAr") },
          subtitle: { en: f.get("descriptionEn"), ar: f.get("descriptionAr") },
          author: f.get("author"),
          category: f.get("category"),
          language: f.get("language"),
          level: f.get("level"),
          priceCents: Math.round(Number(f.get("price")) * 100),
          currency: "EGP",
          lessons,
          quiz: readQuiz(),
        };
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
          const draft = existing
            ? await api.updateCourse(existing.id, body)
            : await api.createCourse(body);
          for (const v of videos) {
            const mediaKey = await api.uploadVideo(draft.id, v.file);
            body.lessons[v.index] = {
              ...body.lessons[v.index],
              type: "video",
              mediaKey,
            };
            delete body.lessons[v.index].body;
          }
          if (videos.length) await api.updateCourse(draft.id, body);
          dialog.close();
          await show("instructor");
          toast(
            w(
              "Draft saved. Review before publishing.",
              "اتحفظت المسودة. راجعها قبل النشر.",
            ),
          );
        } finally {
          btn.disabled = false;
        }
      });
    };
  }
  function editDetails(c) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("PUBLISHED COURSE DETAILS", "بيانات الكورس المنشور")}</p><h2 id="dialog-title">${w("Keep your course current.", "حدّث بيانات كورسك.")}</h2><p class="test-notice">${w("Lessons, quizzes, existing access and progress do not change. Pending payment requests keep their quoted amount.", "الدروس والاختبارات وصلاحيات الطلاب وتقدمهم مش هيتغيروا. طلبات الدفع السابقة تحتفظ بالسعر وقت الطلب.")}</p><form class="form-grid" id="details-form"><label>English title<input name="en" value="${esc(c.title.en)}" required minlength="3" maxlength="180"></label><label>العنوان بالعربي<input name="ar" value="${esc(c.title.ar)}" required minlength="3" maxlength="180" dir="rtl"></label><label>English description<textarea name="descriptionEn" required minlength="3" maxlength="180">${esc(c.subtitle.en)}</textarea></label><label>الوصف بالعربي<textarea name="descriptionAr" required minlength="3" maxlength="180" dir="rtl">${esc(c.subtitle.ar)}</textarea></label><label>${w("Price in EGP", "السعر بالجنيه")}<input name="price" type="number" min="0" max="1000000" step="0.01" value="${c.priceCents / 100}" required></label><button class="button-primary">${w("Save details", "حفظ البيانات")}</button></form></div>`,
    );
    $("#details-form").onsubmit = (e) => {
      e.preventDefault();
      safe(async () => {
        const f = new FormData(e.target);
        await api.updateDetails(c.id, {
          title: { en: f.get("en"), ar: f.get("ar") },
          subtitle: { en: f.get("descriptionEn"), ar: f.get("descriptionAr") },
          priceCents: Math.round(Number(f.get("price")) * 100),
        });
        dialog.close();
        await refresh();
        await show("instructor");
      });
    };
  }
  function tabs() {
    return `<div class="dashboard-tabs" style="margin-bottom:30px"><button class="chip" data-dashboard-tab="payments">${w("My requests", "طلباتي")}</button>${getRole() === "instructor" ? `<button class="chip" data-dashboard-tab="instructor">${w("Instructor studio", "استوديو المدرّس")}</button>` : ""}${getRole() === "admin" ? `<button class="chip" data-dashboard-tab="admin">${w("Owner review", "مراجعة المالك")}</button>` : ""}</div>`;
  }
  function bindTabs() {
    main
      .querySelectorAll("[data-dashboard-tab]")
      .forEach(
        (b) => (b.onclick = () => safe(() => show(b.dataset.dashboardTab))),
      );
  }
  function previewDraft(c) {
    modal(
      `<div class="detail-content"><p class="eyebrow">${w("PRIVATE DRAFT · NOT YET PUBLISHED", "مسودة خاصة · لم تنشر بعد")}</p><h2 id="dialog-title">${esc(text(c.title))}</h2><p>${esc(text(c.subtitle))}</p><strong>${money(c.priceCents)}</strong>${c.quiz ? `<p class="test-notice">${w("Quiz", "اختبار")}: ${c.quiz.questions.length} ${w("questions", "أسئلة")} · ${c.quiz.passPercent}% ${w("pass mark", "نسبة النجاح")}</p>` : ""}<div>${c.lessons.map((l, i) => `<section class="dashboard-panel"><h3>${i + 1}. ${esc(text(l.title))}</h3><p>${l.type === "video" ? (l.mediaKey ? w("Private video attached", "فيديو خاص مرفق") : w("Video upload pending. Publishing is blocked.", "رفع الفيديو لم يكتمل. النشر غير متاح.")) : esc(text(l.body)).replace(/\n/g, "<br>")}</p></section>`).join("")}</div></div>`,
    );
  }
  function demoRoles() {
    if (config.mode !== "demo") return;
    modal(
      `<div class="auth-content"><p class="eyebrow">LOCAL DEMO TOOLS</p><h2 id="dialog-title">${w("Test a different view", "جرّب دور مختلف")}</h2><div class="test-notice">${w("Test-only role switching. This never grants AWS permissions. Do not use real receipts or personal data.", "تغيير أدوار للاختبار فقط، ولا يمنح أي صلاحيات AWS. متستخدمش بيانات أو إيصالات حقيقية.")}</div><div class="form-grid">${["student", "instructor", "admin"].map((role) => `<button class="button-outline" data-demo-role="${role}">${{ student: w("Student", "طالب"), instructor: w("Instructor", "مدرّس"), admin: w("Owner / admin test view", "عرض المالك / الأدمن التجريبي") }[role]}</button>`).join("")}</div></div>`,
    );
    document.querySelectorAll("[data-demo-role]").forEach(
      (b) =>
        (b.onclick = () => {
          setRole(b.dataset.demoRole);
          dialog.close();
          refresh();
        }),
    );
  }
  return { show, payment, demoRoles };
}
