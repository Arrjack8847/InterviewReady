import { requireSupabaseConfig, supabase } from "@/lib/supabase";
import {
  normalizeExperienceLevel,
  normalizeInterviewType,
} from "@/lib/types";
import type {
  Feedback,
  FinalReport,
  InterviewSetup,
  Question,
  SpeechMetrics,
  VisualMetrics,
} from "@/lib/types";
import type { PersistedAnswerMetrics } from "@/features/interview/scoring/scoringTypes";
import { readPersistedAnswerMetrics } from "@/features/interview/scoring/answerMetricCompatibility";

type SupabaseInterviewMode = "text" | "voice" | "video";
type InterviewSessionStatus = "pending" | "in_progress" | "completed" | "cancelled" | "failed";
type StoredQuestion = Question & Record<string, unknown>;

type ExtendedInterviewSetup = Omit<InterviewSetup, "mode"> & {
  targetRole?: string;
  targetCompany?: string;
  jobDescription?: string;
  resumeId?: string;
  mode?: InterviewSetup["mode"] | SupabaseInterviewMode;
};

export interface SavedInterviewSessionInput {
  userId: string;
  setup: ExtendedInterviewSetup;
  attemptId: string;
}

export interface SavedAnswerInput {
  sessionId: string;
  userId: string;
  question: Question;
  answer: string;
  feedback: Feedback;
  answerMetrics?: PersistedAnswerMetrics;
}

export type SavedAnswerDraftInput = Omit<SavedAnswerInput, "feedback">;

export interface SavedSpeechMetricsInput {
  sessionId: string;
  userId: string;
  metrics: SpeechMetrics;
}

export interface SavedVisualMetricsInput {
  sessionId: string;
  userId: string;
  metrics: VisualMetrics;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResumeRecord {
  id: string;
  userId: string;
  fileName: string;
  fileUrl: string;
  filePath?: string;
  extractedText: string;
  parsedSkills: string[];
  parsedProjects: string[];
  parsedEducation: string;
  parsedExperience?: string[];
  resumeSummary: string;
  careerLevel?: string;
  strongAreas?: string[];
  weakAreas?: string[];
  recommendedRoles?: string[];
  recommendedCompanyTypes?: string[];
  interviewFocusAreas?: string[];
  analysisStatus?: string;
  uploadedAt?: string;
  analyzedAt?: string;
}

interface ProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  created_at?: string;
  updated_at?: string;
}

