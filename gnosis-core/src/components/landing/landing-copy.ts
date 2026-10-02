export type Locale = "en" | "ar"

export const WHATSAPP_NUMBER = "+91 9846 949940"
export const WHATSAPP_URL = "https://wa.me/919846949940"

export interface Copy {
  dir: "ltr" | "rtl"
  langLabel: string
  nav: {
    features: string
    parents: string
    pricing: string
    faq: string
    signIn: string
    getStarted: string
  }
  hero: {
    badge: string
    titleBefore: string
    titleHighlight: string
    titleAfter: string
    subtitle: string
    ctaPrimary: string
    ctaParent: string
  }
  curricula: {
    label: string
    items: string[]
  }
  features: {
    title: string
    items: { title: string; desc: string }[]
  }
  how: {
    title: string
    subtitle: string
    steps: { title: string; desc: string }[]
  }
  parents: {
    badge: string
    title: string
    subtitle: string
    benefits: { title: string; desc: string }[]
    priceAmount: string
    pricePeriod: string
    priceAnchor: string
    cta: string
    whatsapp: string
    whatsappNote: string
    mockup: {
      title: string
      sampleNote: string
      avgScore: string
      delta: string
      since: string
      testsTaken: string
      accuracy: string
      strengths: string
      focus: string
      errorRate: string
      strengthRows: { topic: string; pct: number }[]
      focusRows: { topic: string; pct: number; suggestion: string }[]
    }
  }
  pricing: {
    title: string
    subtitle: string
    plans: {
      name: string
      amount: string
      period: string
      features: string[]
      cta: string
      highlight: boolean
    }[]
  }
  faq: {
    title: string
    items: { q: string; a: string }[]
  }
  footer: {
    tagline: string
    contact: string
  }
}

