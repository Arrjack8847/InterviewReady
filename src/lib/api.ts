import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import type {
  AnswerWithFeedback,
  CompanyContext,
  Feedback,
  FinalReport,
  SpeechMetrics,
  VisualMetrics,
} from "@/lib/types";

const LOCAL_API_BASE_URL = "http://localhost:5055";
const PRODUCTION_API_BASE_URL = "https://interview2-k5w5.onrender.com";

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

function toTenPointScale(score: number) {
  const value = Number(score);

  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value / 10), 0), 10);
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getSupabaseAccessToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "API request failed.");
  }

  return data as T;
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
  type: string;
  difficulty: string;
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
      type: string;
      difficulty: string;
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
  type: string;
  difficulty: string;
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
  strengths: string[];
  improvements: string[];
  improvedAnswer: string;
  interviewTip?: string;
}

export async function analyzeInterviewAnswer(input: AnalyzeAnswerInput): Promise<Feedback> {
  const data = await apiRequest<BackendFeedback>("/api/analyze-answer", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return {
    overall: toTenPointScale(data.overallScore),
    clarity: toTenPointScale(data.clarityScore),
    relevance: toTenPointScale(data.relevanceScore),
    structure: toTenPointScale(data.structureScore),
    technicalAccuracy: toTenPointScale(data.technicalScore),
    strengths: data.strengths || [],
    weaknesses: data.improvements || [],
    improvedAnswer: data.improvedAnswer,
    summary:
      data.interviewTip ||
      "Your answer was reviewed by AI. Focus on clarity, relevance, structure, and specific examples.",
    interviewTip: data.interviewTip || "Use the STAR method: Situation, Task, Action, Result.",
  };
}

export interface GenerateFinalReportInput {
  answers: AnswerWithFeedback[];
  role: string;
  targetRole?: string;
  type: string;
  difficulty: string;
  targetCompany?: string;
  jobDescription?: string;
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: string[];
  resumeEducation?: string;
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
  warning?: string;
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
    warning: data.warning,
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

export async function extractResumeAnalysis(input: {
  resumeId: string;
  filePath: string;
  fileName: string;
}) {
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
