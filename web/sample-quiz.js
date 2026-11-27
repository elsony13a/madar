export const sampleQuiz = {
  passPercent: 67,
  questions: [
    {
      id: "question-1",
      prompt: {
        en: "What does authorization decide?",
        ar: "الصلاحيات بتحدد إيه؟",
      },
      options: [
        {
          en: "What a signed-in person may do",
          ar: "العمليات المسموح بها للمستخدم",
        },
        { en: "The color of a button", ar: "لون الزر" },
        { en: "The speed of a video", ar: "سرعة الفيديو" },
      ],
      correctIndex: 0,
    },
    {
      id: "question-2",
      prompt: {
        en: "Should a receipt image unlock a paid course immediately?",
        ar: "هل صورة التحويل تفتح الكورس المدفوع فورًا؟",
      },
      options: [
        { en: "Yes, any image is enough", ar: "أيوه، أي صورة تكفي" },
        {
          en: "No, authorized review must approve the request",
          ar: "لا، لازم مراجعة وقبول بصلاحية معتمدة",
        },
      ],
      correctIndex: 1,
    },
    {
      id: "question-3",
      prompt: {
        en: "Where should private lesson access be checked?",
        ar: "فين لازم نتحقق من صلاحية الدرس الخاص؟",
      },
      options: [
        {
          en: "Only by hiding a frontend button",
          ar: "بإخفاء زر في الواجهة فقط",
        },
        { en: "On the backend for each request", ar: "في السيرفر مع كل طلب" },
      ],
      correctIndex: 1,
    },
  ],
};
