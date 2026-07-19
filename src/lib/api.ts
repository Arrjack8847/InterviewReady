import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import type {
  AnswerWithFeedback,
  CompanyContext,
  Difficulty,
  Feedback,
  FinalReport,
  InterviewType,
  SpeechMetrics,
  VisualMetrics,
} from "@/lib/types";

const LOCAL_API_BASE_URL = "http://localhost:5055";
const PRODUCTION_API_BASE_URL = "https://interview2-k5w5.onrender.com";
const DEFAULT_API_REQUEST_TIMEOUT_MS = 60_000;
const AI_API_REQUEST_TIMEOUT_MS = 90_000;
const LONG_AI_API_REQUEST_TIMEOUT_MS = 120_000;

function getApiRequestTimeoutMs(endpoint: string): number {
  switch (endpoint) {
    case "/api/generate-questions":
    case "/api/analyze-answer":
    case "/api/recommend-companies":
      return AI_API_REQUEST_TIMEOUT_MS;

    case "/api/final-report":
    case "/api/extract-resume":
    case "/api/company-context":
      return LONG_AI_API_REQUEST_TIMEOUT_MS;

    default:
      return DEFAULT_API_REQUEST_TIMEOUT_MS;
  }
}

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "");
const configuredApiBaseUrlIsLocal =
  configuredApiBaseUrl?.startsWith("http://localhost") ||
  configuredApiBaseUrl?.startsWith("http://127.0.0.1");

export const API_BASE_URL =
  import.meta.env.PROD && configuredApiBaseUrlIsLocal
    ? PRODUCTION_API_BASE_URL
    : configuredApiBaseUrl || (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : LOCAL_API_BASE_URL);

async function getSupabaseAccessToken() {
  requireSupabaseConfig();

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("User is not logged in.");
  }

  return token;
}

