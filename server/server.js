import "dotenv/config";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const pdfParseModule = require("pdf-parse");
const app = express();

const PORT = process.env.PORT || 5055;
const normalizeOrigin = (value = "") => value.trim().replace(/\/+$/, "");
const FRONTEND_URL = normalizeOrigin(
  process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173",
);
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

const AI_PROVIDER = (
  process.env.AI_PROVIDER || (OPENROUTER_API_KEY ? "openrouter" : "local")
).toLowerCase();
const USE_AI =
  process.env.USE_AI === undefined ? AI_PROVIDER !== "local" : process.env.USE_AI === "true";
const AI_TEMPERATURE = Number(process.env.AI_TEMPERATURE || 0.25);
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 600);
const AI_JSON_MODE = process.env.AI_JSON_MODE !== "false";
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const RESUME_BUCKET = process.env.SUPABASE_RESUME_BUCKET || "resumes";
const MAX_RESUME_CHARS = Number(process.env.MAX_RESUME_CHARS || 12000);

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
const supabaseAdmin = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase auth is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env.",
  );
}

const allowedOrigins = [
  FRONTEND_URL,
  normalizeOrigin(process.env.CLIENT_URL || ""),
  "https://interview2-alpha.vercel.app",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",

  // LAN / mobile hotspot testing
  "http://172.20.10.2:8080",
  "http://172.20.10.2:5173",
]
  .map(normalizeOrigin)
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      if (
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|172\.|10\.)/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "2mb" }));

function getUserDisplayName(user) {
  return (
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || ""
  );
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.split("Bearer ")[1];
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        error: "Missing authorization token.",
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        error:
          "Supabase auth is not configured on the backend. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      throw error || new Error("No Supabase user was returned for this token.");
    }

    req.user = {
      uid: data.user.id,
      email: data.user.email || "",
      name: getUserDisplayName(data.user),
    };

    next();
  } catch (error) {
    console.error("Supabase auth verification error:", error);

    return res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
}

function getAiConfig() {
  if (AI_PROVIDER === "groq") {
    return {
      provider: "groq",
      endpoint: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: process.env.GROQ_API_KEY || "",
      model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      extraHeaders: {},
    };
  }

  if (AI_PROVIDER === "openrouter") {
    return {
      provider: "openrouter",
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: process.env.OPENROUTER_API_KEY || "",
      model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash:free",
      extraHeaders: {
        "HTTP-Referer": FRONTEND_URL,
        "X-Title": "InterviewReady AI",
      },
    };
  }

  return {
    provider: "local",
    endpoint: "",
    apiKey: "",
    model: "local-fallback",
    extraHeaders: {},
  };
}

function shouldUseAi() {
  const config = getAiConfig();
  return USE_AI && config.provider !== "local" && Boolean(config.apiKey);
}

function cleanJsonText(text) {
  const raw = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1);
  }

  return raw;
}

function scoreToHundred(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return 0;
  }

  if (number >= 0 && number <= 1) {
    return Math.min(Math.max(Math.round(number * 100), 0), 100);
  }

  if (number > 1 && number <= 10) {
    return Math.min(Math.max(Math.round(number * 10), 0), 100);
  }

  return Math.min(Math.max(Math.round(number), 0), 100);
}

function asStringArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return fallback;
}

function normalizeUrlArray(values) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => String(value || "").trim())
    .filter((value) => value.startsWith("http"))
    .slice(0, 5);
}

function formatCompanyContextForPrompt(companyContext) {
  if (!companyContext || typeof companyContext !== "object") {
    return "Not provided";
  }

  return JSON.stringify(
    {
      companyName: companyContext.companyName || "",
      targetRole: companyContext.targetRole || "",
      industry: companyContext.industry || "",
      companyOverview: companyContext.companyOverview || "",
      roleExpectations: asStringArray(companyContext.roleExpectations),
      companyChallenges: asStringArray(companyContext.companyChallenges),
      scenarioQuestionAngles: asStringArray(companyContext.scenarioQuestionAngles),
      interviewFocusAreas: asStringArray(companyContext.interviewFocusAreas),
      sourceUrls: normalizeUrlArray(companyContext.sourceUrls),
    },
    null,
    2,
  ).slice(0, 4000);
}

function buildFallbackCompanyContext({
  targetCompany,
  targetRole,
  warning = "Live company research was unavailable. Generic interview preparation context was used.",
}) {
  return {
    companyName: targetCompany,
    targetRole,
    industry: "General business / technology",
    companyOverview:
      "Live company research was unavailable, so this preparation context focuses on practical entry-level interview readiness. Review the company website, recent product pages, and careers page before the interview.",
    roleExpectations: [
      `Explain why your resume fits the ${targetRole || "target"} role.`,
      "Show willingness to learn, communicate clearly, and solve practical problems.",
      "Prepare examples from projects, coursework, internships, or support experience.",
    ],
    companyChallenges: [
      "Serving users reliably while adapting to business needs.",
      "Balancing customer expectations, technical quality, and team communication.",
      "Learning internal tools, workflows, and documentation quickly.",
    ],
    scenarioQuestionAngles: [
      "How you would handle a realistic user or customer problem.",
      "How your project experience can support the selected role.",
      "How you would learn an unfamiliar system used by the company.",
    ],
    interviewFocusAreas: [
      "Company motivation",
      "Resume-to-role fit",
      "Problem solving",
      "Communication",
      "Learning mindset",
    ],
    sourceUrls: [],
    source: "fallback",
    warning,
  };
}

