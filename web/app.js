import { safetyTools } from "./safety-tools.js";
import { communityTools } from "./community-tools.js";
import { learningTools } from "./learning-tools.js";
import { config } from "./config.js";
import { api } from "./api.js";
import { dashboards } from "./dashboard.js";
import { initializeAuth, signIn, signOut, validateConfig } from "./auth.js";
const $ = (s) => document.querySelector(s),
  main = $("#main"),
  dialog = $("#dialog");
let lang = localStorage.getItem("madar.language") || config.defaultLanguage,
  user = null,
  catalogue = [],
  enrollments = [],
  category = "All",
  search = "",
  view = "explore",
  activeCourse,
  activeLesson = 0,
  role = sessionStorage.getItem("madar.demo.role") || "student",
  courseLanguage = "all";
const words = {
  en: {
    explore: "Explore courses",
    learning: "My learning",
    login: "Sign in",
    logout: "Sign out",
    demo: "INTERACTIVE DEMO",
    demoNote:
      "Sample courses. Progress stays in this browser. No payments or live AWS connection.",
    aws: "AWS MODE",
    awsNote:
      "Configured AWS endpoints. This label is not a connectivity check.",
    eyebrow: "A LITTLE CURIOSITY. A WHOLE NEW DIRECTION.",
    hero: "Make room for<br><i>what's next.</i>",
    intro:
      "Big ambitions start with small discoveries. Find a course, build a skill, and take your next step.",
    browse: "Find your next course",
    sample: "Explore the sample catalogue",
    search: "What do you want to learn?",
    section: "Your next chapter starts here",
    sectionSub: "Practical ideas. Fresh perspectives. Space to grow.",
    all: "All topics",
    cloud: "Cloud",
    design: "Design",
    development: "Development",
    data: "Data",
    business: "Business",
    free: "Free",
    details: "Explore course",
    curriculum: "Course outline",
    enroll: "Start learning",
    continue: "Continue learning",
    back: "Back to courses",
    mark: "Mark complete & continue",
    done: "Lesson completed",
    empty: "No courses found. Try a different search.",
    learningTitle: "A little progress, every day.",
    learningSub: "Pick up where you left off.",
    noLearning: "Your learning space is ready.",
    noLearningText: "Explore a sample course and make your first start.",
    close: "Close",
    authTitle: "Welcome to your next chapter.",
    authText:
      "In AWS mode, sign-in opens Amazon Cognito. No password is collected by this page.",
    demoAuth: "Try a local demo session",
    awsAuth: "Continue with Cognito",
    demoAuthNote:
      "This creates a browser-only demo session, not an AWS account.",
    sampleNote:
      "Starter catalogue includes original sample courses. Replace sample content before launch.",
    instructor: "By",
    level: "Level",
    beginner: "Beginner",
    intermediate: "Intermediate",
    outline: "lessons",
    complete: "complete",
    lesson: "Lesson",
    media: "Load private lesson video",
    error: "Something needs attention",
    retry: "Try again",
    config: "AWS configuration is incomplete. Check web/config.js.",
    saved: "Progress saved",
    loginNeeded: "Sign in to start learning",
    footer: "A little curiosity takes you a long way.",
    footerNote: "Original learning-platform starter · Sample content",
    notPaid: "Paid enrollment is not enabled in this starter.",
    progress: "Course progress",
    lessonSample: "TEXT LESSON · ORIGINAL SAMPLE",
    workspace: "Learning workspace",
    loading: "Loading…",
  },
  ar: {
    explore: "اكتشف الكورسات",
    learning: "رحلتي التعليمية",
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    demo: "نسخة تفاعلية تجريبية",
    demoNote:
      "كورسات توضيحية. التقدم محفوظ في المتصفح فقط. لا دفع ولا اتصال فعلي بـ AWS.",
    aws: "وضع AWS",
    awsNote: "إعدادات AWS محددة. هذا العنوان ليس اختبارًا لنجاح الاتصال.",
    eyebrow: "قليل من الفضول. اتجاه جديد بالكامل.",
    hero: "افتح مساحة<br><i>لخطوتك الجاية.</i>",
    intro:
      "الطموحات الكبيرة تبدأ باكتشاف صغير. اختار كورس، اتعلم مهارة، وخد خطوتك الجاية.",
    browse: "اكتشف كورسك القادم",
    sample: "استكشف الكورسات التجريبية",
    search: "نفسك تتعلم إيه؟",
    section: "فصل جديد في رحلتك يبدأ هنا",
    sectionSub: "أفكار عملية. منظور جديد. ومساحة للتطور.",
    all: "كل المجالات",
    cloud: "السحابة",
    design: "التصميم",
    development: "البرمجة",
    data: "البيانات",
    business: "الأعمال",
    free: "مجاني",
    details: "اكتشف الكورس",
    curriculum: "محتوى الكورس",
    enroll: "ابدأ التعلم",
    continue: "كمّل التعلم",
    back: "العودة للكورسات",
    mark: "تم الدرس، كمّل",
    done: "اكتمل الدرس",
    empty: "مفيش نتائج. جرّب بحث مختلف.",
    learningTitle: "تقدم بسيط، كل يوم.",
    learningSub: "كمّل من المكان اللي وقفت عنده.",
    noLearning: "مساحتك التعليمية جاهزة.",
    noLearningText: "اختار كورس تجريبي وابدأ أول خطوة.",
    close: "إغلاق",
    authTitle: "أهلًا بخطوتك الجاية.",
    authText:
      "في وضع AWS، تسجيل الدخول بيفتح Amazon Cognito. الصفحة دي مش بتجمع كلمة السر.",
    demoAuth: "جرّب جلسة محلية",
    awsAuth: "المتابعة مع Cognito",
    demoAuthNote: "دي جلسة في المتصفح فقط، مش حساب AWS.",
    sampleNote:
      "الكتالوج التجريبي فيه عينات أصلية. استبدل المحتوى التجريبي قبل الإطلاق.",
    instructor: "بواسطة",
    level: "المستوى",
    beginner: "مبتدئ",
    intermediate: "متوسط",
    outline: "دروس",
    complete: "مكتمل",
    lesson: "درس",
    media: "تحميل فيديو الدرس الخاص",
    error: "في حاجة محتاجة مراجعة",
    retry: "حاول مرة تانية",
    config: "إعدادات AWS غير مكتملة. راجع web/config.js.",
    saved: "اتحفظ تقدمك",
    loginNeeded: "سجل الدخول عشان تبدأ",
    footer: "قليل من الفضول يفتح لك طريق جديد.",
    footerNote: "مشروع منصة تعليمية أصلي · محتوى تجريبي",
    notPaid: "الانضمام المدفوع غير متاح في النسخة دي.",
    progress: "التقدم في الكورس",
    lessonSample: "درس نصي · عينة أصلية",
    workspace: "مساحة التعلم",
    loading: "جاري التحميل…",
  },
};
const t = (k) => words[lang][k] || k,
  text = (v) => (typeof v === "object" ? v[lang] || v.en : v);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (c) =>
  c.priceCents === 0
    ? lang === "ar"
      ? "مجاني"
      : "Free"
    : new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-EG", {
        style: "currency",
        currency: c.currency || "EGP",
      }).format(c.priceCents / 100);
