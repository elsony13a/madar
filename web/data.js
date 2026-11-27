export const courses = [
  {
    id: "aws-foundations",
    category: "Cloud",
    title: {
      en: "Build your first cloud architecture",
      ar: "ابنِ أول تصميم لك على السحابة",
    },
    subtitle: {
      en: "From a blank canvas to a thoughtful AWS architecture. One practical step at a time.",
      ar: "من صفحة بيضاء لتصميم عملي على AWS، خطوة بخطوة.",
    },
    author: "Madar Studio",
    level: "Beginner",
    hours: "4h 20m",
    color: "cloud",
    tag: { en: "START HERE", ar: "ابدأ هنا" },
    priceCents: 0,
    lessons: [
      {
        id: "cloud-1",
        title: { en: "Think in building blocks", ar: "فكّر في مكونات النظام" },
        minutes: 12,
        body: {
          en: "A cloud architecture is a set of choices. Start with who uses the application, what data it stores, and which operations must be private. Sketch a browser, an API, and a data store before choosing services.\n\nPractice: draw a learning platform. Mark the sign-in boundary and show which requests require an authenticated user.",
          ar: "تصميم السحابة عبارة عن اختيارات. ابدأ بالمستخدمين والبيانات والعمليات الخاصة. ارسم المتصفح وواجهة API ومخزن البيانات قبل اختيار الخدمات.\n\nتدريب: ارسم منصة تعليمية وحدد حدود تسجيل الدخول والطلبات التي تحتاج مستخدمًا مسجلًا.",
        },
      },
      {
        id: "cloud-2",
        title: {
          en: "Identity before infrastructure",
          ar: "الهوية قبل البنية التحتية",
        },
        minutes: 18,
        body: {
          en: "Authentication answers who you are. Authorization answers what you can do. A signed-in learner should not gain access to another learner's progress by changing a user ID in a request.\n\nPractice: list three actions that require authorization in your platform.",
          ar: "المصادقة تحدد من أنت. الصلاحيات تحدد ما يمكنك فعله. لا يجب أن يصل طالب لتقدم طالب آخر بتغيير رقم المستخدم في الطلب.\n\nتدريب: اكتب ثلاث عمليات تحتاج تحققًا من الصلاحيات.",
        },
      },
      {
        id: "cloud-3",
        title: {
          en: "A small, testable first release",
          ar: "إصدار أول صغير قابل للاختبار",
        },
        minutes: 15,
        body: {
          en: "Choose one complete journey: browse a course, sign in, enroll in a free course, and save progress. Test failure cases as carefully as the happy path.\n\nPractice: write an acceptance check for an expired token, a missing course, and a denied lesson request.",
          ar: "اختر رحلة واحدة متكاملة: تصفح كورس، سجل الدخول، انضم لكورس مجاني، واحفظ تقدمك. اختبر الفشل مثل النجاح.\n\nتدريب: اكتب اختبار قبول لتوكن منتهي وكورس غير موجود وطلب درس مرفوض.",
        },
      },
    ],
  },
  {
    id: "interfaces",
    category: "Design",
    title: {
      en: "Interfaces that feel effortless",
      ar: "واجهات سهلة من أول استخدام",
    },
    subtitle: {
      en: "Learn hierarchy, spacing and the small decisions behind useful interfaces.",
      ar: "تعلّم ترتيب المحتوى والمسافات والقرارات الصغيرة التي تصنع واجهة مفيدة.",
    },
    author: "Madar Studio",
    level: "Beginner",
    hours: "3h 10m",
    color: "design",
    tag: { en: "DESIGN YOUR NEXT", ar: "صمّم خطوتك القادمة" },
    priceCents: 0,
  },
  {
    id: "javascript",
    category: "Development",
    title: {
      en: "JavaScript, from idea to interaction",
      ar: "JavaScript: من الفكرة للتفاعل",
    },
    subtitle: {
      en: "Turn a static page into a useful interactive experience.",
      ar: "حوّل الصفحة الثابتة لتجربة تفاعلية مفيدة.",
    },
    author: "Madar Studio",
    level: "Intermediate",
    hours: "5h 05m",
    color: "code",
    tag: { en: "BUILD SOMETHING", ar: "ابنِ شيئًا جديدًا" },
    priceCents: 0,
  },
  {
    id: "data-stories",
    category: "Data",
    title: {
      en: "Find the story in your data",
      ar: "اكتشف القصة داخل بياناتك",
    },
    subtitle: {
      en: "Ask clearer questions. Build charts that answer them.",
      ar: "اسأل بوضوح وابنِ رسومًا تجيب عن أسئلتك.",
    },
    author: "Madar Studio",
    level: "Beginner",
    hours: "2h 45m",
    color: "data",
    tag: { en: "SEE DIFFERENTLY", ar: "انظر بشكل مختلف" },
    priceCents: 0,
  },
  {
    id: "brand-systems",
    category: "Design",
    title: {
      en: "A brand is more than a logo",
      ar: "الهوية أكبر من مجرد شعار",
    },
    subtitle: {
      en: "Explore type, color and a consistent visual language.",
      ar: "اكتشف الخطوط والألوان واللغة البصرية المتناسقة.",
    },
    author: "Madar Studio",
    level: "Intermediate",
    hours: "3h 35m",
    color: "brand",
    tag: { en: "MAKE YOUR MARK", ar: "اترك بصمتك" },
    priceCents: 0,
  },
  {
    id: "product-thinking",
    category: "Business",
    title: {
      en: "Make better product decisions",
      ar: "اتخذ قرارات أفضل لمنتجك",
    },
    subtitle: {
      en: "Start with the problem. Test your assumptions. Build with purpose.",
      ar: "ابدأ بالمشكلة، اختبر افتراضاتك وابنِ بهدف واضح.",
    },
    author: "Madar Studio",
    level: "Beginner",
    hours: "2h 30m",
    color: "product",
    tag: { en: "IDEAS INTO IMPACT", ar: "من الفكرة للأثر" },
    priceCents: 0,
  },
];
courses.forEach((c, i) => {
  c.language = i % 2 ? "ar" : "en";
  c.currency = "EGP";
  if ([1, 2, 4].includes(i)) c.priceCents = [0, 34900, 49900, 0, 24900][i];
});
for (const c of courses)
  if (!c.lessons)
    c.lessons = [
      {
        id: c.id + "-1",
        title: {
          en: "A question worth starting with",
          ar: "سؤال يستحق البداية",
        },
        minutes: 10,
        body: {
          en: "This is an original sample lesson for the interface demo, not a complete published course.\n\nStart a project notebook. Describe one problem you want to solve, who experiences it, and how you would know your solution helped. Keep the first experiment small enough to complete and review.\n\nPractice: write a one-paragraph brief and define one observable success measure.",
          ar: "هذا درس تجريبي أصلي لاختبار الواجهة، وليس كورسًا منشورًا كاملًا.\n\nافتح دفترًا للمشروع. اكتب مشكلة تريد حلها، ومن يواجهها، وكيف تعرف أن حلك أفاده. اجعل التجربة الأولى صغيرة بما يكفي لتنفيذها ومراجعتها.\n\nتدريب: اكتب وصفًا من فقرة واحدة وحدد مقياس نجاح يمكن ملاحظته.",
        },
      },
      {
        id: c.id + "-2",
        title: { en: "Practice, reflect, repeat", ar: "طبّق وراجع وكرّر" },
        minutes: 15,
        body: {
          en: "Build a small version, then review it against your original question. Note one thing that worked, one thing that confused you, and the next change you would test.\n\nThe sample ends here. Replace these lessons with your own reviewed curriculum before launch.",
          ar: "ابنِ نسخة صغيرة ثم راجعها على أساس السؤال الأول. اكتب شيئًا نجح وشيئًا لم يكن واضحًا والتغيير التالي الذي ستختبره.\n\nتنتهي العينة هنا. استبدل هذه الدروس بمحتواك بعد مراجعته قبل الإطلاق.",
        },
      },
    ];
