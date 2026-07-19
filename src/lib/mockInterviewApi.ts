import type {
  AnswerWithFeedback,
  DashboardStats,
  Difficulty,
  Feedback,
  FinalReport,
  InterviewSetup,
  InterviewType,
  JobRole,
  Question,
  SessionSummary,
} from "./types";

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const mockUser = {
  name: "Demo User",
  email: "demo@interviewready.test",
};

const INTERVIEW_TIPS = [
  "Use the STAR method: Situation, Task, Action, Result.",
  "Quantify your impact with concrete details when possible.",
  "Pause briefly before answering — it shows thoughtfulness.",
  "End answers with the result, not just the action.",
  "For role-specific and situational questions, explain your professional reasoning clearly.",
];

/**
 * These question banks provide stronger local fallback questions
 * for several common roles.
 *
 * Users are not restricted to these roles. Any custom role will
 * receive category-aware and general role-specific questions.
 */
const QUESTION_BANK: Record<string, string[]> = {
  "IT Support Intern": [
    "Tell me about yourself.",
    "Why do you want this internship?",
    "How would you troubleshoot a computer that cannot connect to Wi-Fi?",
    "What is DNS?",
    "Tell me about a project you worked on.",
    "How would you help a non-technical user reset their password?",
    "Explain the difference between RAM and storage.",
    "What steps would you take if a printer is offline?",
    "How do you prioritize multiple support tickets?",
    "Describe a time you learned a new technology quickly.",
  ],

  "Software Developer Intern": [
    "Tell me about yourself.",
    "Walk me through a project you're proud of.",
    "Explain the difference between an array and a linked list.",
    "What is the difference between HTTP and HTTPS?",
    "How do you debug code you did not write?",
    "Describe object-oriented programming in your own words.",
    "What is version control and why is it useful?",
    "How would you design a simple to-do application?",
    "Explain what an API is to a non-technical person.",
    "Tell me about a time you fixed a difficult bug.",
  ],

  "Network Administrator": [
    "Tell me about yourself.",
    "Explain the OSI model briefly.",
    "What is the difference between TCP and UDP?",
    "How would you troubleshoot a slow network?",
    "What is a subnet and why is it useful?",
    "Describe a VLAN and when you would use one.",
    "What is the difference between a switch and a router?",
    "How do you secure a wireless network?",
    "Explain DHCP and DNS.",
    "Tell me about a network issue you resolved.",
  ],

  "Cybersecurity Intern": [
    "Tell me about yourself.",
    "What is the CIA triad?",
    "Explain phishing and how to defend against it.",
    "What is the difference between symmetric and asymmetric encryption?",
    "How would you respond to a suspected data breach?",
    "What is multi-factor authentication?",
    "Describe a recent cybersecurity topic you found interesting.",
    "What is a firewall?",
    "Explain SQL injection in simple terms.",
    "Why do you want to work in cybersecurity?",
  ],

  "Customer Service Assistant": [
    "Tell me about yourself.",
    "How do you handle an angry customer?",
    "Describe a time you went above and beyond for a customer.",
    "How do you stay patient under pressure?",
    "What does great customer service mean to you?",
    "Tell me about a time you handled a complaint.",
    "How do you manage multiple tasks at once?",
    "Describe a time you worked in a team.",
    "Why do you want this role?",
    "How do you handle feedback?",
  ],
};

