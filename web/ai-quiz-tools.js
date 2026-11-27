import { api } from "./api.js";
export function aiQuizTools({ dialog, esc, lang, safe, toast, onAdopt }) {
  const $ = (s) => document.querySelector(s),
    w = (en, ar) => (lang() === "ar" ? ar : en);
  function modal(html) {
    $("#dialog-content").innerHTML = html;
    if (!dialog.open) dialog.showModal();
  }
  async function open(c) {
    const status = await api.aiQuizStatus(c.id);
    modal(
      `<div class="detail-content"><p class="eyebrow">MADAR / ${status.simulation ? "LOCAL SIMULATION" : "AMAZON BEDROCK"}</p><h2 id="dialog-title">${w("Draft a quiz, then verify.", "اقترح اختبارًا، ثم راجعه.")}</h2><p class="test-notice">${status.simulation ? w("This is a fixed hand-written sample, not AI and not generated from your lessons. No Bedrock request, credentials or charges. It only demonstrates review and adoption.", "ده مثال ثابت مكتوب مسبقًا، مش ذكاء اصطناعي ومش ناتج من دروسك. لا يوجد طلب Bedrock أو بيانات دخول أو تكلفة. الهدف تجربة المراجعة والاعتماد.") : status.enabled ? w("This sends the saved text lessons of this draft to the configured Bedrock model. Model/AWS charges may apply. Never include secrets or personal records. No student notes, reports, receipts or answer history are sent.", "سيُرسل محتوى الدروس النصية المحفوظة في هذه المسودة إلى نموذج Bedrock المحدد. قد تُحتسب تكلفة للنموذج وخدمات AWS. متكتبش أسرار أو سجلات شخصية. لا تُرسل ملاحظات الطلاب أو البلاغات أو الإيصالات أو سجل الإجابات.") : w("Bedrock is disabled. The source is integrated, but a compatible model, region, access and cost/data approval are still needed before activation. No model has been selected automatically.", "Bedrock مغلق. الربط موجود في المصدر، لكن التفعيل يحتاج نموذجًا متوافقًا ومنطقة وصلاحيات وموافقة على التكلفة ومعالجة البيانات. لم يُختر نموذج تلقائيًا.")}</p>${status.enabled ? `<p><bdi>${esc(status.modelId)} · ${esc(status.region)}</bdi></p>` : ""}<p class="fine-print">${w("AWS-source limits: saved text-only drafts, up to 12,000 total source characters. No video transcription. 1-3 bilingual questions. Attempts capped at 3 per instructor and 20 platform-wide per UTC day; failed/time-out attempts count. These are request limits, not a money budget. No automatic paid retry.", "حدود مصدر AWS: مسودات نصية محفوظة فقط حتى 12000 حرف للمصدر الكلي. لا يوجد تفريغ فيديو. من سؤال إلى ثلاثة باللغتين. المحاولات محدودة بثلاث للمدرّس وعشرين للمنصة في اليوم بتوقيت UTC، بما فيها الفاشلة. دي حدود طلبات وليست ميزانية مالية. لا توجد إعادة محاولة مدفوعة تلقائية.")}</p>${status.enabled || status.simulation ? `<form id="ai-quiz-form" class="form-grid"><label>${w("Questions", "عدد الأسئلة")}<select name="count"><option>1</option><option>2</option><option>3</option></select></label><label class="check-row"><input type="checkbox" name="consent" required><span>${status.simulation ? w("I understand this is a fixed demonstration sample, unrelated to my lesson content.", "فاهم إن ده مثال توضيحي ثابت، مش ناتج من محتوى دروسي.") : w("I have permission to send these saved lessons to the named model/region and understand this request can incur charges.", "عندي صلاحية إرسال الدروس المحفوظة للنموذج والمنطقة الموضحين وفاهم إن الطلب قد يُحتسب بتكلفة.")}</span></label><button class="button-primary">${status.simulation ? w("Preview fixed sample", "معاينة المثال الثابت") : w("Generate draft with Bedrock", "اقتراح مسودة باستخدام Bedrock")}</button><p class="fine-print" id="ai-request-status" role="status"></p></form>` : ""}</div>`,
    );
    if ($("#ai-quiz-form"))
      $("#ai-quiz-form").onsubmit = (e) => {
        e.preventDefault();
        const form = e.target,
          f = new FormData(form),
          button = form.querySelector("button"),
          requestId = crypto.randomUUID();
        button.disabled = true;
        $("#ai-request-status").textContent = w(
          "Preparing a review-only draft…",
          "جاري تجهيز مسودة للمراجعة فقط…",
        );
        safe(async () => {
          try {
            const result = await api.generateAiQuiz(c.id, {
              count: Number(f.get("count")),
              requestId,
              consent: f.has("consent"),
            });
            preview(c, result, status.simulation);
          } catch (error) {
            if ($("#ai-request-status"))
              $("#ai-request-status").textContent = w(
                "Request did not complete. Nothing adopted. Check before trying another potentially billable attempt.",
                "الطلب لم يكتمل ولم يُعتمد شيء. راجع النتيجة قبل محاولة جديدة قد تُحتسب.",
              );
            throw error;
          } finally {
            button.disabled = false;
          }
        });
      };
  }
  function preview(c, result, simulation) {
    const bi = (v) =>
      `<p dir="ltr">${esc(v.en)}</p><p dir="rtl">${esc(v.ar)}</p>`;
    modal(
      `<div class="detail-content"><p class="eyebrow">${simulation ? "FIXED SAMPLE · NOT A BEDROCK RESPONSE" : "AI DRAFT · NOT YET ADOPTED"}</p><h2 id="dialog-title">${w("Check every answer.", "راجع كل إجابة.")}</h2><p class="test-notice">${w("A valid JSON shape does not prove accuracy. Check lesson relevance, facts, translation, option quality and each correct answer. Adoption replaces the quiz in this editable draft only. Nothing is published; learner scoring stays deterministic on the backend.", "صحة شكل JSON مش دليل دقة. راجع ارتباطه بالدروس والحقائق والترجمة وجودة الاختيارات وكل إجابة صحيحة. الاعتماد يستبدل اختبار هذه المسودة القابلة للتعديل فقط. لا يُنشر شيء، وتصحيح الطالب يظل حسابًا ثابتًا في السيرفر.")}</p><p dir="ltr">${esc(result.modelId)} · ${esc(result.region)}</p>${result.quiz.questions.map((q, i) => `<section class="dashboard-panel"><h3>${w("Question", "سؤال")} ${i + 1}</h3>${bi(q.prompt)}<ol>${q.options.map((o, n) => `<li>${n === q.correctIndex ? "✓ " : ""}${bi(o)}</li>`).join("")}</ol></section>`).join("")}<form class="form-grid" id="ai-adopt-form"><label class="check-row"><input name="reviewed" type="checkbox" required><span>${w("I reviewed all questions, translations and correct answers. Replace this draft quiz.", "راجعت كل الأسئلة والترجمات والإجابات الصحيحة، وأوافق على استبدال اختبار المسودة.")}</span></label><button class="button-primary">${w("Adopt into editable draft", "اعتماد في المسودة")}</button><button class="button-outline" id="ai-discard" type="button">${w("Discard without changing course", "تجاهل بدون تغيير الكورس")}</button></form></div>`,
    );
    $("#ai-discard").onclick = () => dialog.close();
    $("#ai-adopt-form").onsubmit = (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      button.disabled = true;
      safe(async () => {
        try {
          await api.adoptAiQuiz(
            c.id,
            result.requestId,
            new FormData(e.target).has("reviewed"),
          );
          dialog.close();
          await onAdopt();
          toast(
            w(
              "Quiz adopted into draft. You can edit it before submission.",
              "اتحفظ الاختبار في المسودة. تقدر تعدله قبل إرسال الكورس للمراجعة.",
            ),
          );
        } finally {
          button.disabled = false;
        }
      });
    };
  }
  return { open };
}