function buildWebFallbackCompanyContext({
  targetCompany,
  targetRole,
  tavilyData,
  warning = "AI company preparation failed. Web research fallback context was used.",
}) {
  const sourceUrls = normalizeUrlArray((tavilyData?.results || []).map((result) => result.url));
  const overview =
    tavilyData?.answer ||
    tavilyData?.results?.[0]?.content ||
    "Web search returned limited information. Use the listed source links for manual review.";

  return {
    companyName: targetCompany,
    targetRole,
    industry: "Company-specific research available from web sources",
    companyOverview: overview,
    roleExpectations: [
      `Connect your resume examples to ${targetCompany}'s business and the ${targetRole} role.`,
      "Prepare to explain how you learn company products, services, and customer needs.",
      "Use specific evidence from your resume instead of generic interest.",
    ],
    companyChallenges: [
      "Understand the company's customers, products, services, and operating model.",
      "Adapt technical or communication skills to company-specific workflows.",
      "Balance speed, quality, and user impact in entry-level work.",
    ],
    scenarioQuestionAngles: [
      `A scenario based on supporting ${targetCompany}'s users or customers.`,
      `A scenario about learning ${targetCompany}'s tools, products, or service model.`,
      `A scenario about applying your resume skills to the ${targetRole} role.`,
    ],
    interviewFocusAreas: [
      "Company motivation",
      "Role fit",
      "Product/service understanding",
      "Scenario problem solving",
      "Resume examples",
    ],
    sourceUrls,
    source: "web-fallback",
    warning,
  };
}

function normalizeCompanyContext(parsed, { targetCompany, targetRole, sourceUrls }) {
  const providedSourceUrls = normalizeUrlArray(sourceUrls);
  const parsedSourceUrls = normalizeUrlArray(parsed.sourceUrls).filter((url) =>
    providedSourceUrls.includes(url),
  );

  return {
    companyName: String(parsed.companyName || targetCompany).trim(),
    targetRole: String(parsed.targetRole || targetRole).trim(),
    industry: String(parsed.industry || "General business / technology").trim(),
    companyOverview: String(
      parsed.companyOverview ||
        "Company overview was not clearly returned by AI. Review source links manually.",
    ).trim(),
    roleExpectations: asStringArray(parsed.roleExpectations, [
      `Explain how your resume fits the ${targetRole} role.`,
    ]).slice(0, 6),
    companyChallenges: asStringArray(parsed.companyChallenges, [
      "Understand company-specific users, products, and workflows.",
    ]).slice(0, 6),
    scenarioQuestionAngles: asStringArray(parsed.scenarioQuestionAngles, [
      "Prepare a company-specific problem-solving scenario.",
    ]).slice(0, 6),
    interviewFocusAreas: asStringArray(parsed.interviewFocusAreas, [
      "Company motivation",
      "Role fit",
      "Resume examples",
    ]).slice(0, 8),
    sourceUrls: parsedSourceUrls.length ? parsedSourceUrls : providedSourceUrls,
    source: "web-ai",
  };
}

async function searchCompanyWithTavily({ targetCompany, targetRole }) {
  if (!TAVILY_API_KEY) {
    return {
      answer: "",
      results: [],
      warning: "TAVILY_API_KEY is not configured. Live company research was skipped.",
    };
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query: `${targetCompany} company overview products services business model careers ${targetRole}`,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || `Tavily request failed with ${response.status}`);
    }

    return {
      answer: String(data.answer || "").trim(),
      results: Array.isArray(data.results)
        ? data.results.slice(0, 5).map((result) => ({
            title: String(result.title || "").trim(),
            url: String(result.url || "").trim(),
            content: String(result.content || "").trim(),
            score: Number(result.score || 0),
          }))
        : [],
      warning: "",
    };
  } catch (error) {
    console.error("Tavily company research failed:", error);

    return {
      answer: "",
      results: [],
      warning:
        error instanceof Error
          ? `Tavily company research failed: ${error.message}`
          : "Tavily company research failed.",
    };
  }
}

function buildFallbackQuestions({
  role,
  type,
  difficulty,
  questionCount,
  targetCompany,
  companyContext,
}) {
  const companyName = companyContext?.companyName || targetCompany;
  const firstChallenge = Array.isArray(companyContext?.companyChallenges)
    ? companyContext.companyChallenges[0]
    : "";
  const firstFocusArea = Array.isArray(companyContext?.interviewFocusAreas)
    ? companyContext.interviewFocusAreas[0]
    : "";
  const baseQuestions = [
    `Tell me about yourself and why you are interested in the ${role} role${
      targetCompany ? ` at ${targetCompany}` : ""
    }.`,
    `What skills make you suitable for this ${role} position?`,
    "Describe one project or experience that shows your problem-solving ability.",
    "Tell me about a time you faced a challenge and how you handled it.",
    `What do you understand about this ${type.toLowerCase()} and how have you prepared for it?`,
    "What are your strengths and how would they help you in this role?",
    "What is one weakness you are currently improving?",
    "Why should we choose you for this position?",
    "Describe a time you worked with a team.",
    "Where do you see yourself improving in the next six months?",
  ];

  if (companyName) {
    baseQuestions.splice(
      3,
      0,
      `What do you know about ${companyName}, and why does this company interest you for the ${role} role?`,
    );
  }

  if (companyName && firstChallenge) {
    baseQuestions.splice(
      4,
      0,
      `Imagine ${companyName} is dealing with ${firstChallenge}. How could you contribute as a ${role}?`,
    );
  }

  if (firstFocusArea) {
    baseQuestions.splice(
      5,
      0,
      `This role may focus on ${firstFocusArea}. What experience from your resume prepares you for that?`,
    );
  }

  return baseQuestions.slice(0, Number(questionCount) || 5).map((text, index) => ({
    id: `fallback-${index + 1}`,
    text,
    category: type,
    difficulty,
    expectedFocus: "Give a clear, relevant, structured answer.",
  }));
}