type MockSetupValues = {
  role: string;
  targetRole: string;
  targetCompany: string;
  type: InterviewType;
  difficulty: Difficulty;
  questionCount: number;
  resumeSkills: string[];
  resumeProjects: string[];
  jobDescription: string;
  companyChallenges: string[];
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getWordCount(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function clampTen(score: number) {
  return Math.min(
    Math.max(Math.round(score), 0),
    10,
  );
}

function getSetupValues(
  setupOrRole: InterviewSetup | JobRole,
  type?: InterviewType,
  count?: number,
): MockSetupValues {
  if (typeof setupOrRole === "string") {
    const cleanRole =
      setupOrRole.trim() || "your target role";

    return {
      role: cleanRole,
      targetRole: cleanRole,
      targetCompany: "",
      type: type || "Mixed Interview",
      difficulty: "Internship",
      questionCount: count || 5,
      resumeSkills: [],
      resumeProjects: [],
      jobDescription: "",
      companyChallenges: [],
    };
  }

  const cleanRole =
    setupOrRole.targetRole?.trim() ||
    setupOrRole.role?.trim() ||
    "your target role";

  return {
    role:
      setupOrRole.role?.trim() ||
      cleanRole,

    targetRole: cleanRole,

    targetCompany:
      setupOrRole.targetCompany?.trim() ||
      "",

    type: setupOrRole.type,

    difficulty: setupOrRole.difficulty,

    questionCount:
      setupOrRole.questionCount,

    resumeSkills:
      setupOrRole.resumeSkills ||
      setupOrRole.resume?.skills ||
      [],

    resumeProjects:
      setupOrRole.resumeProjects ||
      setupOrRole.resume?.projects ||
      [],

    jobDescription:
      setupOrRole.jobDescription?.trim() ||
      "",

    companyChallenges:
      setupOrRole.companyContext?.companyChallenges ||
      [],
  };
}

function findExactQuestionBank(
  role: string,
) {
  const normalizedRole =
    normalizeText(role);

  const matchingEntry =
    Object.entries(QUESTION_BANK).find(
      ([bankRole]) =>
        normalizeText(bankRole) ===
        normalizedRole,
    );

  return matchingEntry?.[1] || null;
}

function includesAny(
  value: string,
  keywords: string[],
) {
  return keywords.some((keyword) =>
    value.includes(keyword),
  );
}

function getCategoryQuestions(
  targetRole: string,
) {
  const normalizedRole =
    normalizeText(targetRole);

  if (
    includesAny(normalizedRole, [
      "doctor",
      "medical officer",
      "physician",
      "nurse",
      "nursing",
      "clinical",
      "healthcare",
      "pharmacist",
    ])
  ) {
    return [
      `What professional knowledge and responsibilities are most important for a ${targetRole}?`,
      "How do you make safe decisions when information is incomplete or a condition changes?",
      "How do you communicate clearly and compassionately with patients and families?",
      "Describe how you protect confidentiality and follow professional ethics.",
      "How do you work effectively with a multidisciplinary team?",
      "What steps do you take to prevent errors and protect patient safety?",
      "How would you respond if you were concerned about a colleague's decision?",
      "Describe a clinical placement, simulation, case, or professional experience that developed your judgement.",
      "How do you prioritise when several people need attention?",
      "How do you keep your healthcare knowledge and practice current?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "architect",
      "architecture",
      "architectural",
      "urban designer",
      "interior architect",
    ])
  ) {
    return [
      "Walk me through a portfolio project and explain your individual design decisions.",
      "How do you balance client requirements, regulations, usability, cost, and design quality?",
      "How do building regulations and planning constraints influence your design process?",
      "How do you incorporate sustainability into a project?",
      "How do you respond when a client challenges your design recommendation?",
      "Which design, modelling, or documentation tools do you use and why?",
      "How do you coordinate with engineers, consultants, contractors, and other stakeholders?",
      "Describe how you develop a concept into a practical design proposal.",
      "How do you check drawings and documentation for quality and accuracy?",
      "Describe a design trade-off you made and how you justified it.",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "teacher",
      "teaching",
      "educator",
      "lecturer",
      "tutor",
    ])
  ) {
    return [
      "How do you plan a lesson with clear learning outcomes?",
      "How do you adapt your teaching for students with different needs?",
      "Describe how you would support a student who is struggling.",
      "How do you create a safe, inclusive, and engaging learning environment?",
      "How do you assess whether students have understood a topic?",
      "How would you respond to challenging classroom behaviour?",
      "How do you communicate progress or concerns to parents, guardians, or colleagues?",
      "Describe a lesson, placement, tutoring experience, or project that developed your teaching practice.",
      "How do safeguarding responsibilities affect your professional decisions?",
      "How do you reflect on and improve your teaching?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "lawyer",
      "legal",
      "solicitor",
      "barrister",
      "paralegal",
    ])
  ) {
    return [
      "How do you approach legal research when the issue is unfamiliar?",
      "How do you analyse facts and identify the relevant legal issues?",
      "How do professional ethics and confidentiality guide your work?",
      "Describe a legal research, drafting, advocacy, or client exercise you completed.",
      "How do you explain complex legal information clearly to a client?",
      "How do you check legal writing for accuracy, clarity, and appropriate authority?",
      "How would you respond if a client's preferred action created an ethical concern?",
      "How do you manage competing deadlines and detailed case information?",
      "Describe a situation where you had to support a conclusion with evidence and reasoning.",
      "How do you stay current with legal and regulatory developments?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "software",
      "developer",
      "frontend",
      "front-end",
      "backend",
      "back-end",
      "full stack",
      "full-stack",
      "programmer",
      "web",
      "mobile app",
      "react",
      "node",
      "quality assurance",
      "qa engineer",
      "test engineer",
    ])
  ) {
    return [
      `What technical skills are most important for a ${targetRole}, and how have you developed them?`,
      "Walk me through a software project you completed from planning to implementation.",
      "How do you approach debugging an unfamiliar problem?",
      "How do you ensure that your code is readable and maintainable?",
      "Explain how you use version control when working on a project.",
      "Describe a difficult technical problem you solved.",
      "How would you test a new feature before releasing it?",
      "How do you learn a new framework, language, or development tool?",
      "How would you explain a technical decision to a non-technical stakeholder?",
      `What would you want to achieve during your first three months as a ${targetRole}?`,
    ];
  }

  if (
    includesAny(normalizedRole, [
      "data analyst",
      "data scientist",
      "machine learning",
      "artificial intelligence",
      "ai engineer",
      "business intelligence",
      "data engineer",
      "analytics",
      "statistician",
    ])
  ) {
    return [
      `What skills make you suitable for the ${targetRole} position?`,
      "Walk me through a data project you completed.",
      "How do you clean and validate an unfamiliar dataset?",
      "How would you explain a complex analysis to a non-technical audience?",
      "What is the difference between correlation and causation?",
      "How do you select an appropriate metric for evaluating a model or analysis?",
      "Describe a time when data changed your original assumption.",
      "How do you handle missing, inconsistent, or biased data?",
      "What tools do you normally use for data analysis and why?",
      "How would you ensure that your findings are accurate and reproducible?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "network",
      "system administrator",
      "systems administrator",
      "cloud",
      "devops",
      "infrastructure",
      "help desk",
      "it support",
      "technical support",
    ])
  ) {
    return [
      `What technical knowledge is most important for a ${targetRole}?`,
      "How would you troubleshoot a user who cannot access the internet?",
      "How do you determine whether an issue is caused by hardware, software, or the network?",
      "Explain DNS in simple terms.",
      "How do you prioritize several technical incidents happening at the same time?",
      "What steps would you take before escalating a technical problem?",
      "How would you document a resolved incident?",
      "What security practices should be followed when managing user accounts?",
      "Describe a technical issue you investigated and resolved.",
      "How do you communicate technical instructions to a non-technical user?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "cybersecurity",
      "cyber security",
      "security analyst",
      "soc analyst",
      "penetration",
      "information security",
      "grc",
      "incident response",
      "security engineer",
    ])
  ) {
    return [
      `Why are you interested in working as a ${targetRole}?`,
      "What is the CIA triad and why is it important?",
      "How would you respond to a suspected phishing incident?",
      "What is the principle of least privilege?",
      "Explain the difference between a vulnerability, a threat, and a risk.",
      "What steps should be taken after detecting suspicious account activity?",
      "How would you explain a security risk to a non-technical employee?",
      "What cybersecurity topic have you recently studied?",
      "How do you stay informed about security threats and vulnerabilities?",
      "Describe a security-related project, lab, or exercise you completed.",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "ui/ux",
      "ux designer",
      "ui designer",
      "product designer",
      "graphic designer",
      "visual designer",
      "multimedia",
      "video editor",
      "creative designer",
    ])
  ) {
    return [
      `Why are you interested in the ${targetRole} position?`,
      "Walk me through one project in your portfolio.",
      "How do you turn user or client requirements into a design solution?",
      "How do you respond when a stakeholder dislikes your initial design?",
      "What is your process for gathering and using feedback?",
      "How do you balance visual quality with usability?",
      "Describe a design decision you made based on user needs.",
      "How do you manage revisions and changing requirements?",
      "Which design tools do you use, and why do you prefer them?",
      "How do you measure whether a design has been successful?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "marketing",
      "social media",
      "content writer",
      "copywriter",
      "seo",
      "public relations",
      "communications",
      "brand",
    ])
  ) {
    return [
      `What interests you about the ${targetRole} position?`,
      "Describe a marketing or content project you worked on.",
      "How would you identify the target audience for a campaign?",
      "How do you measure whether a marketing campaign is successful?",
      "How would you improve a campaign that is not meeting its goals?",
      "Describe a time you created content for a specific audience.",
      "How do you balance creativity with business objectives?",
      "How do you manage several campaigns or deadlines at once?",
      "What recent marketing trend do you find important?",
      "How would you respond to negative feedback about a brand online?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "accountant",
      "accounting",
      "finance",
      "financial",
      "auditor",
      "audit",
      "banking",
      "tax",
      "bookkeeper",
    ])
  ) {
    return [
      `What interests you about working as a ${targetRole}?`,
      "How do you ensure accuracy when working with financial information?",
      "Describe your experience using spreadsheets or accounting software.",
      "How would you investigate a discrepancy in a financial record?",
      "How do you handle confidential financial information?",
      "Describe a situation where attention to detail was important.",
      "How do you organize your work during a busy reporting period?",
      "What financial concepts are most relevant to this role?",
      "How would you explain a financial issue to someone without a finance background?",
      "Describe a project or assignment involving financial analysis.",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "human resources",
      "hr ",
      "hr intern",
      "hr executive",
      "recruiter",
      "recruitment",
      "talent acquisition",
      "payroll",
      "learning and development",
    ])
  ) {
    return [
      `Why do you want to work as a ${targetRole}?`,
      "How would you protect confidential employee information?",
      "Describe a time you communicated with people from different backgrounds.",
      "How would you handle a disagreement between two employees?",
      "What qualities would you look for when screening a candidate?",
      "How do you stay organized when handling several employee requests?",
      "How would you provide a positive candidate experience?",
      "Describe a situation where you had to remain objective.",
      "What does fairness in the workplace mean to you?",
      "How would you respond if an employee raised a sensitive concern?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "business analyst",
      "project manager",
      "project coordinator",
      "product manager",
      "product intern",
      "operations",
      "management trainee",
      "consultant",
    ])
  ) {
    return [
      `What interests you about the ${targetRole} position?`,
      "How do you gather and clarify requirements from stakeholders?",
      "Describe a project you helped plan or coordinate.",
      "How do you prioritize tasks when several items are urgent?",
      "How would you handle a stakeholder who changes requirements late in a project?",
      "Describe a time you identified and solved a process problem.",
      "How do you track whether a project or initiative is progressing successfully?",
      "How would you communicate a delay to stakeholders?",
      "Describe a situation where you had to make a decision with limited information.",
      "How do you balance customer needs, business goals, and technical limitations?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "sales",
      "account executive",
      "customer service",
      "customer success",
      "retail",
      "relationship manager",
    ])
  ) {
    return [
      `Why are you interested in the ${targetRole} position?`,
      "How would you handle an angry or dissatisfied customer?",
      "Describe a time you persuaded someone to consider your recommendation.",
      "How do you identify what a customer actually needs?",
      "How would you respond if you did not know the answer to a customer's question?",
      "Describe a time you worked toward a challenging target.",
      "How do you stay motivated after receiving a rejection?",
      "How would you manage several customer requests at once?",
      "What does excellent customer service mean to you?",
      "How would you build a long-term relationship with a customer?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "mechanical engineer",
      "electrical engineer",
      "civil engineer",
      "mechatronics",
      "chemical engineer",
      "manufacturing engineer",
      "engineering intern",
    ])
  ) {
    return [
      `What technical knowledge is most important for a ${targetRole}?`,
      "Describe an engineering project you completed.",
      "How do you approach a technical problem with multiple possible solutions?",
      "How do you ensure safety and accuracy in your work?",
      "Describe a time when a test or calculation produced an unexpected result.",
      "How do you document technical decisions and project progress?",
      "How would you explain an engineering issue to a non-technical stakeholder?",
      "Describe a time you worked as part of a technical team.",
      "What engineering tools or software have you used?",
      "How do you balance performance, cost, safety, and practical constraints?",
    ];
  }

  if (
    includesAny(normalizedRole, [
      "logistics",
      "supply chain",
      "procurement",
      "warehouse",
      "hospitality",
      "hotel",
      "event coordinator",
      "restaurant",
      "front office",
    ])
  ) {
    return [
      `Why are you interested in the ${targetRole} position?`,
      "How do you prioritize tasks in a fast-paced environment?",
      "Describe a time you handled an unexpected operational problem.",
      "How would you respond when a delivery, booking, or schedule is delayed?",
      "How do you maintain accuracy while completing repetitive tasks?",
      "Describe a time you coordinated with several people or departments.",
      "How would you handle a dissatisfied customer or supplier?",
      "How do you ensure that important information is properly documented?",
      "Describe a time you improved the efficiency of a task or process.",
      "How do you remain calm when several issues happen at the same time?",
    ];
  }

  return [];
}