function normalizeBackendScore100(score: unknown): number | null {
  const value = Number(score);

  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(Math.round(value), 0), 100);
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getSupabaseAccessToken();
  const controller = new AbortController();
  const timeoutMs = getApiRequestTimeoutMs(endpoint);
  const externalSignal = options.signal;
  let timedOut = false;

  const handleExternalAbort = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    handleExternalAbort();
  } else {
    externalSignal?.addEventListener("abort", handleExternalAbort, { once: true });
  }

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    const responseText = await response.text();
    let data: Record<string, unknown> = {};

    if (responseText) {
      try {
        data = JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}.`);
        }

        throw new Error("API returned an invalid response.");
      }
    }

    if (!response.ok) {
      const backendMessage =
        typeof data.error === "string" && data.error.trim()
          ? data.error
          : typeof data.message === "string" && data.message.trim()
            ? data.message
            : "";

      if (backendMessage) {
        throw new Error(backendMessage);
      }

      if ([502, 503, 504].includes(response.status)) {
        throw new Error("The AI service is temporarily unavailable. Please try again.");
      }

      throw new Error(`API request failed with status ${response.status}.`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        const timeoutSeconds = Math.round(timeoutMs / 1_000);
        throw new Error(
          `The request took longer than ${timeoutSeconds} seconds. Please try again.`,
        );
      }

      throw new Error("The request was cancelled.");
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the interview server. Check your connection and try again.",
      );
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", handleExternalAbort);
  }
}

export async function testBackendAuth() {
  return apiRequest<{
    message: string;
    user: {
      uid: string;
      email: string;
      name: string;
    };
  }>("/api/auth/me");
}

export interface AiQuestion {
  id: string;
  text: string;
  category: string;
  difficulty?: string;
  expectedFocus?: string;
}

export interface GenerateQuestionsInput {
  role: string;
  targetRole?: string;
  type: InterviewType;
  difficulty: Difficulty;
  questionCount: number;
  targetCompany?: string;
  jobDescription?: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: string[];
  resumeEducation?: string;
  companyContext?: Partial<CompanyContext>;
}

export async function generateInterviewQuestions(input: GenerateQuestionsInput) {
  return apiRequest<{
    questions: AiQuestion[];
    context: {
      role: string;
      type: InterviewType;
      difficulty: Difficulty;
      experienceLevel?: Difficulty;
      questionCount: number;
      targetCompany: string;
      jobDescription: string;
    };
  }>("/api/generate-questions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AnalyzeAnswerInput {
  question: string;
  answer: string;
  role: string;
  targetRole?: string;
  type: InterviewType;
  difficulty: Difficulty;
  targetCompany?: string;
  jobDescription?: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: string[];
  resumeEducation?: string;
}

interface BackendFeedback {
  overallScore: number;
  clarityScore: number;
  relevanceScore: number;
  structureScore: number;
  technicalScore: number;
  contentScore?: number;
  professionalismScore?: number;
  answerValidity?: Feedback["answerValidity"];
  questionType?: Feedback["questionType"];
  relevanceClassification?: Feedback["relevanceClassification"];
  scoreLabel?: string;
  requiresReview?: boolean;
  reviewReasons?: string[];
  evaluationVersion?: string;
  confidence?: number;
  wordCount?: number;
  feedback?: string;
  strengths: string[];
  improvements: string[];
  improvedAnswer: string;
  interviewTip?: string;
  source?: "ai" | "fallback" | "local-fallback";
  warning?: string;
  provider?: string;
  model?: string;
  primaryProvider?: string | null;
  reviewProvider?: string | null;
  wasReviewed?: boolean;
  fallbackUsed?: boolean;
}

export async function analyzeInterviewAnswer(input: AnalyzeAnswerInput): Promise<Feedback> {
  const data = await apiRequest<BackendFeedback>("/api/analyze-answer", {
    method: "POST",
    body: JSON.stringify(input),
  });

  const clarity = normalizeBackendScore100(data.clarityScore);
  const relevance = normalizeBackendScore100(data.relevanceScore);
  const structure = normalizeBackendScore100(data.structureScore);
  const technicalAccuracy = normalizeBackendScore100(data.contentScore ?? data.technicalScore);
  const overall = normalizeBackendScore100(data.overallScore);
  if (
    clarity === null ||
    relevance === null ||
    structure === null ||
    technicalAccuracy === null ||
    overall === null
  ) {
    throw new Error("Answer evaluation returned invalid score fields. Please retry.");
  }
  const professionalismScore = normalizeBackendScore100(data.professionalismScore);

  return {
    scoreScale: "hundred",
    overall,
    clarity,
    relevance,
    structure,
    technicalAccuracy,
    contentScore: technicalAccuracy,
    professionalismScore: professionalismScore ?? undefined,
    answerValidity: data.answerValidity,
    questionType: data.questionType,
    relevanceClassification: data.relevanceClassification,
    scoreLabel: data.scoreLabel,
    requiresReview: data.requiresReview,
    reviewReasons: data.reviewReasons,
    evaluationVersion: data.evaluationVersion,
    confidence: data.confidence,
    wordCount: data.wordCount,
    strengths: data.strengths || [],
    weaknesses: data.improvements || [],
    improvedAnswer: data.improvedAnswer,
    summary:
      data.feedback ||
      data.interviewTip ||
      "Your answer was reviewed by AI. Focus on clarity, relevance, structure, and specific examples.",
    interviewTip: data.interviewTip || "Use the STAR method: Situation, Task, Action, Result.",
    source: data.source,
    warning: data.warning,
    provider: data.provider,
    model: data.model,
    primaryProvider: data.primaryProvider,
    reviewProvider: data.reviewProvider,
    wasReviewed: data.wasReviewed,
    fallbackUsed: data.fallbackUsed,
  };
}

export interface GenerateFinalReportInput {
  answers: AnswerWithFeedback[];
  role: string;
  targetRole?: string;
  type: InterviewType;
  difficulty: Difficulty;
  targetCompany?: string;
  jobDescription?: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: string[];
  resumeEducation?: string;
  mode?: string;
  speechMetrics?: SpeechMetrics;
  visualMetrics?: VisualMetrics;
}

interface BackendFinalReport {
  overallScore: number;
  breakdown: {
    clarity: number;
    relevance: number;
    structure: number;
    confidence: number;
    technicalAccuracy: number;
  };
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
  improvedSampleAnswer: string;
  summary?: string;
  answerCount?: number;
  scoredAnswerCount?: number;
  source?: "ai" | "fallback" | "local-fallback";
  warning?: string;
  provider?: string;
  model?: string;
}

export async function generateFinalReport(input: GenerateFinalReportInput): Promise<FinalReport> {
  const data = await apiRequest<BackendFinalReport>("/api/final-report", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return {
    overallScore: data.overallScore,
    breakdown: {
      clarity: data.breakdown?.clarity || 0,
      relevance: data.breakdown?.relevance || 0,
      structure: data.breakdown?.structure || 0,
      confidence: data.breakdown?.confidence || 0,
      technicalAccuracy: data.breakdown?.technicalAccuracy || 0,
    },
    strengths: data.strengths || [],
    improvements: data.improvements || [],
    nextSteps: data.nextSteps || [],
    improvedSampleAnswer: data.improvedSampleAnswer || "",
    summary: data.summary,
    answerCount: data.answerCount,
    scoredAnswerCount: data.scoredAnswerCount,
    source: data.source,
    warning: data.warning,
    provider: data.provider,
    model: data.model,
  };
}

export interface ResumeAnalysisResponse {
  message: string;
  resumeId: string;
  extractedText: string;
  resumeSummary: string;
  parsedSkills: string[];
  parsedProjects: string[];
  parsedEducation: string;
  parsedExperience: string[];
  careerLevel: string;
  strongAreas: string[];
  weakAreas: string[];
  recommendedRoles: string[];
  recommendedCompanyTypes: string[];
  interviewFocusAreas: string[];
  source: string;
  warning?: string;
  resume?: unknown;
}

export async function extractResumeAnalysis(input: { resumeId: string }) {
  return apiRequest<ResumeAnalysisResponse>("/api/extract-resume", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface CompanyContextResponse {
  companyName: string;
  targetRole: string;
  industry: string;
  companyOverview: string;
  roleExpectations: string[];
  companyChallenges: string[];
  scenarioQuestionAngles: string[];
  interviewFocusAreas: string[];
  sourceUrls: string[];
  source: string;
  provider?: string;
  model?: string;
  warning?: string;
}

export async function generateCompanyContext(input: {
  targetCompany: string;
  targetRole: string;
  jobDescription?: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: string[];
}) {
  return apiRequest<CompanyContextResponse>("/api/company-context", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface RecommendedRole {
  role: string;
  matchScore: number;
  reason: string;
}

export interface SuggestedCompany {
  name: string;
  type: string;
  matchScore: number;
  reason: string;
}

export interface CompanyRecommendationResponse {
  recommendedRoles: RecommendedRole[];
  recommendedCompanyTypes: string[];
  suggestedCompanies: SuggestedCompany[];
  interviewFocusAreas: string[];
  source: string;
  provider?: string;
  model?: string;
  warning?: string;
}

export async function recommendCompanies(input: {
  resumeSummary: string;
  resumeSkills: string[];
  resumeProjects: string[];
  resumeEducation: string;
  recommendedRoles?: string[];
  recommendedCompanyTypes?: string[];
  targetLocation?: string;
}) {
  return apiRequest<CompanyRecommendationResponse>("/api/recommend-companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