function buildLocalFeedback({ answer }) {
  const wordCount = String(answer || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  let overallScore = 35;
  let clarityScore = 35;
  let relevanceScore = 35;
  let structureScore = 30;
  let technicalScore = 35;

  if (wordCount >= 30) {
    overallScore = 55;
    clarityScore = 55;
    relevanceScore = 55;
    structureScore = 50;
    technicalScore = 55;
  }

  if (wordCount >= 70) {
    overallScore = 72;
    clarityScore = 72;
    relevanceScore = 74;
    structureScore = 68;
    technicalScore = 72;
  }

  return {
    overallScore,
    clarityScore,
    relevanceScore,
    structureScore,
    technicalScore,
    strengths: [
      "You attempted to answer the interview question.",
      wordCount >= 30
        ? "Your answer includes more detail than a very short response."
        : "Your answer is direct and easy to understand.",
    ],
    improvements: [
      "Add a clear step-by-step structure.",
      "Use a specific example from your project, study, or experience.",
      "Explain your reasoning instead of only giving the final action.",
    ],
    improvedAnswer:
      "A stronger answer should explain the situation, the steps you would take, why each step matters, and the expected result. For technical questions, start with basic checks, explain your troubleshooting process, then mention escalation or documentation if the issue continues.",
    interviewTip:
      "Use the STAR method for behavioral answers and a step-by-step troubleshooting method for technical answers.",
    source: "local-fallback",
    warning: "AI is disabled or unavailable. Local fallback feedback was used.",
  };
}

function buildFallbackFinalReport(answers = []) {
  const feedbackScores = answers
    .map((item) =>
      Number(item?.feedback?.overallScore ?? item?.feedback?.overall ?? item?.feedback?.score ?? 0),
    )
    .filter((score) => score > 0);

  const averageFromFeedback =
    feedbackScores.length > 0
      ? Math.round(
          feedbackScores.reduce((total, score) => total + score, 0) / feedbackScores.length,
        )
      : 55;

  return {
    overallScore: averageFromFeedback,
    breakdown: {
      clarity: Math.max(45, Math.min(averageFromFeedback, 80)),
      relevance: Math.max(45, Math.min(averageFromFeedback, 80)),
      structure: Math.max(40, Math.min(averageFromFeedback - 5, 75)),
      confidence: Math.max(45, Math.min(averageFromFeedback, 80)),
      technicalAccuracy: Math.max(45, Math.min(averageFromFeedback, 80)),
    },
    strengths: [
      "You completed the interview practice and saved your answers.",
      "You are building interview confidence through repeated practice.",
    ],
    improvements: [
      "Use more specific examples from your projects or experience.",
      "Structure your answers clearly using the STAR method.",
      "Explain your reasoning step by step for technical questions.",
    ],
    nextSteps: [
      "Prepare 3 project examples using the STAR method.",
      "Practice explaining your technical decisions clearly.",
      "Review weak answers and rewrite them with more detail.",
    ],
    improvedSampleAnswer:
      "A stronger answer should briefly explain the situation, describe your specific action, and clearly state the result or impact.",
    summary:
      "This report was generated using local fallback logic because AI is disabled or unavailable.",
    answerCount: answers.length,
    source: "local-fallback",
    warning: "Local fallback final report was used.",
  };
}

function normalizeQuestions(
  parsed,
  { type, difficulty, safeQuestionCount, finalRole, targetCompany, companyContext },
) {
  const sourceQuestions = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.questions)
      ? parsed.questions
      : [];

  let questions = sourceQuestions.map((question, index) => ({
    id: question.id || `q-${index + 1}`,
    text: String(question.text || question.question || "").trim(),
    category: String(question.category || type),
    difficulty: String(question.difficulty || difficulty),
    expectedFocus: String(
      question.expectedFocus || question.focus || "Give a clear, relevant, structured answer.",
    ),
  }));

  questions = questions.filter((question) => question.text.length > 0).slice(0, safeQuestionCount);

  if (questions.length === 0) {
    questions = buildFallbackQuestions({
      role: finalRole,
      type,
      difficulty,
      questionCount: safeQuestionCount,
      targetCompany,
      companyContext,
    });
  }

  return questions;
}

function normalizeFeedback(parsed) {
  const strengths = asStringArray(parsed.strengths || parsed.positivePoints || parsed.goodPoints, [
    "The answer attempts to respond to the question.",
  ]);

  const improvements = asStringArray(
    parsed.improvements || parsed.weaknesses || parsed.areasToImprove || parsed.suggestions,
    ["Add more detail, structure, and specific examples."],
  );

  return {
    overallScore: scoreToHundred(parsed.overallScore ?? parsed.overall ?? parsed.score),
    clarityScore: scoreToHundred(parsed.clarityScore ?? parsed.clarity),
    relevanceScore: scoreToHundred(parsed.relevanceScore ?? parsed.relevance),
    structureScore: scoreToHundred(parsed.structureScore ?? parsed.structure),
    technicalScore: scoreToHundred(
      parsed.technicalScore ?? parsed.technicalAccuracy ?? parsed.technicalAccuracyScore,
    ),
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 4),
    improvedAnswer:
      typeof parsed.improvedAnswer === "string"
        ? parsed.improvedAnswer
        : typeof parsed.sampleAnswer === "string"
          ? parsed.sampleAnswer
          : "A stronger answer should include a clear situation, your specific action, and the result or impact.",
    interviewTip:
      typeof parsed.interviewTip === "string"
        ? parsed.interviewTip
        : typeof parsed.tip === "string"
          ? parsed.tip
          : "Use the STAR method: Situation, Task, Action, Result.",
    source: "ai",
  };
}

function normalizeFinalReport(parsed, answers = []) {
  return {
    overallScore: scoreToHundred(parsed.overallScore ?? parsed.overall),
    breakdown: {
      clarity: scoreToHundred(parsed.breakdown?.clarity ?? parsed.clarity),
      relevance: scoreToHundred(parsed.breakdown?.relevance ?? parsed.relevance),
      structure: scoreToHundred(parsed.breakdown?.structure ?? parsed.structure),
      confidence: scoreToHundred(parsed.breakdown?.confidence ?? parsed.confidence),
      technicalAccuracy: scoreToHundred(
        parsed.breakdown?.technicalAccuracy ?? parsed.technicalAccuracy ?? parsed.technicalScore,
      ),
    },
    strengths: asStringArray(parsed.strengths, ["You completed the interview practice."]).slice(
      0,
      5,
    ),
    improvements: asStringArray(parsed.improvements || parsed.weaknesses, [
      "Use more specific examples and improve answer structure.",
    ]).slice(0, 5),
    nextSteps: asStringArray(parsed.nextSteps || parsed.recommendations, [
      "Practice using the STAR method.",
      "Prepare stronger project examples.",
      "Review common questions for your target role.",
    ]).slice(0, 5),
    improvedSampleAnswer:
      typeof parsed.improvedSampleAnswer === "string"
        ? parsed.improvedSampleAnswer
        : typeof parsed.improvedAnswer === "string"
          ? parsed.improvedAnswer
          : "A stronger answer should include a clear example, your action, and the result.",
    summary:
      typeof parsed.summary === "string"
        ? parsed.summary
        : "Your interview practice was reviewed based on your answers and AI feedback.",
    answerCount: answers.length,
    source: "ai",
  };
}

