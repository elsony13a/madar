export function quizAuthoring({ container, quiz, lang }) {
  const w = (en, ar) => (lang === "ar" ? ar : en),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  container.innerHTML = `<section class="dashboard-panel"><h3>${w("Course quiz", "اختبار الكورس")}</h3><label class="quiz-option"><input type="checkbox" id="quiz-enabled" ${quiz ? "checked" : ""}><span>${w("Require a passing quiz for the completion record", "اشتراط اجتياز الاختبار لشهادة الإكمال")}</span></label><div id="quiz-editor-fields" ${quiz ? "" : "hidden"}><label>${w("Pass mark, 50-100%", "نسبة النجاح من 50 إلى 100%")}<input type="number" id="quiz-pass" min="50" max="100" value="${quiz?.passPercent || 70}"></label><div id="quiz-questions-editor"></div><button type="button" class="button-outline" id="add-quiz-question">+ ${w("Add question", "إضافة سؤال")}</button><p class="fine-print">${w("Use one correct answer per question. The AWS learner API never returns the answer key.", "إجابة صحيحة واحدة لكل سؤال. API الطالب في AWS لا يعرض مفتاح الإجابات.")}</p></div></section>`;
  const list = container.querySelector("#quiz-questions-editor");
  function add(q) {
    if (list.children.length >= 20) return;
    const el = document.createElement("fieldset");
    el.className = "quiz-edit";
    el.innerHTML = `<legend>${w("Question", "سؤال")}</legend><label>English question<input data-prompt-en maxlength="500" value="${esc(q?.prompt.en || "")}"></label><label>السؤال بالعربي<input data-prompt-ar maxlength="500" dir="rtl" value="${esc(q?.prompt.ar || "")}"></label>${[0, 1, 2].map((i) => `<label>${w("Option", "اختيار")} ${i + 1} · English<input data-option-en="${i}" maxlength="500" value="${esc(q?.options[i]?.en || "")}"></label><label>${w("Option", "اختيار")} ${i + 1} · عربي<input data-option-ar="${i}" maxlength="500" dir="rtl" value="${esc(q?.options[i]?.ar || "")}"></label>`).join("")}<label>${w("Correct answer", "الإجابة الصحيحة")}<select data-correct>${[0, 1, 2].map((i) => `<option value="${i}" ${q?.correctIndex === i ? "selected" : ""}>${i + 1}</option>`).join("")}</select></label><button type="button" class="text-button danger" data-remove-question>${w("Remove question", "حذف السؤال")}</button>`;
    el.querySelector("[data-remove-question]").onclick = () => el.remove();
    list.append(el);
  }
  (quiz?.questions || []).forEach(add);
  container.querySelector("#add-quiz-question").onclick = () => add();
  container.querySelector("#quiz-enabled").onchange = (e) => {
    container.querySelector("#quiz-editor-fields").hidden = !e.target.checked;
    if (e.target.checked && !list.children.length) add();
  };
  return () => {
    if (!container.querySelector("#quiz-enabled").checked) return null;
    const passPercent = Number(container.querySelector("#quiz-pass").value);
    if (!Number.isInteger(passPercent) || passPercent < 50 || passPercent > 100)
      throw Error(
        w(
          "Choose a pass mark from 50 to 100.",
          "اختار نسبة نجاح من 50 إلى 100.",
        ),
      );
    if (!list.children.length)
      throw Error(
        w("Add at least one question.", "أضف سؤالًا واحدًا على الأقل."),
      );
    const questions = [...list.children].map((el, i) => {
      const val = (s) => el.querySelector(s).value.trim(),
        prompt = { en: val("[data-prompt-en]"), ar: val("[data-prompt-ar]") },
        options = [0, 1, 2].map((n) => ({
          en: val(`[data-option-en="${n}"]`),
          ar: val(`[data-option-ar="${n}"]`),
        })),
        correctIndex = Number(val("[data-correct]"));
      if (!prompt.en || !prompt.ar || options.some((x) => !x.en || !x.ar))
        throw Error(
          w(
            "Fill every quiz question and option in both languages.",
            "اكتب كل سؤال واختيار باللغتين.",
          ),
        );
      return { id: "question-" + (i + 1), prompt, options, correctIndex };
    });
    return { passPercent, questions };
  };
}
