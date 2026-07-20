import type {
  Feedback,
  FinalReport,
  InterviewMode,
  Question,
  QuestionId,
  SpeechMetrics,
  VisualMetrics,
} from "@/lib/types";

export type ReportStatus = "complete" | "partially_complete" | "processing" | "empty";

export type ReportAnswerStatus =
  "completed" | "skipped" | "empty" | "evaluation_pending" | "evaluation_failed" | "legacy";

export interface ReportSessionSource {
  id?: string;
  role?: string;
  targetRole?: string;
  targetCompany?: string;
  type?: string;
  interviewType?: string;
  difficulty?: string;
  mode?: string;
  status?: string;
  questionCount?: number;
  generatedQuestions?: Question[];
  overallScore?: number | null;
  finalReport?: FinalReport | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface ReportAnswerSource {
  id?: string;
  questionId: QuestionId;
  questionText: string;
  answerText: string;
  evaluationStatus?: string;
  feedback?: Partial<Feedback> | null;
  scores?: Record<string, unknown> | null;
  strengths?: string[];
  weaknesses?: string[];
  improvedAnswer?: string | null;
  summary?: string | null;
  interviewTip?: string | null;
  createdAt?: string;
}

export interface InterviewReportSource {
  sessionId?: string;
  session?: ReportSessionSource | null;
  report?: FinalReport | null;
  answers?: ReportAnswerSource[];
  questions?: Question[];
  speechMetrics?: SpeechMetrics | null;
  visualMetrics?: VisualMetrics | null;
  cachedSetup?: {
    role?: string;
    targetRole?: string;
    targetCompany?: string;
    type?: string;
    difficulty?: string;
    mode?: InterviewMode | string;
    questionCount?: number;
  } | null;
  dataWarning?: string;
}

export interface ReportMetricRow {
  key: string;
  label: string;
  score: number | null;
  valueLabel?: string;
  interpretation: string;
  measurable: boolean;
}

export interface ReportCategoryScore {
  key: "answerQuality" | "speechDelivery" | "visualPresentation";
  label: string;
  score: number | null;
  available: boolean;
  configuredWeight: number;
  effectiveWeight: number;
  contribution: number;
  interpretation: string;
  metrics: ReportMetricRow[];
}

export interface ReportPriority {
  id: string;
  rank: number;
  title: string;
  whyItMatters: string;
  evidence: string;
  nextStep: string;
  relatedQuestionNumbers: number[];
  source: "answer" | "speech" | "visual" | "audio";
}

export interface ReportAnswerReview {
  id: string;
  questionId: QuestionId;
  questionNumber: number;
  question: string;
  category: string;
  status: ReportAnswerStatus;
  score: number | null;
  scoreLabel: string | null;
  assessment: string;
  answerText: string;
  strengths: string[];
  improvements: string[];
  recommendedStructure: string[];
  improvedAnswer: string | null;
  interviewTip: string | null;
  metrics: ReportMetricRow[];
}

export interface ReportDeliverySection {
  score: number | null;
  summary: string;
  metrics: ReportMetricRow[];
}

export interface ReportIntegrityNote {
  id: string;
  text: string;
}

export interface ReportPracticeStep {
  id: string;
  title: string;
  detail: string;
}

export interface ReportMethodology {
  metricsVersion: string;
  scoringVersion: string;
  isLegacy: boolean;
  scoringSummary: string;
  limitations: string[];
}

export interface InterviewReportViewModel {
  sessionId: string;
  title: string;
  role: string;
  targetRole: string;
  targetCompany: string | null;
  interviewType: string;
  difficulty: string;
  interviewMode: "text" | "voice" | "video";
  completedAt: string | null;
  completedAtLabel: string;
  durationMs: number | null;
  durationLabel: string | null;
  completedQuestionCount: number;
  totalQuestionCount: number;
  skippedQuestionCount: number;
  status: ReportStatus;
  overallScore: number | null;
  performanceLabel: string | null;
  summary: string;
  strongestArea: string;
  primaryImprovement: string;
  recommendedAction: string;
  categoryScores: ReportCategoryScore[];
  priorities: ReportPriority[];
  answers: ReportAnswerReview[];
  speechDelivery: ReportDeliverySection | null;
  visualPresence: ReportDeliverySection | null;
  integrityNotes: ReportIntegrityNote[];
  unavailableMetrics: string[];
  practicePlan: ReportPracticeStep[];
  methodology: ReportMethodology;
  isLegacy: boolean;
  dataWarning: string | null;
  debugData: unknown;
}

export type InterviewReportLoadState =
  | { status: "loading"; viewModel: null; error: null }
  | { status: "ready"; viewModel: InterviewReportViewModel; error: null }
  | { status: "empty"; viewModel: null; error: null }
  | { status: "error"; viewModel: null; error: string };