function cleanResumeText(text) {
  return String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limitResumeText(text) {
  const cleaned = cleanResumeText(text);

  if (cleaned.length <= MAX_RESUME_CHARS) {
    return cleaned;
  }

  return cleaned.slice(0, MAX_RESUME_CHARS);
}

async function extractPdfText(buffer) {
  // Supports older pdf-parse versions
  if (typeof pdfParseModule === "function") {
    const parsed = await pdfParseModule(buffer);
    return cleanResumeText(parsed.text || "");
  }

  // Supports pdf-parse versions that expose default
  if (typeof pdfParseModule.default === "function") {
    const parsed = await pdfParseModule.default(buffer);
    return cleanResumeText(parsed.text || "");
  }

  // Supports newer pdf-parse versions that expose PDFParse class
  if (typeof pdfParseModule.PDFParse === "function") {
    const parser = new pdfParseModule.PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return cleanResumeText(result.text || "");
    } finally {
      if (typeof parser.destroy === "function") {
        await parser.destroy();
      }
    }
  }

  throw new Error("PDF parser is not available. Please reinstall pdf-parse.");
}

async function extractResumeTextFromBuffer(buffer, fileName = "") {
  const lowerName = String(fileName || "").toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  if (lowerName.endsWith(".docx")) {
    const parsed = await mammoth.extractRawText({ buffer });
    return cleanResumeText(parsed.value || "");
  }

  throw new Error("Unsupported resume file type. Please upload a PDF or DOCX file.");
}

function buildLocalResumeAnalysis(extractedText, fileName = "") {
  const text = String(extractedText || "");
  const lowerText = text.toLowerCase();

  const skillKeywords = [
    "React",
    "TypeScript",
    "JavaScript",
    "Python",
    "Java",
    "Node.js",
    "Express",
    "Supabase",
    "Firebase",
    "SQL",
    "PostgreSQL",
    "HTML",
    "CSS",
    "Tailwind",
    "Git",
    "GitHub",
    "Machine Learning",
    "AI",
    "Cybersecurity",
    "Networking",
  ];

  const parsedSkills = skillKeywords.filter((skill) => lowerText.includes(skill.toLowerCase()));

  const parsedProjects = [];

  if (lowerText.includes("project")) {
    parsedProjects.push("Project experience mentioned in resume");
  }

  if (lowerText.includes("interview")) {
    parsedProjects.push("Interview-related project");
  }

  if (lowerText.includes("website") || lowerText.includes("web app")) {
    parsedProjects.push("Web development project");
  }

  const parsedEducation = lowerText.includes("diploma")
    ? "Diploma-level education detected"
    : lowerText.includes("degree")
      ? "Degree-level education detected"
      : lowerText.includes("university") || lowerText.includes("college")
        ? "College or university education detected"
        : "Education details not clearly detected from resume text";

  const recommendedRoles = [];

  if (
    parsedSkills.some((skill) =>
      ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Tailwind"].includes(skill),
    )
  ) {
    recommendedRoles.push("Frontend Developer Intern");
  }

  if (
    parsedSkills.some((skill) =>
      ["Node.js", "Express", "Supabase", "Firebase", "SQL", "PostgreSQL"].includes(skill),
    )
  ) {
    recommendedRoles.push("Software Developer Intern");
  }

  if (parsedSkills.some((skill) => ["Networking", "Cybersecurity"].includes(skill))) {
    recommendedRoles.push("IT Support Intern", "Cybersecurity Intern");
  }

  if (recommendedRoles.length === 0) {
    recommendedRoles.push("IT Intern", "Software Developer Intern");
  }

  return {
    resumeSummary:
      "This resume was analyzed using local fallback logic. AI analysis was unavailable, but the system extracted basic skills and possible career directions from the resume text.",
    parsedSkills,
    parsedProjects,
    parsedEducation,
    parsedExperience: [],
    careerLevel: "Student / entry-level candidate",
    strongAreas: parsedSkills.length
      ? [`Shows skills related to ${parsedSkills.slice(0, 3).join(", ")}`]
      : ["The resume contains useful candidate information."],
    weakAreas: [
      "Add measurable achievements if missing.",
      "Make project descriptions more specific.",
    ],
    recommendedRoles,
    recommendedCompanyTypes: ["Software company", "Digital agency", "Startup", "IT department"],
    interviewFocusAreas: [
      "Explain your projects clearly.",
      "Prepare role-specific examples.",
      "Practice STAR method answers.",
    ],
    source: "local-fallback",
    fileName,
  };
}

function normalizeResumeAnalysis(parsed, extractedText, fileName = "") {
  return {
    resumeSummary:
      typeof parsed.resumeSummary === "string"
        ? parsed.resumeSummary
        : typeof parsed.summary === "string"
          ? parsed.summary
          : "Resume analyzed successfully.",
    parsedSkills: asStringArray(parsed.skills || parsed.parsedSkills, []),
    parsedProjects: asStringArray(parsed.projects || parsed.parsedProjects, []),
    parsedEducation:
      typeof parsed.education === "string"
        ? parsed.education
        : typeof parsed.parsedEducation === "string"
          ? parsed.parsedEducation
          : "",
    parsedExperience: asStringArray(parsed.experience || parsed.parsedExperience, []),
    careerLevel:
      typeof parsed.careerLevel === "string"
        ? parsed.careerLevel
        : "Student / entry-level candidate",
    strongAreas: asStringArray(parsed.strongAreas || parsed.strengths, []),
    weakAreas: asStringArray(parsed.weakAreas || parsed.weaknesses || parsed.improvements, []),
    recommendedRoles: asStringArray(parsed.recommendedRoles, []),
    recommendedCompanyTypes: asStringArray(
      parsed.recommendedCompanyTypes || parsed.companyTypes,
      [],
    ),
    interviewFocusAreas: asStringArray(parsed.interviewFocusAreas || parsed.focusAreas, []),
    extractedText: limitResumeText(extractedText),
    fileName,
    source: "ai",
  };
}