function getInterviewTypeQuestions(
  interviewType: InterviewType,
  targetRole: string,
) {
  const screeningQuestions = [
    "Tell me about yourself.",
    `Why are you interested in the ${targetRole} position?`,
    "What are your greatest professional strengths?",
    "What is one development area you are currently improving?",
    "Why should we hire you?",
    "What type of working environment helps you perform at your best?",
    "What motivates you to produce high-quality work?",
    "Where do you see yourself professionally in the next three years?",
    "What are your availability and expectations for this opportunity?",
    "What questions would you like to ask us?",
  ];
  const behavioralQuestions = [
    "Tell me about a time you worked successfully as part of a team.",
    "Describe a difficult problem you solved.",
    "Tell me about a time you had to meet a challenging deadline.",
    "Describe a situation where you made a mistake. How did you handle it?",
    "Tell me about a time you received constructive feedback.",
    "Describe a conflict you experienced and how you resolved it.",
    "Tell me about a time you had to learn something quickly.",
    "Describe a situation where you showed initiative.",
    "Tell me about a time you had to manage several priorities.",
    "Describe a situation where you supported or led other people.",
  ];
  const roleSpecificQuestions = [
    `What technical or professional skills are most important for a ${targetRole}?`,
    `What experience has prepared you for the ${targetRole} position?`,
    `Describe a challenging task related to the ${targetRole} field and how you approached it.`,
    "How do you check the quality, accuracy, safety, and ethics of your work?",
    "How do you approach a problem that you have never seen before?",
    "What tools, systems, standards, regulations, or methods are relevant to your work?",
    "How do you keep your professional knowledge up to date?",
    "Describe a project that demonstrates your suitability for this role.",
    "How would you explain a complex work-related issue to a non-specialist?",
    `What would you prioritize during your first month as a ${targetRole}?`,
  ];
  const situationalQuestions = [
    `Imagine you are working as a ${targetRole} and two urgent priorities conflict. What would you do?`,
    "A stakeholder disagrees with your professional recommendation. How would you respond?",
    "You notice a possible safety, ethical, quality, or compliance risk. What would you do?",
    "You are assigned an unfamiliar task with limited guidance. How would you approach it?",
    "A colleague's delay could affect an important outcome. How would you handle it?",
    "How would you communicate an unwelcome decision to the people affected by it?",
    "New information changes the best course of action midway through a task. How would you adapt?",
    "You have limited time and incomplete information for a professional decision. How would you manage the risk?",
    "A client, customer, patient, user, student, or other stakeholder is dissatisfied. How would you respond?",
    "You believe an instruction could lead to a poor outcome. How would you raise the concern?",
  ];

  switch (interviewType) {
    case "Screening Interview":
      return screeningQuestions;
    case "Behavioral Interview":
      return behavioralQuestions;
    case "Role-Specific Interview":
      return roleSpecificQuestions;
    case "Situational Interview":
      return situationalQuestions;
    default:
      return [
        screeningQuestions[0],
        behavioralQuestions[0],
        roleSpecificQuestions[0],
        situationalQuestions[0],
        screeningQuestions[1],
        behavioralQuestions[1],
        roleSpecificQuestions[1],
        situationalQuestions[1],
      ];
  }
}