const safety = safetyTools({
  dialog,
  esc,
  text,
  lang: () => lang,
  toast,
  safe,
  refresh: async () => {
    catalogue = await api.list();
    if (user) enrollments = await api.enrollments();
    render();
  },
});
const community = communityTools({
  reportConcern: safety.report,
  dialog,
  esc,
  text,
  lang: () => lang,
  toast,
  safe,
});
const tools = learningTools({
  dialog,
  esc,
  text,
  lang: () => lang,
  toast,
  safe,
  refresh: async () => {
    enrollments = await api.enrollments();
    render();
  },
});
const dash = dashboards({
  moderateReviews: () => tools.moderation(),
  safety,
  community,
  main,
  dialog,
  esc,
  text,
  lang: () => lang,
  toast,
  safe,
  refresh: async () => {
    catalogue = await api.list();
    if (user) enrollments = await api.enrollments();
    render();
  },
  getRole: () => role,
  setRole: (r) => {
    role = r;
    sessionStorage.setItem("madar.demo.role", r);
    view = r === "student" ? "learning" : "dashboard";
  },
});
const catName = (c) => (c === "All" ? t("all") : t(c.toLowerCase()));
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
async function safe(fn) {
  try {
    await fn();
  } catch (e) {
    toast(e.message);
  }
}
function art(c, extra = "") {
  return `<div class="course-art ${esc(c.color || "cloud")} ${extra}" aria-hidden="true"><span class="art-tag">${esc(text(c.tag || { en: "KEEP LEARNING", ar: "كمّل تعلم" }))}</span><div class="art-shape shape-one"></div><div class="art-shape shape-two"></div><div class="art-shape shape-three"></div><span class="art-symbol">${{ cloud: "☁", design: "Aa", code: "{ }", data: "▥", brand: "a.", product: "↗" }[c.color] || "✳"}</span><span class="art-foot">MADAR / ${esc(c.category.toUpperCase())}</span></div>`;
}
function card(c, learning = false) {
  const en = enrollments.find((e) => e.courseId === c.id),
    percent = en
      ? Math.round(
          (en.completed.length / (c.lessonCount || c.lessons?.length || 1)) *
            100,
        )
      : 0;
  return `<article class="course-card"><button class="card-open" data-course="${esc(c.id)}" aria-label="${esc(text(c.title))}">${art(c)}<div class="course-info"><div class="course-meta"><span>${esc(catName(c.category))}</span><span>↗</span></div><h3>${esc(text(c.title))}</h3><p class="author">${esc(c.author)}</p><div class="course-stats"><span>${esc(t(c.level === "Beginner" ? "beginner" : "intermediate"))}</span><span>·</span><span dir="ltr">${esc(c.hours)}</span><span>·</span><span>${c.lessonCount || c.lessons?.length || 0} ${t("outline")}</span><span>${esc(c.language === "ar" ? "العربية" : "English")}</span></div>${learning ? `<div class="progress-line"><span style="width:${percent}%"></span></div><small>${percent}% ${t("complete")}</small>` : `<div class="course-bottom"><strong>${esc(money(c))}</strong><span>${t("details")} <b>↗</b></span></div>`}</div></button></article>`;
}
function shell() {
  $("#close-dialog").ariaLabel = t("close");
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  $("#mode-banner").innerHTML =
    `<strong><span class="status-dot"></span>${t(config.mode === "demo" ? "demo" : "aws")}</strong><span>${t(config.mode === "demo" ? "demoNote" : "awsNote")}</span>`;
  $("#explore-nav").textContent = t("explore");
  $("#learning-nav").textContent = t("learning");
  $("#language").textContent = lang === "en" ? "العربية" : "English";
  $("#login").textContent = user ? t("logout") : t("login");
  $("#workspace-nav").hidden = !user;
  $("#workspace-nav").textContent =
    role === "admin"
      ? lang === "ar"
        ? "لوحة المالك"
        : "Owner desk"
      : role === "instructor"
        ? lang === "ar"
          ? "استوديو المدرّس"
          : "Instructor studio"
        : lang === "ar"
          ? "طلبات الدفع"
          : "Payment requests";
  $("#demo-tools").hidden = !(user && config.mode === "demo");
  $("#demo-tools").textContent =
    lang === "ar" ? "تغيير دور التجربة" : "Test role";
  $("#footer-copy").textContent = t("footer");
  $("#footer-note").textContent = t("footerNote");
  $("#explore-nav").classList.toggle("active", view === "explore");
  $("#learning-nav").classList.toggle("active", view === "learning");
}
function render() {
  shell();
  if (view === "dashboard") {
    safe(() =>
      dash.show(
        role === "admin"
          ? "admin"
          : role === "instructor"
            ? "instructor"
            : "payments",
      ),
    );
    return;
  }
  if (view === "player") {
    renderPlayer();
    return;
  }
  if (view === "saved") {
    safe(renderSaved);
    return;
  }
  if (view === "learning") {
    renderLearning();
    return;
  }
  main.innerHTML = `<section class="hero"><div class="hero-copy"><p class="eyebrow">${t("eyebrow")}</p><h1>${t("hero")}</h1><p class="hero-intro">${t("intro")}</p><button class="button-primary" id="hero-browse">${t("browse")} <span>↗</span></button><div class="hero-caption"><span class="mini-star">✳</span>${t("sample")}</div></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="floating-star">✳</span><div class="hero-card hero-card-back"><span>THINK BIG.</span><b>Start<br>small.</b><div class="tiny-blocks"><i></i><i></i><i></i></div></div><div class="hero-card hero-card-front"><div class="card-mini-top"><span>YOUR NEXT CHAPTER</span><span>↗</span></div><div class="sun-disc"><span>✳</span></div><b>Never stop<br><i>becoming.</i></b><div class="card-mini-bottom"><span>MADAR</span><span>01 / ∞</span></div></div><div class="floating-label"><span>↗</span> A new perspective</div><div class="art-note">KEEP YOUR CURIOSITY IN MOTION</div></div></section><section class="topic-strip" aria-label="Topics"><span>✳</span><b>${t("cloud")}</b><span>✳</span><b>${t("design")}</b><span>✳</span><b>${t("development")}</b><span>✳</span><b>${t("data")}</b><span>✳</span><b>${t("business")}</b></section><section class="catalogue section" id="catalogue"><div class="section-heading"><div><p class="eyebrow">${lang === "en" ? "FOLLOW YOUR CURIOSITY" : "امشِ وراء فضولك"}</p><h2>${t("section")}</h2><p>${t("sectionSub")}</p></div><form class="search" role="search"><span aria-hidden="true">⌕</span><input id="search" type="search" aria-label="${t("search")}" placeholder="${t("search")}" value="${esc(search)}"></form></div><div class="filters" role="group" aria-label="${t("all")}">${["All", "Cloud", "Design", "Development", "Data", "Business"].map((c) => `<button data-category="${c}" class="chip ${category === c ? "selected" : ""}" aria-pressed="${category === c}">${catName(c)}</button>`).join("")}</div><label class="language-filter">${lang === "ar" ? "لغة الكورس" : "Course language"} <select id="course-language"><option value="all">${lang === "ar" ? "كل اللغات" : "All languages"}</option><option value="ar">العربية</option><option value="en">English</option></select></label><div class="course-grid" id="course-grid"></div><p class="sample-disclaimer">${t("sampleNote")}</p></section><section class="closing section"><div class="closing-star">✳</div><h2>${lang === "en" ? "You don't need to have it all figured out." : "مش لازم تكون عارف كل حاجة."}<br><i>${lang === "en" ? "Just take the next step." : "ابدأ بالخطوة الجاية."}</i></h2><button class="button-primary" id="closing-browse">${t("browse")} ↗</button></section>`;
  renderGrid();
  $("#course-language").value = courseLanguage;
  $("#course-language").onchange = (e) => {
    courseLanguage = e.target.value;
    renderGrid();
  };
  $("#hero-browse").onclick = $("#closing-browse").onclick = () =>
    $("#catalogue").scrollIntoView({ behavior: "smooth" });
  $(".search").onsubmit = (e) => e.preventDefault();
  $("#search").oninput = (e) => {
    search = e.target.value;
    renderGrid();
  };
  main.querySelectorAll("[data-category]").forEach(
    (b) =>
      (b.onclick = () => {
        category = b.dataset.category;
        render();
        $("#catalogue").scrollIntoView();
      }),
  );
  bindCards();
}
function renderGrid() {
  const matches = catalogue.filter(
    (c) =>
      (category === "All" || category === c.category) &&
      (courseLanguage === "all" || courseLanguage === c.language) &&
      `${text(c.title)} ${text(c.subtitle)} ${c.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  $("#course-grid").innerHTML = matches.length
    ? matches.map((c) => card(c)).join("")
    : `<p class="empty">${t("empty")}</p>`;
  bindCards();
}
function bindCards() {
  main
    .querySelectorAll("[data-course]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          safe(() => openCourse(b.dataset.courseId || b.dataset.course))),
    );
}
async function renderSaved() {
  const ids = await api.saved(),
    items = catalogue.filter((c) => ids.includes(c.id));
  main.innerHTML = `<section class="section learning-section"><p class="eyebrow">${t("learning")}</p><h1 class="page-title">${lang === "ar" ? "مساحة لأفكارك الجاية." : "Your next possibilities."}</h1><p class="muted">${lang === "ar" ? "كورسات حفظتها لوقت مناسب. الحفظ لا يمنح اشتراكًا." : "Courses saved for the right moment. Saving is not enrollment."}</p><div class="course-grid" style="margin-top:30px">${items.length ? items.map((c) => card(c)).join("") : `<p>${lang === "ar" ? "مفيش كورسات محفوظة لسه." : "No saved courses yet."}</p>`}</div></section>`;
  bindCards();
}
function renderLearning() {
  const mine = catalogue.filter((c) =>
    enrollments.some((e) => e.courseId === c.id),
  );
  main.innerHTML = `<section class="section learning-section"><p class="eyebrow">${t("learning")}</p><h1 class="page-title">${t("learningTitle")}</h1><p class="muted">${t("learningSub")}</p><button class="button-outline" id="view-saved" style="margin-top:22px">♡ ${lang === "ar" ? "الكورسات المحفوظة" : "Saved courses"}</button>${mine.length ? `<div class="course-grid">${mine.map((c) => card(c, true)).join("")}</div>` : `<div class="empty-state"><span>✳</span><h2>${t("noLearning")}</h2><p>${t("noLearningText")}</p><button class="button-primary" id="empty-browse">${t("browse")} ↗</button></div>`}</section>`;
  $("#view-saved").onclick = () => {
    if (!user) {
      openLogin();
      return;
    }
    view = "saved";
    render();
  };
  if ($("#empty-browse"))
    $("#empty-browse").onclick = () => {
      view = "explore";
      render();
    };
  bindCards();
}
async function openCourse(id) {
  activeCourse = await api.detail(id);
  if (!activeCourse) throw Error("Course not found");
  const c = activeCourse,
    enrolled = enrollments.some((e) => e.courseId === id);
  $("#dialog-content").innerHTML =
    `${art(c, "modal-art")}<div class="detail-content"><p class="eyebrow">${esc(catName(c.category))} / ${esc(c.level)}</p><h2 id="dialog-title">${esc(text(c.title))}</h2><p>${esc(text(c.subtitle))}</p><p class="author">${t("instructor")} ${esc(c.author)}</p><div class="detail-facts"><span>${esc(c.hours)}</span><span>${c.lessons.length} ${t("outline")}</span><strong>${esc(money(c))}</strong></div><h3>${t("curriculum")}</h3><ol class="lesson-list">${c.lessons.map((l) => `<li><span>${esc(text(l.title))}</span><small><bdi dir="ltr">${l.minutes} min</bdi></small></li>`).join("")}</ol><button class="button-primary wide" id="enroll">${enrolled ? t("continue") : c.priceCents > 0 ? (lang === "ar" ? "طلب الاشتراك" : "Request course access") : t("enroll")} ↗</button><p class="fine-print">${t("sampleNote")}</p>${user ? tools.courseActions(c, enrolled) : ""}</div>`;
  dialog.showModal();
  if (user) tools.bindCourse(c, enrolled);
  $("#enroll").onclick = () =>
    safe(async () => {
      if (!user) {
        openLogin();
        return;
      }
      if (!enrolled && c.priceCents !== 0) {
        await dash.payment(c);
        return;
      }
      if (!enrolled) await api.enroll(c.id);
      enrollments = await api.enrollments();
      dialog.close();
      activeLesson = 0;
      view = "player";
      render();
      window.scrollTo(0, 0);
    });
}
function openLogin() {
  $("#dialog-content").innerHTML =
    `<div class="auth-content"><span class="auth-symbol">✳</span><h2 id="dialog-title">${t("authTitle")}</h2><p>${t("authText")}</p><div class="role-choice"><button class="selected" data-signup-role="student">${lang === "ar" ? "طالب" : "Student"}</button><button data-signup-role="instructor">${lang === "ar" ? "مدرّس" : "Instructor"}</button></div><button class="button-primary wide" id="auth-go">${t(config.mode === "demo" ? "demoAuth" : "awsAuth")} ↗</button><p class="fine-print">${config.mode === "demo" ? t("demoAuthNote") : ""}</p></div>`;
  if (!dialog.open) dialog.showModal();
  let signupRole = "student";
  document.querySelectorAll("[data-signup-role]").forEach(
    (b) =>
      (b.onclick = () => {
        signupRole = b.dataset.signupRole;
        document
          .querySelectorAll("[data-signup-role]")
          .forEach((x) => x.classList.toggle("selected", x === b));
      }),
  );
  $("#auth-go").onclick = () =>
    safe(async () => {
      if (config.mode === "aws") {
        sessionStorage.setItem("madar.requested.role", signupRole);
        await signIn();
      } else {
        role = signupRole;
        sessionStorage.setItem("madar.demo.role", role);
        await api.role(role);
        user = { demo: true };
        sessionStorage.setItem("madar.demo.session", "1");
        enrollments = await api.enrollments();
        dialog.close();
        render();
        toast(t("demoAuthNote"));
      }
    });
}
function renderPlayer() {
  const c = activeCourse,
    l = c.lessons[activeLesson],
    en = enrollments.find((e) => e.courseId === c.id),
    percent = Math.round(
      ((en?.completed.length || 0) / c.lessons.length) * 100,
    );
  main.innerHTML = `<section class="player-top"><button class="text-button" id="player-back">← ${t("back")}</button><span>${t("workspace")}</span></section><div class="player-layout"><aside class="curriculum"><h2>${esc(text(c.title))}</h2><p>${t("progress")} <b>${percent}%</b></p><div class="progress-line"><span style="width:${percent}%"></span></div><ol>${c.lessons.map((lesson, i) => `<li><button class="${activeLesson === i ? "current" : ""}" data-lesson="${i}"><span>${en?.completed.includes(lesson.id) ? "✓" : String(i + 1).padStart(2, "0")}</span><span>${esc(text(lesson.title))}<small><bdi dir="ltr">${lesson.minutes} min</bdi></small></span></button></li>`).join("")}</ol></aside><article class="lesson-content"><p class="eyebrow">${t("lesson")} <bdi dir="ltr">${activeLesson + 1} / ${c.lessons.length}</bdi></p><h1>${esc(text(l.title))}</h1><div class="reading-note">${config.mode === "demo" ? t("lessonSample") : l.type === "video" ? (lang === "ar" ? "درس فيديو خاص" : "PRIVATE VIDEO LESSON") : lang === "ar" ? "درس نصي خاص" : "PRIVATE TEXT LESSON"}</div><div class="lesson-body" id="lesson-body">${config.mode === "demo" ? paragraphs(text(l.body)) : t("loading")}</div><button class="button-primary" id="complete-lesson">${en?.completed.includes(l.id) ? t("done") : t("mark")} ↗</button><p class="fine-print">${t("sampleNote")}</p><div class="course-tools"><button class="button-outline" id="lesson-note">${lang === "ar" ? "ملاحظتي الخاصة" : "My private note"}</button><button class="button-outline" id="course-questions">${lang === "ar" ? "أسئلة الكورس" : "Course questions"}</button></div><button class="text-button" id="report-course">${lang === "ar" ? "الإبلاغ عن مشكلة في المحتوى" : "Report a content concern"}</button>${tools.playerActions(c, en)}</article></div>`;
  tools.bindPlayer(c);
  $("#report-course").onclick = () => safety.report(c);
  $("#lesson-note").onclick = () => safe(() => community.notes(c, l));
  $("#course-questions").onclick = () => safe(() => community.questions(c));
  $("#player-back").onclick = () => {
    view = "learning";
    render();
  };
  main.querySelectorAll("[data-lesson]").forEach(
    (b) =>
      (b.onclick = () => {
        activeLesson = Number(b.dataset.lesson);
        renderPlayer();
      }),
  );
  $("#complete-lesson").onclick = () =>
    safe(async () => {
      await api.progress(c.id, l.id);
      enrollments = await api.enrollments();
      if (activeLesson < c.lessons.length - 1) activeLesson++;
      renderPlayer();
      toast(t("saved"));
    });
  if (config.mode === "aws") {
    safe(async () => {
      const result = await api.media(c.id, l.id);
      if (
        view !== "player" ||
        activeCourse.id !== c.id ||
        activeCourse.lessons[activeLesson].id !== l.id
      )
        return;
      if (result.type === "text")
        $("#lesson-body").innerHTML = paragraphs(text(result.body));
      else if (result.type === "video") {
        const video = document.createElement("video");
        video.controls = true;
        video.preload = "metadata";
        video.src = result.url;
        $("#lesson-body").replaceChildren(video);
      } else throw Error("Unsupported lesson format");
    });
  }
}
function paragraphs(body) {
  return String(body || "")
    .split("\n\n")
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");
}
$("#workspace-nav").onclick = () => {
  view = "dashboard";
  render();
};
$("#demo-tools").onclick = () => dash.demoRoles();
$("#close-dialog").onclick = () => dialog.close();
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
$("#language").onclick = () => {
  lang = lang === "en" ? "ar" : "en";
  localStorage.setItem("madar.language", lang);
  if (dialog.open) dialog.close();
  render();
};
$("#explore-nav").onclick = () => {
  view = "explore";
  render();
};
$("#learning-nav").onclick = () => {
  view = "learning";
  render();
};
$(".header .brand").onclick = (e) => {
  e.preventDefault();
  view = "explore";
  render();
  window.scrollTo(0, 0);
};
$("#login").onclick = () =>
  safe(async () => {
    if (user) {
      if (config.mode === "aws") await signOut();
      else {
        sessionStorage.removeItem("madar.demo.session");
        user = null;
        enrollments = [];
        view = "explore";
        render();
      }
    } else openLogin();
  });
async function start() {
  main.innerHTML = `<div class="empty-state">${t("loading")}</div>`;
  try {
    validateConfig();
    user =
      config.mode === "demo"
        ? sessionStorage.getItem("madar.demo.session")
          ? { demo: true }
          : null
        : await initializeAuth();
    catalogue = await api.list();
    if (user) {
      if (config.mode === "aws") {
        let profile = await api.me();
        const requested = sessionStorage.getItem("madar.requested.role");
        if (profile.needsRole) {
          await api.role(requested === "instructor" ? "instructor" : "student");
          profile = await api.me();
        }
        sessionStorage.removeItem("madar.requested.role");
        role = profile.role;
      }
      enrollments = await api.enrollments();
    }
    render();
  } catch (e) {
    shell();
    main.innerHTML = `<section class="section empty-state"><h1>${t("error")}</h1><p>${esc(e.message)}</p><button class="button-primary" id="retry">${t("retry")}</button></section>`;
    $("#retry").onclick = start;
  }
}
start();