async function analyzeResumeWithAi(extractedText, fileName = "") {
  const safeText = limitResumeText(extractedText);

  if (!shouldUseAi()) {
    return buildLocalResumeAnalysis(safeText, fileName);
  }

  const prompt = `
Analyze this resume for an AI interview preparation platform.

Resume file name:
${fileName}

Resume text:
${safeText}

Return valid JSON only.

JSON shape:
{
  "resumeSummary": "short professional summary of the candidate",
  "skills": ["skill 1", "skill 2"],
  "projects": ["project 1", "project 2"],
  "education": "education summary",
  "experience": ["experience 1", "experience 2"],
  "careerLevel": "student / internship-ready / entry-level / junior",
  "strongAreas": ["strength 1", "strength 2"],
  "weakAreas": ["weak area 1", "weak area 2"],
  "recommendedRoles": ["role 1", "role 2"],
  "recommendedCompanyTypes": ["company type 1", "company type 2"],
  "interviewFocusAreas": ["focus area 1", "focus area 2"]
}

Rules:
- Focus on students, fresh graduates, interns, and entry-level roles.
- Do not invent work experience that is not in the resume.
- If something is unclear, say it is not clearly shown.
- Recommended roles should match the resume skills and projects.
- Keep feedback practical and useful for interview preparation.
`;

  try {
    const parsed = await callAiJson(prompt, { maxTokens: 900 });
    return normalizeResumeAnalysis(parsed, safeText, fileName);
  } catch (error) {
    console.error("AI resume analysis failed:", error);

    return {
      ...buildLocalResumeAnalysis(safeText, fileName),
      warning: "AI resume analysis failed. Local fallback resume analysis was used.",
    };
  }
}

async function callAiJson(prompt, options = {}) {
  if (!shouldUseAi()) {
    throw new Error("AI is disabled or the selected provider API key is missing.");
  }

  const config = getAiConfig();
  const maxTokens = options.maxTokens || AI_MAX_TOKENS;

  const body = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "You are an interview coach API. Return valid JSON only. Do not include markdown, code fences, or explanation outside JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: AI_TEMPERATURE,
    max_tokens: maxTokens,
  };

  if (AI_JSON_MODE) {
    body.response_format = {
      type: "json_object",
    };
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...config.extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data?.usage) {
    console.log("AI usage:", {
      provider: config.provider,
      model: data.model || config.model,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    });
  }

  if (!response.ok) {
    console.error(`${config.provider} API error:`, data);
    throw new Error(
      data?.error?.message || `${config.provider} request failed with ${response.status}`,
    );
  }

  const text = data?.choices?.[0]?.message?.content || "";

  try {
    return JSON.parse(cleanJsonText(text));
  } catch (error) {
    console.error(`${config.provider} returned invalid JSON:`);
    console.error(text);
    throw error;
  }
}

app.get("/api/health", (req, res) => {
  const config = getAiConfig();

  res.json({
    ok: true,
    service: "InterviewReady AI API",
    status: "ok",
    message: "InterviewReady AI backend is running.",
    aiEnabled: shouldUseAi(),
    aiProvider: config.provider,
    aiModel: config.model,
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    message: "Authenticated successfully.",
    user: req.user,
  });
});