function getExperienceLevelQuestions(
  difficulty: Difficulty,
  targetRole: string,
) {
  const evidenceByLevel: Record<Difficulty, string> = {
    Internship:
      "coursework, academic or personal projects, basic fundamentals, teamwork, willingness to learn, and potential",
    Graduate:
      "academic knowledge, placements, final-year projects, practical fundamentals, and career motivation",
    "Entry Level":
      "practical application, basic responsibility, communication, teamwork, and professional habits",
    Junior:
      "growing independence, troubleshooting, decision-making, and ownership of smaller tasks",
    "Mid Level":
      "independent work, difficult scenarios, measurable impact, cross-team communication, and professional judgement",
    Senior:
      "advanced judgement, complex decisions, mentoring, risk management, leadership, and significant impact",
    Management:
      "strategy, delegation, stakeholder management, team performance, conflict management, and organisational outcomes",
  };

  return [
    `For a ${difficulty} ${targetRole} candidate, which example best demonstrates ${evidenceByLevel[difficulty]}?`,
  ];
}

function getGeneralRoleQuestions(
  targetRole: string,
) {
  return [
    "Tell me about yourself.",
    `Why do you want to work as a ${targetRole}?`,
    `What skills make you suitable for the ${targetRole} position?`,
    `What do you understand about the responsibilities of a ${targetRole}?`,
    "Describe a relevant project, assignment, or work experience.",
    "Tell me about a difficult problem you solved.",
    "Describe a time you worked effectively in a team.",
    "How do you prioritize your work when several tasks are urgent?",
    "Tell me about a time you received feedback and used it to improve.",
    "What is one professional weakness you are currently improving?",
    "How do you learn a new skill or process quickly?",
    "Describe a situation where you showed initiative.",
    "How do you maintain accuracy and quality in your work?",
    `What would you want to accomplish during your first three months as a ${targetRole}?`,
    "Why should we hire you?",
  ];
}