const en: Copy = {
  dir: "ltr",
  langLabel: "العربية",
  nav: {
    features: "Features",
    parents: "For Parents",
    pricing: "Pricing",
    faq: "FAQ",
    signIn: "Sign in",
    getStarted: "Get started free",
  },
  hero: {
    badge: "AI-powered · Unlimited practice · Free to start",
    titleBefore: "Finally,",
    titleHighlight: "free from school stress.",
    titleAfter: "We do the daily practice — you enjoy the results.",
    subtitle:
      "Upload your school material. Configure your test. Let AI generate an endless stream of perfectly calibrated questions — then show you exactly what to work on next.",
    ctaPrimary: "Start for free",
    ctaParent: "Explore Parent Weekly Plans (AED 100/mo)",
  },
  curricula: {
    label: "Built for the curricula your child actually studies",
    items: ["Cambridge IGCSE", "Edexcel", "IB", "CBSE / ICSE", "American / AP"],
  },
  features: {
    title: "Everything you need to build real mastery",
    items: [
      {
        title: "AI-Generated Questions",
        desc: "Upload any PDF or image and get an infinite stream of practice questions tailored to your material.",
      },
      {
        title: "Adaptive Difficulty",
        desc: "Choose Easy, Medium, Hard, or Advanced. The AI matches the depth of your chosen level precisely.",
      },
      {
        title: "Timed Practice",
        desc: "Set per-question timers and total test limits to simulate real exam pressure.",
      },
      {
        title: "Deep Analytics",
        desc: "Get AI diagnostic reports identifying your exact strengths and conceptual gaps.",
      },
      {
        title: "Shareable Tests",
        desc: "Invite anyone via Gmail to take a test you configured. Collaborate and compete.",
      },
    ],
  },
  how: {
    title: "Three steps. No extra workload.",
    subtitle: "You upload what the school sent home. We handle the practice, the marking and the analysis.",
    steps: [
      {
        title: "Upload the school material",
        desc: "A worksheet, a textbook chapter, a photo of the homework. Any PDF or image works.",
      },
      {
        title: "They practise weekly",
        desc: "We generate 100+ questions per subject per week, calibrated to their level.",
      },
      {
        title: "You get the diagnostic",
        desc: "A clear report on strengths, gaps and exactly what to work on next — delivered weekly.",
      },
    ],
  },
  parents: {
    badge: "For Parents",
    title: "How's school going? Here's what to study next.",
    subtitle:
      "Built for IGCSE, IB, CBSE and American curriculum students in the UAE and across the Middle East. Get 100+ weekly practice questions per subject and automated AI diagnostic reports delivered straight to your inbox.",
    benefits: [
      {
        title: "Tension-free parenting",
        desc: "No more asking “how was school?” and getting a shrug. Know exactly where your child stands, every week, without a single argument.",
      },
      {
        title: "Zero added workload",
        desc: "Nothing new to supervise. You upload what the school already sent home and we do the rest — no lesson planning, no marking.",
      },
      {
        title: "Transparent scores & recommendations",
        desc: "A parent dashboard with honest scores and a concrete “what to work on this week” list — not vague encouragement.",
      },
    ],
    priceAmount: "AED 100",
    pricePeriod: "/ month",
    priceAnchor: "Less than a single hour of private tutoring — for a whole month.",
    cta: "Get Started for Free Diagnostic Test",
    whatsapp: "Chat with us on WhatsApp",
    whatsappNote: "Instant support for parents",
    mockup: {
      title: "Weekly Parent Report",
      sampleNote: "Illustrative sample data",
      avgScore: "Avg. score",
      delta: "+12",
      since: "since first test",
      testsTaken: "Tests taken",
      accuracy: "Accuracy",
      strengths: "Core strengths",
      focus: "Areas to focus on",
      errorRate: "error rate",
      strengthRows: [
        { topic: "Algebra", pct: 92 },
        { topic: "Trigonometry", pct: 85 },
        { topic: "Probability", pct: 78 },
      ],
      focusRows: [
        {
          topic: "Quadratic Equations",
          pct: 46,
          suggestion: "Revisit factorising and the discriminant before the next test.",
        },
        {
          topic: "Circle Theorems",
          pct: 38,
          suggestion: "Practise angle-chasing proofs — three short sets this week.",
        },
      ],
    },
  },
  pricing: {
    title: "Simple pricing",
    subtitle: "Start free. Upgrade only when you want the weekly parent reports.",
    plans: [
      {
        name: "Student",
        amount: "Free",
        period: "forever",
        features: [
          "AI question generation from your material",
          "Unlimited practice tests",
          "Instant AI diagnostic reports",
          "Shareable tests via Gmail",
        ],
        cta: "Start for free",
        highlight: false,
      },
      {
        name: "Parent Weekly Plans",
        amount: "AED 100",
        period: "/ month",
        features: [
          "Everything in Student, for your child",
          "100+ weekly practice questions per subject",
          "Weekly diagnostic report delivered to your inbox",
          "Parent dashboard with scores and recommendations",
          "Curriculum-aligned: IGCSE, IB, CBSE, American",
        ],
        cta: "Get Started for Free Diagnostic Test",
        highlight: true,
      },
    ],
  },
  faq: {
    title: "Questions parents ask",
    items: [
      {
        q: "Does it follow my child's school curriculum?",
        a: "Yes. You upload the exact material your child's school sends home — worksheets, textbook chapters, homework photos — and the questions are generated from that material. We also support Cambridge IGCSE, Edexcel, IB, CBSE/ICSE and American/AP.",
      },
      {
        q: "How much time does this take out of my week?",
        a: "For you, a few minutes to upload the material. Your child practises on their own, and we handle the marking and the analysis. The weekly report arrives on its own.",
      },
      {
        q: "Is it a replacement for a private tutor?",
        a: "It replaces the part of tutoring that is practice and diagnosis — which is most of it, and the most expensive part. If your child needs live teaching on a specific topic, the report tells you exactly which one.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. The parent plan is monthly with no lock-in. Cancel whenever you like and keep free student access.",
      },
    ],
  },
  footer: {
    tagline: "AI-powered practice and diagnostics for IGCSE, IB, CBSE and American curricula.",
    contact: "WhatsApp support",
  },
}

