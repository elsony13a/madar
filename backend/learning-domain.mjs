import { HttpError } from "./domain.mjs";
export function validateQuiz(q) {
  if (!q) return null;
  if (
    !Number.isInteger(q.passPercent) ||
    q.passPercent < 50 ||
    q.passPercent > 100
  )
    throw new HttpError(400, "Quiz pass mark must be 50-100");
  if (
    !Array.isArray(q.questions) ||
    q.questions.length < 1 ||
    q.questions.length > 20
  )
    throw new HttpError(400, "A quiz needs 1-20 questions");
  const bilingual = (v) => {
    if (
      !v ||
      ["en", "ar"].some(
        (k) =>
          typeof v[k] !== "string" ||
          v[k].trim().length < 1 ||
          v[k].length > 500,
      )
    )
      throw new HttpError(
        400,
        "Add question/option text in both languages, maximum 500 characters",
      );
    return { en: v.en.trim(), ar: v.ar.trim() };
  };
  return {
    passPercent: q.passPercent,
    questions: q.questions.map((x, i) => {
      if (
        !Array.isArray(x.options) ||
        x.options.length < 2 ||
        x.options.length > 4 ||
        !Number.isInteger(x.correctIndex) ||
        x.correctIndex < 0 ||
        x.correctIndex >= x.options.length
      )
        throw new HttpError(
          400,
          "Quiz needs 2-4 options and one valid correct answer",
        );
      return {
        id: "question-" + (i + 1),
        prompt: bilingual(x.prompt),
        options: x.options.map(bilingual),
        correctIndex: x.correctIndex,
      };
    }),
  };
}
export function scoreQuiz(quiz, answers) {
  if (!quiz) throw new HttpError(404, "No quiz for this course");
  if (
    !Array.isArray(answers) ||
    answers.length !== quiz.questions.length ||
    answers.some(
      (a, i) =>
        !Number.isInteger(a) || a < 0 || a >= quiz.questions[i].options.length,
    )
  )
    throw new HttpError(400, "Answer every question");
  const correct = quiz.questions.filter(
      (q, i) => q.correctIndex === answers[i],
    ).length,
    score = Math.round((correct / quiz.questions.length) * 100);
  return {
    score,
    passed: score >= quiz.passPercent,
    passPercent: quiz.passPercent,
    questionCount: quiz.questions.length,
  };
}
export function assertCertificate(course, enrollment) {
  if (!enrollment) throw new HttpError(403, "Enroll first");
  if (!course.lessons.every((l) => enrollment.completed?.includes(l.id)))
    throw new HttpError(409, "Complete every lesson first");
  if (course.quiz && !enrollment.quizPassed)
    throw new HttpError(409, "Pass the course quiz first");
}
