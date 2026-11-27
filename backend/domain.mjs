import { validateQuiz } from "./learning-domain.mjs";
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireRole(profile, claims, role) {
  if (role === "admin") {
    if (!(claims["cognito:groups"] || []).includes("MadarAdmins"))
      throw new HttpError(403, "Admin access required");
  } else if (profile?.role !== role)
    throw new HttpError(403, `${role} access required`);
}
export function requireOwner(course, sub) {
  if (course.ownerSub !== sub)
    throw new HttpError(403, "This course belongs to another instructor");
}
export function assertCanEnroll(course) {
  if (course.status !== "published")
    throw new HttpError(404, "Course not found");
  if (course.priceCents !== 0)
    throw new HttpError(402, "Manual payment approval is required");
}
export function assertReview(payment, sub) {
  if (payment.userSub === sub)
    throw new HttpError(403, "You cannot review your own payment request");
  if (payment.status !== "pending")
    throw new HttpError(409, "This request is no longer pending");
}
export function roleChoice(role) {
  if (!["student", "instructor"].includes(role))
    throw new HttpError(400, "Choose student or instructor");
  return role;
}
export function validateCourse(input) {
  const str = (v, min, max, name) => {
    if (typeof v !== "string" || v.trim().length < min || v.length > max)
      throw new HttpError(400, `Invalid ${name}`);
    return v.trim();
  };
  const bilingual = (v, name) => ({
    en: str(v?.en, 3, 180, name + " English"),
    ar: str(v?.ar, 3, 180, name + " Arabic"),
  });
  if (
    !["Cloud", "Design", "Development", "Data", "Business"].includes(
      input.category,
    )
  )
    throw new HttpError(400, "Invalid category");
  if (!["ar", "en"].includes(input.language))
    throw new HttpError(400, "Choose course language");
  if (
    !Number.isSafeInteger(input.priceCents) ||
    input.priceCents < 0 ||
    input.priceCents > 100000000
  )
    throw new HttpError(400, "Invalid price in EGP minor units");
  if (
    !Array.isArray(input.lessons) ||
    !input.lessons.length ||
    input.lessons.length > 50
  )
    throw new HttpError(400, "Provide 1 to 50 lessons");
  const lessons = input.lessons.map((l, i) => {
    const base = {
      id: `lesson-${i + 1}`,
      title: bilingual(l.title, "lesson title"),
      minutes: Math.max(1, Math.min(600, Number(l.minutes) || 10)),
      type: l.type === "video" ? "video" : "text",
    };
    if (base.type === "text")
      return {
        ...base,
        body: {
          en: str(l.body?.en, 1, 12000, "English lesson"),
          ar: str(l.body?.ar, 1, 12000, "Arabic lesson"),
        },
      };
    return {
      ...base,
      ...(l.mediaKey ? { mediaKey: str(l.mediaKey, 1, 500, "media key") } : {}),
    };
  });
  const result = {
    title: bilingual(input.title, "title"),
    subtitle: bilingual(input.subtitle, "description"),
    category: input.category,
    language: input.language,
    priceCents: input.priceCents,
    currency: "EGP",
    level: input.level === "Intermediate" ? "Intermediate" : "Beginner",
    author: str(
      input.author || "Independent instructor",
      2,
      80,
      "instructor name",
    ),
    quiz: validateQuiz(input.quiz),
    lessons,
    color: {
      Cloud: "cloud",
      Design: "design",
      Development: "code",
      Data: "data",
      Business: "product",
    }[input.category],
    hours: `${lessons.reduce((sum, l) => sum + l.minutes, 0)} min`,
    tag: { en: "KEEP LEARNING", ar: "كمّل تعلم" },
  };
  if (Buffer.byteLength(JSON.stringify(result)) > 250000)
    throw new HttpError(
      400,
      "Course text exceeds 250 KB; split the curriculum",
    );
  return result;
}
export function publicCourse(c, detail = false) {
  const {
    title,
    subtitle,
    category,
    language,
    priceCents,
    currency,
    level,
    author,
    color,
    hours,
    tag,
    id,
  } = c;
  return {
    id,
    title,
    subtitle,
    category,
    language,
    priceCents,
    currency,
    level,
    author,
    color,
    hours,
    tag,
    hasQuiz: !!c.quiz,
    quizPassPercent: c.quiz?.passPercent || null,
    lessonCount: c.lessons.length,
    ...(detail
      ? {
          lessons: c.lessons.map(({ id, title, minutes, type }) => ({
            id,
            title,
            minutes,
            type,
          })),
        }
      : {}),
  };
}