app.post("/api/company-context", requireAuth, async (req, res) => {
  const {
    targetCompany = "",
    targetRole = "",
    jobDescription = "",
    resumeSummary = "",
    resumeSkills = [],
    resumeProjects = [],
  } = req.body;

  const cleanCompany = String(targetCompany || "").trim();
  const cleanRole = String(targetRole || "").trim() || "entry-level role";

  if (!cleanCompany) {
    return res.status(400).json({
      error: "Target company is required.",
    });
  }

  const tavilyData = await searchCompanyWithTavily({
    targetCompany: cleanCompany,
    targetRole: cleanRole,
  });
  const sourceUrls = normalizeUrlArray((tavilyData.results || []).map((result) => result.url));
  const hasWebResearch = Boolean(tavilyData.answer || (tavilyData.results || []).length > 0);

  if (!hasWebResearch) {
    return res.json(
      buildFallbackCompanyContext({
        targetCompany: cleanCompany,
        targetRole: cleanRole,
        warning: tavilyData.warning || "Live company research did not return usable sources.",
      }),
    );
  }

  if (!shouldUseAi()) {
    return res.json(
      buildWebFallbackCompanyContext({
        targetCompany: cleanCompany,
        targetRole: cleanRole,
        tavilyData,
        warning:
          tavilyData.warning ||
          "AI is disabled or unavailable. Web research fallback context was used.",
      }),
    );
  }

  const webResearchText = [
    tavilyData.answer ? `Tavily answer:\n${tavilyData.answer}` : "",
    ...(tavilyData.results || []).map(
      (result, index) => `
Source ${index + 1}
Title: ${result.title || "Untitled"}
URL: ${result.url || "No URL"}
Content: ${result.content || "No content"}
Score: ${result.score || 0}
`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 7000);

  const prompt = `
Create company-specific interview preparation context.

Rules:
- Use only the web research and user input below.
- Do not invent recent news, products, statistics, or events if they are not in the sources.
- Keep it practical for students, interns, fresh graduates, and entry-level roles.
- Make scenarios relevant to the selected company and role.

User input:
- Target company: ${cleanCompany}
- Target role: ${cleanRole}
- Job description: ${jobDescription || "Not provided"}
- Resume summary: ${resumeSummary || "Not provided"}
- Resume skills: ${
    Array.isArray(resumeSkills) && resumeSkills.length > 0
      ? resumeSkills.join(", ")
      : "Not provided"
  }
- Resume projects: ${
    Array.isArray(resumeProjects) && resumeProjects.length > 0
      ? resumeProjects.join(", ")
      : "Not provided"
  }

Web research:
${webResearchText}

Return valid JSON only.

JSON shape:
{
  "companyName": "company name",
  "targetRole": "role",
  "industry": "industry",
  "companyOverview": "practical company overview grounded in sources",
  "roleExpectations": ["expectation 1", "expectation 2"],
  "companyChallenges": ["challenge 1", "challenge 2"],
  "scenarioQuestionAngles": ["scenario angle 1", "scenario angle 2"],
  "interviewFocusAreas": ["focus area 1", "focus area 2"],
  "sourceUrls": ["https://source-url"]
}
`;

  try {
    const parsed = await callAiJson(prompt, { maxTokens: 900 });
    const context = normalizeCompanyContext(parsed, {
      targetCompany: cleanCompany,
      targetRole: cleanRole,
      sourceUrls,
    });

    return res.json({
      ...context,
      source: "web-ai",
      provider: getAiConfig().provider,
      model: getAiConfig().model,
      warning: tavilyData.warning || undefined,
    });
  } catch (error) {
    console.error("AI company context failed:", error);

    return res.json(
      buildWebFallbackCompanyContext({
        targetCompany: cleanCompany,
        targetRole: cleanRole,
        tavilyData,
        warning:
          "AI company context failed or quota was exceeded. Web research fallback context was used.",
      }),
    );
  }
});

app.post("/api/generate-questions", requireAuth, async (req, res) => {
  const {
    role = "IT Support Intern",
    targetRole = "",
    type = "Technical Interview",
    difficulty = "Beginner",
    questionCount = 5,
    targetCompany = "",
    jobDescription = "",
    resumeSummary = "",
    resumeSkills = [],
    resumeProjects = [],
    resumeEducation = "",
    companyContext = null,
  } = req.body;

  const finalRole = targetRole || role;
  const safeQuestionCount = Math.min(Math.max(Number(questionCount) || 5, 1), 10);

  if (!shouldUseAi()) {
    const questions = buildFallbackQuestions({
      role: finalRole,
      type,
      difficulty,
      questionCount: safeQuestionCount,
      targetCompany,
      companyContext,
    });

    return res.json({
      questions,
      context: {
        role: finalRole,
        type,
        difficulty,
        questionCount: safeQuestionCount,
        targetCompany,
        jobDescription,
      },
      source: "local-fallback",
      warning: "AI is disabled. Local fallback questions were used.",
    });
  }

  const prompt = `
Generate exactly ${safeQuestionCount} interview questions.

Candidate context:
- Target role: ${finalRole}
- Target company: ${targetCompany || "Not provided"}
- Interview type: ${type}
- Difficulty: ${difficulty}
- Job description: ${jobDescription || "Not provided"}
- Resume summary: ${resumeSummary || "Not provided"}
- Resume skills: ${
    Array.isArray(resumeSkills) && resumeSkills.length > 0
      ? resumeSkills.join(", ")
      : "Not provided"
  }
- Resume projects: ${
    Array.isArray(resumeProjects) && resumeProjects.length > 0
      ? resumeProjects.join(", ")
      : "Not provided"
  }
- Education: ${resumeEducation || "Not provided"}
- Company research context:
${formatCompanyContextForPrompt(companyContext)}

Question mix:
1. Resume-based questions
2. Role-based questions
3. Company-specific questions
4. Scenario-based questions related to the researched company context

Return valid JSON only.

JSON shape:
{
  "questions": [
    {
      "id": "q-1",
      "text": "question text",
      "category": "Technical Interview",
      "difficulty": "Beginner",
      "expectedFocus": "what the answer should focus on"
    }
  ]
}
`;

  try {
    const parsed = await callAiJson(prompt, { maxTokens: 900 });

    const questions = normalizeQuestions(parsed, {
      type,
      difficulty,
      safeQuestionCount,
      finalRole,
      targetCompany,
      companyContext,
    });

    res.json({
      questions,
      context: {
        role: finalRole,
        type,
        difficulty,
        questionCount: safeQuestionCount,
        targetCompany,
        jobDescription,
      },
      source: "ai",
      provider: getAiConfig().provider,
      model: getAiConfig().model,
    });
  } catch (error) {
    console.error("AI question generation failed:", error);

    const questions = buildFallbackQuestions({
      role: finalRole,
      type,
      difficulty,
      questionCount: safeQuestionCount,
      targetCompany,
      companyContext,
    });

    res.json({
      questions,
      context: {
        role: finalRole,
        type,
        difficulty,
        questionCount: safeQuestionCount,
        targetCompany,
        jobDescription,
      },
      source: "fallback",
      warning: "AI question generation failed or quota was exceeded. Fallback questions were used.",
    });
  }
});

app.post("/api/analyze-answer", requireAuth, async (req, res) => {
  const {
    question,
    answer,
    role = "IT Support Intern",
    targetRole = "",
    type = "Technical Interview",
    difficulty = "Beginner",
    targetCompany = "",
    jobDescription = "",
    resumeSummary = "",
    resumeSkills = [],
    resumeProjects = [],
    resumeEducation = "",
  } = req.body;

  if (!question || !answer) {
    return res.status(400).json({
      error: "Question and answer are required.",
    });
  }

  const finalRole = targetRole || role;

  if (!shouldUseAi()) {
    return res.json(buildLocalFeedback({ question, answer }));
  }

  const prompt = `
Evaluate this interview answer.

Context:
Role: ${finalRole}
Company: ${targetCompany || "N/A"}
Type: ${type}
Difficulty: ${difficulty}
Resume summary: ${resumeSummary || "Not provided"}
Resume skills: ${
    Array.isArray(resumeSkills) && resumeSkills.length > 0
      ? resumeSkills.join(", ")
      : "Not provided"
  }
Resume projects: ${
    Array.isArray(resumeProjects) && resumeProjects.length > 0
      ? resumeProjects.join(", ")
      : "Not provided"
  }
Education: ${resumeEducation || "Not provided"}
Job description: ${jobDescription || "Not provided"}

Question:
${question}

Answer:
${answer}

Return valid JSON only.

JSON shape:
{
  "overallScore": 0,
  "clarityScore": 0,
  "relevanceScore": 0,
  "structureScore": 0,
  "technicalScore": 0,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "improvedAnswer": "A stronger version of the answer.",
  "interviewTip": "One practical interview tip."
}

Scoring:
0-40 weak, vague, too short.
41-70 average.
71-100 strong and specific.
Do not default to 70.
`;

  try {
    const parsed = await callAiJson(prompt, { maxTokens: 550 });
    const feedback = normalizeFeedback(parsed);

    res.json({
      ...feedback,
      provider: getAiConfig().provider,
      model: getAiConfig().model,
    });
  } catch (error) {
    console.error("AI answer feedback failed:", error);

    res.json({
      ...buildLocalFeedback({ question, answer }),
      source: "fallback",
      warning: "AI answer feedback failed or quota was exceeded. Local fallback feedback was used.",
    });
  }
});

app.post("/api/final-report", requireAuth, async (req, res) => {
  const {
    answers = [],
    role = "IT Support Intern",
    targetRole = "",
    type = "Technical Interview",
    difficulty = "Beginner",
    targetCompany = "",
    jobDescription = "",
  } = req.body;

  const finalRole = targetRole || role;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.json(buildFallbackFinalReport([]));
  }

  if (!shouldUseAi()) {
    return res.json(buildFallbackFinalReport(answers));
  }

  const answerSummary = answers
    .map((item, index) => {
      const feedback = item.feedback || {};

      return `
Answer ${index + 1}
Question: ${item.question?.text || item.questionText || "Not provided"}
Candidate answer: ${item.answer || item.answerText || "Not provided"}
Scores: overall ${feedback.overallScore ?? feedback.overall ?? "N/A"}/100, clarity ${
        feedback.clarityScore ?? feedback.clarity ?? "N/A"
      }/100, relevance ${feedback.relevanceScore ?? feedback.relevance ?? "N/A"}/100, structure ${
        feedback.structureScore ?? feedback.structure ?? "N/A"
      }/100, technical ${feedback.technicalScore ?? feedback.technicalAccuracy ?? "N/A"}/100
Strength: ${Array.isArray(feedback.strengths) ? feedback.strengths[0] : "N/A"}
Weakness: ${
        Array.isArray(feedback.improvements)
          ? feedback.improvements[0]
          : Array.isArray(feedback.weaknesses)
            ? feedback.weaknesses[0]
            : "N/A"
      }
`;
    })
    .join("\n");

  const prompt = `
Generate a final interview performance report for a student or fresh graduate.

Context:
Role: ${finalRole}
Company: ${targetCompany || "N/A"}
Type: ${type}
Difficulty: ${difficulty}
Job description: ${jobDescription || "Not provided"}

Saved answer analysis:
${answerSummary}

Return valid JSON only.

JSON shape:
{
  "overallScore": 0,
  "breakdown": {
    "clarity": 0,
    "relevance": 0,
    "structure": 0,
    "confidence": 0,
    "technicalAccuracy": 0
  },
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "nextSteps": ["next step 1", "next step 2"],
  "improvedSampleAnswer": "A strong sample answer.",
  "summary": "Short final summary."
}

Scores must be 0-100. Do not default to 70.
`;

  try {
    const parsed = await callAiJson(prompt, { maxTokens: 750 });
    const report = normalizeFinalReport(parsed, answers);

    res.json({
      ...report,
      provider: getAiConfig().provider,
      model: getAiConfig().model,
    });
  } catch (error) {
    console.error("AI final report failed:", error);

    res.json({
      ...buildFallbackFinalReport(answers),
      warning:
        "AI final report failed or quota was exceeded. Local fallback final report was used.",
    });
  }
});