function buildPersonalizedQuestions(
  setup: MockSetupValues,
) {
  const questions: string[] = [];

  if (setup.targetCompany) {
    questions.push(
      `Why are you interested in ${setup.targetCompany}, and how do your skills match the ${setup.targetRole} role?`,
    );
  }

  if (setup.resumeSkills.length > 0) {
    questions.push(
      `Your résumé mentions ${setup.resumeSkills
        .slice(0, 3)
        .join(
          ", ",
        )}. Can you explain how you have applied these skills?`,
    );
  }

  if (setup.resumeProjects.length > 0) {
    questions.push(
      `Walk me through your project "${setup.resumeProjects[0]}" and explain your individual contribution.`,
    );
  }

  if (setup.jobDescription) {
    questions.push(
      `Based on the job description, which requirement are you most prepared for, and what evidence supports your answer?`,
    );
  }

  if (setup.companyChallenges.length > 0) {
    questions.push(
      `Imagine ${setup.targetCompany || "the organisation"} is dealing with ${setup.companyChallenges[0]}. How would you contribute as a ${setup.targetRole}?`,
    );
  }

  return questions;
}

export async function getMockQuestions(
  setupOrRole: InterviewSetup | JobRole,
  type?: InterviewType,
  count?: number,
): Promise<Question[]> {
  await delay(400);

  const setup = getSetupValues(
    setupOrRole,
    type,
    count,
  );

  const exactQuestionBank =
    findExactQuestionBank(
      setup.targetRole,
    );

  const categoryQuestions =
    getCategoryQuestions(
      setup.targetRole,
    );

  const interviewTypeQuestions =
    getInterviewTypeQuestions(
      setup.type,
      setup.targetRole,
    );

  const generalQuestions =
    getGeneralRoleQuestions(
      setup.targetRole,
    );

  const personalizedQuestions =
    buildPersonalizedQuestions(
      setup,
    );
  const experienceQuestions =
    getExperienceLevelQuestions(
      setup.difficulty,
      setup.targetRole,
    );

  let combinedQuestions: string[];

  if (setup.type === "Role-Specific Interview") {
    combinedQuestions = [
      categoryQuestions[0] || interviewTypeQuestions[0],
      personalizedQuestions[0],
      interviewTypeQuestions[1],
      personalizedQuestions[1],
      ...categoryQuestions.slice(1),
      ...(exactQuestionBank || []),
      ...interviewTypeQuestions,
      ...experienceQuestions,
      ...generalQuestions,
    ];
  } else if (setup.type === "Mixed Interview") {
    combinedQuestions = [
      ...interviewTypeQuestions.slice(0, 4),
      ...personalizedQuestions,
      ...experienceQuestions,
      ...categoryQuestions,
      ...(exactQuestionBank || []),
      ...interviewTypeQuestions.slice(4),
      ...generalQuestions,
    ];
  } else {
    combinedQuestions = [
      interviewTypeQuestions[0],
      personalizedQuestions[0],
      interviewTypeQuestions[1],
      personalizedQuestions[1],
      ...interviewTypeQuestions.slice(2),
      ...experienceQuestions,
    ];
  }

  const uniqueQuestions =
    Array.from(
      new Set(
        combinedQuestions
          .map((question) =>
            question?.trim(),
          )
          .filter(
            (question): question is string =>
              Boolean(question),
          ),
      ),
    );

  return uniqueQuestions
    .slice(0, setup.questionCount)
    .map((text, index) => ({
      id: index + 1,
      text,
    }));
}