interface InterviewSessionRow {
  id: string;
  user_id: string;
  resume_id: string | null;
  role: string;
  target_role: string;
  target_company: string;
  job_description: string;
  type: string;
  interview_type: string;
  difficulty: string;
  mode: SupabaseInterviewMode;
  question_count: number;
  status: InterviewSessionStatus;
  overall_score: number | null;
  final_report: FinalReport | null;
  generated_questions: StoredQuestion[] | null;
  current_question_index: number | null;
  attempt_id: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

interface AnswerRow {
  id: string;
  session_id: string;
  user_id: string;
  question_id: number;
  question_text: string;
  answer_text: string;
  feedback: Feedback | null;
  scores: Record<string, unknown> | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  improved_answer: string | null;
  summary: string | null;
  interview_tip: string | null;
  created_at: string;
}

interface VisualMetricsRow {
  id: string;
  session_id: string;
  user_id: string;
  camera_presence_score: number | null;
  face_visibility_score: number | null;
  face_centering_score: number | null;
  hand_visibility_score: number | null;
  movement_stability_score: number | null;
  overall_presentation_score: number | null;
  analysis_duration_ms: number | null;
  frame_count: number | null;
  face_detected_frames: number | null;
  face_centered_frames: number | null;
  hand_detected_frames: number | null;
  stable_frames: number | null;
  visual_summary: string[] | null;
  raw_metrics: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

interface SpeechMetricsRow {
  id: string;
  session_id: string;
  user_id: string;
  metrics: SpeechMetrics;
  created_at: string;
  updated_at: string | null;
}

function normalizeInterviewMode(
  mode?: InterviewSetup["mode"] | SupabaseInterviewMode,
): SupabaseInterviewMode {
  const normalized = String(mode || "text").toLowerCase();

  if (normalized === "voice") return "voice";
  if (normalized === "video") return "video";

  return "text";
}

function toNullableUuid(value?: string) {
  return value && value.trim() ? value : null;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeQuestionNumber(questionId: unknown): number {
  if (typeof questionId === "number" && Number.isInteger(questionId) && questionId > 0) {
    return questionId;
  }

  const match = String(questionId ?? "").match(/(\d+)(?!.*\d)/);
  const parsed = match ? Number(match[1]) : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid question id "${String(questionId)}". Expected a positive number.`);
  }

  return parsed;
}

function normalizeFeedbackForStorage(feedback: Feedback) {
  const value = feedback as Feedback & Record<string, unknown>;

  const overall = toFiniteNumber(value.overallScore ?? value.overall);
  const clarity = toFiniteNumber(value.clarityScore ?? value.clarity);
  const relevance = toFiniteNumber(value.relevanceScore ?? value.relevance);
  const structure = toFiniteNumber(value.structureScore ?? value.structure);
  const technicalAccuracy = toFiniteNumber(
    value.technicalScore ?? value.technicalAccuracyScore ?? value.technicalAccuracy,
  );
  const content = toFiniteNumber(value.contentScore ?? technicalAccuracy);
  const professionalism = toFiniteNumber(value.professionalismScore);

  const strengths = toStringArray(value.strengths);
  const weaknesses = toStringArray(value.improvements ?? value.weaknesses);
  const improvedAnswer = String(value.improvedAnswer ?? "");
  const summary = String(value.summary ?? "");
  const interviewTip = String(value.interviewTip ?? "");
  const scoreScale = value.scoreScale === "ten" ? 10 : 100;

  return {
    canonicalFeedback: {
      ...value,
      overallScore: overall,
      clarityScore: clarity,
      relevanceScore: relevance,
      structureScore: structure,
      technicalScore: technicalAccuracy,
      contentScore: content,
      professionalismScore: professionalism,
      strengths,
      improvements: weaknesses,
      improvedAnswer,
      summary,
      interviewTip,
      scoreScale: scoreScale === 100 ? "hundred" : "ten",
    },
    scores: {
      overall,
      clarity,
      relevance,
      structure,
      technicalAccuracy,
      content,
      professionalism,
      answerValidity: value.answerValidity,
      questionType: value.questionType,
      relevanceClassification: value.relevanceClassification,
      scoreLabel: value.scoreLabel,
      requiresReview: Boolean(value.requiresReview),
      reviewReasons: toStringArray(value.reviewReasons),
      evaluationVersion: String(value.evaluationVersion ?? ""),
      scoreScale,
    },
    strengths,
    weaknesses,
    improvedAnswer,
    summary,
    interviewTip,
  };
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name || "",
    email: row.email || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: InterviewSessionRow) {
  const resolvedRole = row.target_role?.trim() || row.role?.trim() || "";
  const interviewType = normalizeInterviewType(
    row.interview_type || row.type,
  );

  return {
    id: row.id,
    userId: row.user_id,
    resumeId: row.resume_id || "",
    role: resolvedRole,
    targetRole: resolvedRole,
    targetCompany: row.target_company,
    jobDescription: row.job_description,
    type: interviewType,
    interviewType,
    difficulty: normalizeExperienceLevel(
      row.difficulty,
    ),
    mode: row.mode,
    questionCount: row.question_count,
    status: row.status,
    overallScore: row.overall_score,
    finalReport: row.final_report,
    generatedQuestions: row.generated_questions || [],
    currentQuestionIndex: row.current_question_index ?? 0,
    attemptId: row.attempt_id || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at || "",
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
  };
}

function mapAnswer(row: AnswerRow) {
  const storedFeedback = row.feedback as (Feedback & { evaluationStatus?: string }) | null;
  const answerMetrics = readPersistedAnswerMetrics(
    storedFeedback?.answerMetrics,
    row.scores?.answerMetrics,
  );
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    questionId: row.question_id,
    questionText: row.question_text,
    answerText: row.answer_text,
    feedback: storedFeedback
      ? { ...storedFeedback, ...(answerMetrics ? { answerMetrics } : {}) }
      : null,
    answerMetrics,
    evaluationStatus: storedFeedback?.evaluationStatus === "pending" ? "pending" : "completed",
    scores: row.scores,
    strengths: row.strengths || [],
    weaknesses: row.weaknesses || [],
    improvedAnswer: row.improved_answer,
    summary: row.summary,
    interviewTip: row.interview_tip,
    createdAt: row.created_at,
  };
}

function mapVisualMetrics(row: VisualMetricsRow) {
  const raw = row.raw_metrics || {};

  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    metrics: {
      ...raw,
      cameraPresenceScore: toFiniteNumber(row.camera_presence_score),
      faceVisibilityScore: toFiniteNumber(row.face_visibility_score),
      faceCenteringScore: toFiniteNumber(row.face_centering_score),
      handVisibilityScore: toFiniteNumber(row.hand_visibility_score),
      movementStabilityScore: toFiniteNumber(row.movement_stability_score),
      overallPresentationScore: toFiniteNumber(row.overall_presentation_score),
      analysisDurationMs: toFiniteNumber(row.analysis_duration_ms),
      frameCount: toFiniteNumber(row.frame_count),
      faceDetectedFrames: toFiniteNumber(row.face_detected_frames),
      faceCenteredFrames: toFiniteNumber(row.face_centered_frames),
      handDetectedFrames: toFiniteNumber(row.hand_detected_frames),
      stableFrames: toFiniteNumber(row.stable_frames),
      visualSummary: row.visual_summary || [],
    } as VisualMetrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at || "",
  };
}

function throwIfSupabaseError(error: unknown, fallback: string): never {
  if (error instanceof Error) {
    throw error;
  }

  if (error && typeof error === "object" && "message" in error) {
    throw new Error(String((error as { message?: unknown }).message || fallback));
  }

  throw new Error(fallback);
}

export async function createUserProfile({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  requireSupabaseConfig();

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      name,
      email,
    },
    { onConflict: "id" },
  );

  if (error) {
    throwIfSupabaseError(error, "Could not save your profile.");
  }
}

export async function getUserProfile(userId: string) {
  requireSupabaseConfig();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throwIfSupabaseError(error, "Could not load your profile.");
  }

  return data ? mapProfile(data as ProfileRow) : null;
}

export async function createResumeRecord({
  userId,
  fileName,
  fileUrl = "",
  filePath = "",
  extractedText = "",
  parsedSkills = [],
  parsedProjects = [],
  parsedEducation = "",
  resumeSummary = "",
}: {
  userId?: string;
  fileName: string;
  fileUrl?: string;
  filePath?: string;
  extractedText?: string;
  parsedSkills?: string[];
  parsedProjects?: string[];
  parsedEducation?: string;
  resumeSummary?: string;
}) {
  requireSupabaseConfig();

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("User is not logged in.");
  }

  const finalUserId = authData.user.id;

  if (userId && userId !== finalUserId) {
    console.warn("Resume userId mismatch detected. Using Supabase Auth user id.", {
      passedUserId: userId,
      authUserId: finalUserId,
    });
  }

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      user_id: finalUserId,
      file_name: fileName,
      file_url: fileUrl,
      file_path: filePath,
      extracted_text: extractedText,
      parsed_skills: parsedSkills,
      parsed_projects: parsedProjects,
      parsed_education: parsedEducation,
      resume_summary: resumeSummary,
      analysis_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throwIfSupabaseError(error, "Could not save your resume record.");
  }

  return data.id as string;
}

export async function createInterviewSession({
  userId,
  setup,
  attemptId,
}: SavedInterviewSessionInput) {
  requireSupabaseConfig();

  const now = new Date().toISOString();
  const targetRole = (setup.targetRole || setup.role || "").trim();
  const interviewType = normalizeInterviewType(setup.type);
  const experienceLevel = normalizeExperienceLevel(setup.difficulty);

  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({
      user_id: userId,
      resume_id: toNullableUuid(setup.resumeId),
      role: targetRole,
      target_role: targetRole,
      target_company: setup.targetCompany || "",
      job_description: setup.jobDescription || "",
      type: interviewType,
      interview_type: interviewType,
      difficulty: experienceLevel,
      mode: normalizeInterviewMode(setup.mode),
      question_count: setup.questionCount,
      status: "in_progress",
      overall_score: null,
      final_report: null,
      generated_questions: null,
      current_question_index: 0,
      attempt_id: attemptId,
      updated_at: now,
      completed_at: null,
      cancelled_at: null,
    })
    .select("id")
    .single();

  if (error) {
    throwIfSupabaseError(error, "Could not create the interview session.");
  }

  return data.id as string;
}

export async function updateInterviewSessionQuestions({
  sessionId,
  userId,
  questions,
}: {
  sessionId: string;
  userId: string;
  questions: Question[];
}) {
  requireSupabaseConfig();

  const { error } = await supabase
    .from("interview_sessions")
    .update({
      generated_questions: questions,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throwIfSupabaseError(error, "Could not save generated interview questions.");
  }
}

export async function updateInterviewSessionProgress({
  sessionId,
  userId,
  currentQuestionIndex,
}: {
  sessionId: string;
  userId: string;
  currentQuestionIndex: number;
}) {
  requireSupabaseConfig();

  const { error } = await supabase
    .from("interview_sessions")
    .update({
      current_question_index: currentQuestionIndex,
      status: "in_progress",
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throwIfSupabaseError(error, "Could not update interview progress.");
  }
}

export async function saveInterviewAnswer({
  sessionId,
  userId,
  question,
  answer,
  feedback,
  answerMetrics,
}: SavedAnswerInput) {
  requireSupabaseConfig();

  const normalized = normalizeFeedbackForStorage(feedback);
  const questionNumber = normalizeQuestionNumber(question.id);

  const { data, error } = await supabase
    .from("answers")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        question_id: questionNumber,
        question_text: question.text,
        answer_text: answer,
        feedback: {
          ...normalized.canonicalFeedback,
          ...(answerMetrics ? { answerMetrics } : {}),
          evaluationStatus: "completed",
        },
        scores: {
          ...normalized.scores,
          ...(answerMetrics ? { answerMetrics } : {}),
        },
        strengths: normalized.strengths,
        weaknesses: normalized.weaknesses,
        improved_answer: normalized.improvedAnswer,
        summary: normalized.summary,
        interview_tip: normalized.interviewTip,
      },
      { onConflict: "session_id,question_id" },
    )
    .select("id")
    .single();

  if (error) {
    throwIfSupabaseError(error, "Could not save your answer.");
  }

  return data.id as string;
}

export async function saveInterviewAnswerDraft({
  sessionId,
  userId,
  question,
  answer,
}: SavedAnswerDraftInput) {
  requireSupabaseConfig();

  const questionNumber = normalizeQuestionNumber(question.id);
  const { data, error } = await supabase
    .from("answers")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        question_id: questionNumber,
        question_text: question.text,
        answer_text: answer,
        feedback: {
          evaluationStatus: "pending",
          evaluationVersion: "humane-v2",
        },
        scores: {},
        strengths: [],
        weaknesses: [],
        improved_answer: "",
        summary: "",
        interview_tip: "",
      },
      { onConflict: "session_id,question_id" },
    )
    .select("id")
    .single();

  if (error) {
    throwIfSupabaseError(error, "Could not save your answer before evaluation.");
  }

  return data.id as string;
}

export async function completeInterviewSession({
  sessionId,
  userId,
  overallScore,
  finalReport,
}: {
  sessionId: string;
  userId: string;
  overallScore: number;
  finalReport?: FinalReport;
}) {
  requireSupabaseConfig();

  const { error } = await supabase
    .from("interview_sessions")
    .update({
      overall_score: overallScore,
      final_report: finalReport || null,
      status: "completed",
      completed_at: new Date().toISOString(),
      cancelled_at: null,
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throwIfSupabaseError(error, "Could not complete the interview session.");
  }
}

export async function cancelInterviewSession({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  requireSupabaseConfig();

  const { error } = await supabase
    .from("interview_sessions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throwIfSupabaseError(error, "Could not cancel the interview session.");
  }
}

export async function getInterviewSession(sessionId: string, userId?: string) {
  requireSupabaseConfig();

  let query = supabase.from("interview_sessions").select("*").eq("id", sessionId);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throwIfSupabaseError(error, "Could not load the interview session.");
  }

  return data ? mapSession(data as InterviewSessionRow) : null;
}

export async function getUserInterviewSessions(userId: string) {
  requireSupabaseConfig();

  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throwIfSupabaseError(error, "Could not load interview sessions.");
  }

  return (data || []).map((row: unknown) => mapSession(row as InterviewSessionRow));
}

export async function getLatestInProgressSession(userId: string) {
  requireSupabaseConfig();

  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwIfSupabaseError(error, "Could not load your active interview session.");
  }

  return data ? mapSession(data as InterviewSessionRow) : null;
}

export async function getSessionAnswers({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  requireSupabaseConfig();

  const { data, error } = await supabase
    .from("answers")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("question_id", { ascending: true })
    .limit(50);

  if (error) {
    throwIfSupabaseError(error, "Could not load interview answers.");
  }

  return (data || []).map((row: unknown) => mapAnswer(row as AnswerRow));
}

export async function saveSpeechMetrics({ sessionId, userId, metrics }: SavedSpeechMetricsInput) {
  requireSupabaseConfig();

  const { data, error } = await supabase
    .from("speech_metrics")
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        metrics,
      },
      { onConflict: "session_id" },
    )
    .select("id")
    .single();

  if (error) {
    if (error.code === "PGRST205") {
      console.warn(
        "Speech metrics are not persisted until the speech_metrics migration is applied.",
      );
      return null;
    }
    throwIfSupabaseError(error, "Could not save speech metrics.");
  }

  return data.id as string;
}

export async function saveVisualMetrics({ sessionId, userId, metrics }: SavedVisualMetricsInput) {
  requireSupabaseConfig();

  const value = metrics as VisualMetrics & Record<string, unknown>;
  const now = new Date().toISOString();

  const payload = {
    session_id: sessionId,
    user_id: userId,
    camera_presence_score: toFiniteNumber(value.cameraPresenceScore),
    face_visibility_score: toFiniteNumber(value.faceVisibilityScore),
    face_centering_score: toFiniteNumber(value.faceCenteringScore),
    hand_visibility_score: toFiniteNumber(value.handVisibilityScore),
    movement_stability_score: toFiniteNumber(value.movementStabilityScore),
    overall_presentation_score: toFiniteNumber(value.overallPresentationScore),
    analysis_duration_ms: Math.max(0, Math.round(toFiniteNumber(value.analysisDurationMs))),
    frame_count: Math.max(0, Math.round(toFiniteNumber(value.frameCount))),
    face_detected_frames: Math.max(0, Math.round(toFiniteNumber(value.faceDetectedFrames))),
    face_centered_frames: Math.max(0, Math.round(toFiniteNumber(value.faceCenteredFrames))),
    hand_detected_frames: Math.max(0, Math.round(toFiniteNumber(value.handDetectedFrames))),
    stable_frames: Math.max(0, Math.round(toFiniteNumber(value.stableFrames))),
    visual_summary: toStringArray(value.visualSummary),
    raw_metrics: value,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("visual_metrics")
    .upsert(payload, { onConflict: "session_id" })
    .select("id")
    .single();

  if (error) {
    throwIfSupabaseError(error, "Could not save visual metrics.");
  }

  return data.id as string;
}

export async function getSessionSpeechMetrics({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  requireSupabaseConfig();

  const { data, error } = await supabase
    .from("speech_metrics")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST205") {
      return null;
    }
    throwIfSupabaseError(error, "Could not load speech metrics.");
  }

  if (!data) return null;

  const row = data as SpeechMetricsRow;
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    metrics: row.metrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at || "",
  };
}

export async function getSessionVisualMetrics({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  requireSupabaseConfig();

  const { data, error } = await supabase
    .from("visual_metrics")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throwIfSupabaseError(error, "Could not load visual metrics.");
  }

  return data ? mapVisualMetrics(data as VisualMetricsRow) : null;
}