const ar: Copy = {
  dir: "rtl",
  langLabel: "English",
  nav: {
    features: "المزايا",
    parents: "لأولياء الأمور",
    pricing: "الأسعار",
    faq: "الأسئلة الشائعة",
    signIn: "تسجيل الدخول",
    getStarted: "ابدأ مجانًا",
  },
  hero: {
    badge: "مدعوم بالذكاء الاصطناعي · تدريب بلا حدود · البدء مجاني",
    titleBefore: "أخيرًا،",
    titleHighlight: "تحرّرت من ضغط المدرسة.",
    titleAfter: "نحن نتولى التدريب اليومي — وأنت تستمتع بالنتائج.",
    subtitle:
      "ارفع موادك الدراسية، واضبط اختبارك، ودع الذكاء الاصطناعي يولّد تدفقًا لا ينتهي من الأسئلة المعايرة بدقة — ثم أخبرك بما يجب العمل عليه تاليًا.",
    ctaPrimary: "ابدأ مجانًا",
    ctaParent: "استكشف الخطط الأسبوعية لولي الأمر (١٠٠ درهم شهريًا)",
  },
  curricula: {
    label: "مصمّم للمناهج التي يدرسها طفلك فعليًا",
    items: ["كامبريدج IGCSE", "إيدكسل", "البكالوريا الدولية IB", "CBSE / ICSE", "أمريكي / AP"],
  },
  features: {
    title: "كل ما تحتاجه لبناء إتقان حقيقي",
    items: [
      {
        title: "أسئلة يولّدها الذكاء الاصطناعي",
        desc: "ارفع أي ملف PDF أو صورة واحصل على تدفق لا نهائي من أسئلة التدريب المخصصة لموادك.",
      },
      {
        title: "صعوبة متكيفة",
        desc: "اختر سهلًا أو متوسطًا أو صعبًا أو متقدمًا. يطابق الذكاء الاصطناعي عمق المستوى الذي تختاره بدقة.",
      },
      {
        title: "تدريب موقوت",
        desc: "اضبط مؤقتًا لكل سؤال وحدودًا زمنية للاختبار كامل لمحاكاة ضغط الامتحان الحقيقي.",
      },
      {
        title: "تحليلات معمّقة",
        desc: "احصل على تقارير تشخيصية بالذكاء الاصطناعي تحدد نقاط قوتك وثغراتك المفاهيمية بدقة.",
      },
      {
        title: "اختبارات قابلة للمشاركة",
        desc: "ادعُ أي شخص عبر Gmail لأداء اختبار أعددته. تعاون وتنافس.",
      },
    ],
  },
  how: {
    title: "ثلاث خطوات. بلا أي عبء إضافي.",
    subtitle: "ارفع ما أرسلته المدرسة فقط. نحن نتولى التدريب والتصحيح والتحليل.",
    steps: [
      {
        title: "ارفع المواد الدراسية",
        desc: "ورقة عمل، أو فصلًا من كتاب، أو صورة للواجب. أي ملف PDF أو صورة يكفي.",
      },
      {
        title: "يتدرّب طفلك أسبوعيًا",
        desc: "نولّد أكثر من ١٠٠ سؤال لكل مادة أسبوعيًا، معايرة لمستواه.",
      },
      {
        title: "تستلم التقرير التشخيصي",
        desc: "تقرير واضح عن نقاط القوة والثغرات وما يجب العمل عليه تاليًا — يصل أسبوعيًا.",
      },
    ],
  },
  parents: {
    badge: "لأولياء الأمور",
    title: "كيف تسير المدرسة؟ إليك ما يجب دراسته تاليًا.",
    subtitle:
      "مصمّم لطلاب IGCSE وIB وCBSE والمناهج الأمريكية في الإمارات والشرق الأوسط. احصل على أكثر من ١٠٠ سؤال تدريبي أسبوعيًا لكل مادة، وتقارير تشخيصية آلية بالذكاء الاصطناعي تصل مباشرة إلى بريدك.",
    benefits: [
      {
        title: "تربية بلا قلق",
        desc: "لا مزيد من سؤال «كيف كان يومك الدراسي؟» دون إجابة واضحة. اعرف بالضبط مستوى طفلك كل أسبوع، دون أي جدال.",
      },
      {
        title: "بلا أي عبء إضافي",
        desc: "لا شيء جديد لتتابعه. ارفع ما أرسلته المدرسة بالفعل ونحن نتولى الباقي — بلا تحضير دروس ولا تصحيح.",
      },
      {
        title: "درجات شفافة وتوصيات للتحسين",
        desc: "لوحة تحكم لولي الأمر تعرض درجات صادقة وقائمة محددة بما يجب العمل عليه هذا الأسبوع — لا عبارات تشجيع عامة.",
      },
    ],
    priceAmount: "١٠٠ درهم",
    pricePeriod: "/ شهريًا",
    priceAnchor: "أقل من تكلفة ساعة واحدة من الدروس الخصوصية — لشهر كامل.",
    cta: "ابدأ باختبار تشخيصي مجاني",
    whatsapp: "تحدّث معنا على واتساب",
    whatsappNote: "دعم فوري لأولياء الأمور",
    mockup: {
      title: "تقرير ولي الأمر الأسبوعي",
      sampleNote: "بيانات توضيحية",
      avgScore: "متوسط الدرجة",
      delta: "+١٢",
      since: "منذ أول اختبار",
      testsTaken: "الاختبارات المُنجزة",
      accuracy: "الدقة",
      strengths: "نقاط القوة الأساسية",
      focus: "مجالات التركيز",
      errorRate: "نسبة الخطأ",
      strengthRows: [
        { topic: "الجبر", pct: 92 },
        { topic: "حساب المثلثات", pct: 85 },
        { topic: "الاحتمالات", pct: 78 },
      ],
      focusRows: [
        {
          topic: "المعادلات التربيعية",
          pct: 46,
          suggestion: "راجع التحليل إلى عوامل والمميّز قبل الاختبار القادم.",
        },
        {
          topic: "نظريات الدائرة",
          pct: 38,
          suggestion: "تدرّب على براهين تتبّع الزوايا — ثلاث مجموعات قصيرة هذا الأسبوع.",
        },
      ],
    },
  },
  pricing: {
    title: "أسعار بسيطة",
    subtitle: "ابدأ مجانًا، وارتقِ فقط عندما تريد التقارير الأسبوعية لولي الأمر.",
    plans: [
      {
        name: "الطالب",
        amount: "مجانًا",
        period: "دائمًا",
        features: [
          "توليد أسئلة بالذكاء الاصطناعي من موادك",
          "اختبارات تدريبية بلا حدود",
          "تقارير تشخيصية فورية بالذكاء الاصطناعي",
          "اختبارات قابلة للمشاركة عبر Gmail",
        ],
        cta: "ابدأ مجانًا",
        highlight: false,
      },
      {
        name: "الخطط الأسبوعية لولي الأمر",
        amount: "١٠٠ درهم",
        period: "/ شهريًا",
        features: [
          "كل ما في خطة الطالب، لطفلك",
          "أكثر من ١٠٠ سؤال تدريبي أسبوعيًا لكل مادة",
          "تقرير تشخيصي أسبوعي يصل إلى بريدك",
          "لوحة تحكم لولي الأمر بالدرجات والتوصيات",
          "متوافق مع المناهج: IGCSE وIB وCBSE والأمريكي",
        ],
        cta: "ابدأ باختبار تشخيصي مجاني",
        highlight: true,
      },
    ],
  },
  faq: {
    title: "أسئلة يطرحها أولياء الأمور",
    items: [
      {
        q: "هل يتبع المنهج الذي يدرسه طفلي في المدرسة؟",
        a: "نعم. ترفع المواد التي ترسلها المدرسة فعليًا — أوراق العمل، وفصول الكتب، وصور الواجبات — وتُولَّد الأسئلة من تلك المواد. كما ندعم كامبريدج IGCSE وإيدكسل وIB وCBSE/ICSE والمناهج الأمريكية/AP.",
      },
      {
        q: "كم من الوقت سيأخذ من أسبوعي؟",
        a: "بضع دقائق لرفع المواد. يتدرّب طفلك بنفسه، ونحن نتولى التصحيح والتحليل. ويصل التقرير الأسبوعي تلقائيًا.",
      },
      {
        q: "هل يغني عن المدرّس الخصوصي؟",
        a: "إنه يحل محل الجزء الخاص بالتدريب والتشخيص من التدريس الخصوصي — وهو معظمه، وأكلف جزء فيه. إن احتاج طفلك شرحًا مباشرًا لموضوع معين، سيحدد التقرير هذا الموضوع بدقة.",
      },
      {
        q: "هل يمكنني الإلغاء في أي وقت؟",
        a: "نعم. الخطة الشهرية بلا ارتباط بفترة محددة. ألغِ متى شئت واحتفظ بالوصول المجاني للطالب.",
      },
    ],
  },
  footer: {
    tagline: "تدريب وتشخيص مدعومان بالذكاء الاصطناعي لمناهج IGCSE وIB وCBSE والأمريكي.",
    contact: "دعم واتساب",
  },
}

export const copy: Record<Locale, Copy> = { en, ar }