export async function getMockFeedback(
  question: string,
  answer: string,
): Promise<Feedback> {
  await delay(500);

  const wordCount =
    getWordCount(answer);

  let overall = 3;
  let clarity = 3;
  let relevance = 3;
  let structure = 2;
  let technicalAccuracy = 3;

  if (wordCount >= 20) {
    overall = 5;
    clarity = 5;
    relevance = 5;
    structure = 4;
    technicalAccuracy = 5;
  }

  if (wordCount >= 50) {
    overall = 7;
    clarity = 7;
    relevance = 7;
    structure = 6;
    technicalAccuracy = 7;
  }

  if (wordCount >= 90) {
    overall = 8;
    clarity = 8;
    relevance = 8;
    structure = 8;
    technicalAccuracy = 8;
  }

  const lowerAnswer =
    answer.toLowerCase();

  if (
    lowerAnswer.includes("example") ||
    lowerAnswer.includes("project") ||
    lowerAnswer.includes("result") ||
    lowerAnswer.includes("because")
  ) {
    overall += 1;
    structure += 1;
  }

  if (wordCount < 10) {
    return {
      overall: 2,
      clarity: 3,
      relevance: 2,
      structure: 1,
      technicalAccuracy: 2,

      strengths: [
        "Your answer is short and direct.",
      ],

      weaknesses: [
        "The answer is too brief for an interview.",
        "Add steps, reasoning, and a specific example.",
        "Explain the result or impact of your action.",
      ],

      improvedAnswer:
        "A stronger answer should explain the situation, the action you would take, why you would take it, and the result you expect. For a professional question, include one relevant example and explain your individual contribution.",

      summary:
        "Your answer needs more detail and structure before it is interview-ready.",

      interviewTip:
        "Avoid one-line answers. Interviewers want to understand your thinking process.",

      source: "local-fallback",
    };
  }

  return {
    overall: clampTen(overall),
    clarity: clampTen(clarity),
    relevance: clampTen(relevance),
    structure: clampTen(structure),
    technicalAccuracy:
      clampTen(technicalAccuracy),

    strengths: [
      "Your answer attempts to address the question.",

      wordCount >= 50
        ? "You provided enough detail to evaluate your thinking."
        : "Your answer is understandable and relevant.",
    ],

    weaknesses: [
      "Use clearer structure such as STAR: Situation, Task, Action, Result.",
      "Add one specific example from your project, study, or experience.",
      "End with the result, impact, or lesson learned.",
    ],

    improvedAnswer:
      `A stronger answer to "${question}" would start with a clear situation, explain your specific action step by step, and finish with the result. Include one concrete example so the interviewer can understand your real ability.`,

    summary:
      "Your answer is relevant, but it can be stronger with clearer structure and more specific examples.",

    interviewTip:
      INTERVIEW_TIPS[
        Math.floor(
          Math.random() *
            INTERVIEW_TIPS.length,
        )
      ],

    source: "local-fallback",
  };
}