app.post("/api/extract-resume", requireAuth, async (req, res) => {
  const { resumeId, filePath, fileName = "" } = req.body;

  if (!resumeId && !filePath) {
    return res.status(400).json({
      error: "resumeId or filePath is required.",
    });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({
      error:
        "Supabase is not configured on the backend. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  try {
    let resumeRecord = null;

    if (resumeId) {
      const { data, error } = await supabaseAdmin
        .from("resumes")
        .select("*")
        .eq("id", resumeId)
        .eq("user_id", req.user.uid)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          error: "Resume not found for this user.",
        });
      }

      resumeRecord = data;
    }

    const finalFilePath = resumeRecord?.file_path || filePath;
    const finalFileName = resumeRecord?.file_name || fileName || finalFilePath;

    if (!finalFilePath) {
      return res.status(400).json({
        error: "Resume file path is missing.",
      });
    }

    if (resumeRecord?.id || resumeId) {
      await supabaseAdmin
        .from("resumes")
        .update({
          analysis_status: "processing",
        })
        .eq("id", resumeRecord?.id || resumeId)
        .eq("user_id", req.user.uid);
    }

    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(RESUME_BUCKET)
      .download(finalFilePath);

    if (downloadError || !fileData) {
      throw downloadError || new Error("Could not download resume file from storage.");
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extractedText = await extractResumeTextFromBuffer(buffer, finalFileName);

    if (!extractedText || extractedText.length < 20) {
      throw new Error("Could not extract enough readable text from this resume.");
    }

    const analysis = await analyzeResumeWithAi(extractedText, finalFileName);

    const updatePayload = {
      extracted_text: analysis.extractedText || limitResumeText(extractedText),
      parsed_skills: analysis.parsedSkills || [],
      parsed_projects: analysis.parsedProjects || [],
      parsed_education: analysis.parsedEducation || "",
      parsed_experience: analysis.parsedExperience || [],
      resume_summary: analysis.resumeSummary || "",
      career_level: analysis.careerLevel || "",
      strong_areas: analysis.strongAreas || [],
      weak_areas: analysis.weakAreas || [],
      recommended_roles: analysis.recommendedRoles || [],
      recommended_company_types: analysis.recommendedCompanyTypes || [],
      interview_focus_areas: analysis.interviewFocusAreas || [],
      analysis_status: "completed",
      analysis_json: analysis,
      analyzed_at: new Date().toISOString(),
    };

    let updatedResume = null;

    if (resumeRecord?.id || resumeId) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("resumes")
        .update(updatePayload)
        .eq("id", resumeRecord?.id || resumeId)
        .eq("user_id", req.user.uid)
        .select("*")
        .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      updatedResume = updated;
    }

    return res.json({
      message: "Resume analyzed successfully.",
      resumeId: resumeRecord?.id || resumeId || null,
      resume: updatedResume,
      ...analysis,
      extractedText: limitResumeText(extractedText),
    });
  } catch (error) {
    console.error("Resume extraction failed:", error);

    if (resumeId && supabaseAdmin) {
      await supabaseAdmin
        .from("resumes")
        .update({
          analysis_status: "failed",
          analysis_json: {
            error: error.message,
          },
        })
        .eq("id", resumeId)
        .eq("user_id", req.user.uid);
    }

    return res.status(500).json({
      error: error.message || "Resume extraction failed.",
    });
  }
});
app.post("/api/recommend-companies", requireAuth, async (req, res) => {
  const {
    resumeSummary = "",
    resumeSkills = [],
    resumeProjects = [],
    resumeEducation = "",
    recommendedRoles = [],
    recommendedCompanyTypes = [],
    targetLocation = "Malaysia",
  } = req.body;

  if (!resumeSummary && (!Array.isArray(resumeSkills) || resumeSkills.length === 0)) {
    return res.status(400).json({
      error: "Resume analysis data is required for company recommendation.",
    });
  }

  const fallback = {
    recommendedRoles: [
      {
        role: "Frontend Developer Intern",
        matchScore: 85,
        reason: "Your resume shows web development skills that fit frontend internship roles.",
      },
      {
        role: "Software Developer Intern",
        matchScore: 78,
        reason:
          "Your projects and technical background fit entry-level software development practice.",
      },
      {
        role: "IT Support Intern",
        matchScore: 70,
        reason:
          "Your computer science background can also fit technical support and IT operations roles.",
      },
    ],
    recommendedCompanyTypes:
      recommendedCompanyTypes.length > 0
        ? recommendedCompanyTypes
        : ["Software company", "Digital agency", "Startup", "University IT department"],
    suggestedCompanies: [
      {
        name: "Software House",
        type: "Software company",
        matchScore: 84,
        reason: "Good fit for students with web development and full-stack project experience.",
      },
      {
        name: "Digital Agency",
        type: "Digital agency",
        matchScore: 80,
        reason:
          "Good fit if the candidate has frontend, UI, and portfolio-style project experience.",
      },
      {
        name: "Startup",
        type: "Startup",
        matchScore: 76,
        reason:
          "Good fit for candidates who can learn quickly and handle multiple responsibilities.",
      },
    ],
    interviewFocusAreas: [
      "Explain your projects clearly.",
      "Prepare technical examples from your resume.",
      "Practice why you are interested in the selected company.",
    ],
    source: "local-fallback",
    warning: "AI is disabled or unavailable. Local fallback company recommendations were used.",
  };

  if (!shouldUseAi()) {
    return res.json(fallback);
  }

  const prompt = `
You are a career recommendation engine for students and fresh graduates.

Use this resume analysis to recommend suitable roles, company types, and possible target companies.

Candidate resume context:
- Resume summary: ${resumeSummary || "Not provided"}
- Skills: ${
    Array.isArray(resumeSkills) && resumeSkills.length > 0
      ? resumeSkills.join(", ")
      : "Not provided"
  }
- Projects: ${
    Array.isArray(resumeProjects) && resumeProjects.length > 0
      ? resumeProjects.join(", ")
      : "Not provided"
  }
- Education: ${resumeEducation || "Not provided"}
- Existing recommended roles: ${
    Array.isArray(recommendedRoles) && recommendedRoles.length > 0
      ? recommendedRoles.join(", ")
      : "Not provided"
  }
- Existing recommended company types: ${
    Array.isArray(recommendedCompanyTypes) && recommendedCompanyTypes.length > 0
      ? recommendedCompanyTypes.join(", ")
      : "Not provided"
  }
- Target location: ${targetLocation}

Return valid JSON only.

JSON shape:
{
  "recommendedRoles": [
    {
      "role": "role name",
      "matchScore": 0,
      "reason": "why this role matches the resume"
    }
  ],
  "recommendedCompanyTypes": ["company type 1", "company type 2"],
  "suggestedCompanies": [
    {
      "name": "company name or realistic company category",
      "type": "company type",
      "matchScore": 0,
      "reason": "why this company/company type matches"
    }
  ],
  "interviewFocusAreas": ["focus area 1", "focus area 2"]
}

Rules:
- Scores must be 0-100.
- Focus on realistic student, internship, fresh graduate, and entry-level opportunities.
- If exact real companies are uncertain, recommend realistic company categories.
- Do not invent fake facts about companies.
- Keep recommendations practical for interview preparation.
`;

  try {
    const parsed = await callAiJson(prompt, { maxTokens: 900 });

    res.json({
      recommendedRoles: Array.isArray(parsed.recommendedRoles)
        ? parsed.recommendedRoles.slice(0, 5)
        : fallback.recommendedRoles,
      recommendedCompanyTypes: asStringArray(
        parsed.recommendedCompanyTypes,
        fallback.recommendedCompanyTypes,
      ).slice(0, 6),
      suggestedCompanies: Array.isArray(parsed.suggestedCompanies)
        ? parsed.suggestedCompanies.slice(0, 8)
        : fallback.suggestedCompanies,
      interviewFocusAreas: asStringArray(
        parsed.interviewFocusAreas,
        fallback.interviewFocusAreas,
      ).slice(0, 6),
      source: "ai",
      provider: getAiConfig().provider,
      model: getAiConfig().model,
    });
  } catch (error) {
    console.error("AI company recommendation failed:", error);

    res.json({
      ...fallback,
      source: "fallback",
      warning:
        "AI company recommendation failed or quota was exceeded. Local fallback recommendations were used.",
    });
  }
});

app.listen(PORT, () => {
  const config = getAiConfig();

  console.log(`Server running on port ${PORT}`);
  console.log(`AI enabled: ${shouldUseAi() ? "yes" : "no"}`);
  console.log(`AI provider: ${config.provider}`);
  console.log(`AI model: ${config.model}`);
  console.log(`Resume bucket: ${RESUME_BUCKET}`);
});