export async function getMockFinalReport(
  answers: AnswerWithFeedback[],
): Promise<FinalReport> {
  await delay(500);

  const average =
    answers.length > 0
      ? Math.round(
          answers.reduce(
            (total, item) =>
              total +
              Number(
                item.feedback.overall ||
                  0,
              ),
            0,
          ) / answers.length,
        )
      : 5;

  const overallScore =
    clampTen(average) * 10;

  return {
    overallScore,

    breakdown: {
      clarity: Math.min(
        overallScore + 3,
        100,
      ),

      relevance: Math.min(
        overallScore + 2,
        100,
      ),

      structure: Math.max(
        overallScore - 8,
        0,
      ),

      confidence: Math.max(
        overallScore - 3,
        0,
      ),

      technicalAccuracy:
        overallScore,
    },

    strengths: [
      "You completed the practice session.",
      "Your answers show a starting point for interview preparation.",
      "You are building delivery consistency through repeated practice.",
    ],

    improvements: [
      "Use the STAR method more consistently.",
      "Add concrete, relevant examples from your available experience.",
      "Explain your professional decisions and reasoning clearly.",
    ],

    nextSteps: [
      "Rewrite your weakest answer with more structure.",
      "Prepare three relevant examples before your next practice.",
      "Practise one voice or video answer to improve delivery comfort.",
    ],

    improvedSampleAnswer:
      "A stronger answer should briefly explain the situation, describe your specific action, and clearly state the result or impact.",

    summary:
      "This report was generated by local mock logic. Real AI reporting should come from the backend API.",

    answerCount: answers.length,
    source: "local-fallback",
  };
}

const MOCK_HISTORY: SessionSummary[] = [
  {
    id: "s1",
    role: "Medical Officer",
    type: "Role-Specific Interview",
    date: "2026-05-08",
    score: 82,
    status: "completed",
    targetCompany: "Demo Company",
    targetRole: "Medical Officer",
    difficulty: "Graduate",
    mode: "Text",
  },

  {
    id: "s2",
    role: "Architect",
    type: "Screening Interview",
    date: "2026-05-05",
    score: 72,
    status: "completed",
    targetCompany: "Demo Company",
    targetRole: "Architect",
    difficulty: "Entry Level",
    mode: "Text",
  },

  {
    id: "s3",
    role: "Civil Engineer",
    type: "Mixed Interview",
    date: "2026-05-02",
    score: 88,
    status: "completed",
    targetCompany: "Demo Company",
    targetRole: "Civil Engineer",
    difficulty: "Senior",
    mode: "Voice",
  },
];
export function getMockDashboardStats(): DashboardStats {
  return {
    totalSessions: 12,
    averageScore: 76,
    latestScore: 82,
    bestSkill: "Clarity",
    weakestSkill:
      "Role-Specific Knowledge",
    resumeMatchScore: 78,
    companyReadinessScore: 74,
    speechConfidenceScore: 72,
    cameraPresenceScore: 68,
    overallPresentationScore: 70,
    recent: MOCK_HISTORY.slice(0, 3),
  };
}

export function getMockHistory(): SessionSummary[] {
  return MOCK_HISTORY;
}
