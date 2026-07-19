export const INTERVIEW_ANSWER_DRAFT_KEY = "ir.answerDraft";
const MAX_DRAFT_LENGTH = 20_000;

import type { PersistedAnswerMetrics } from "./scoring/scoringTypes";
import type { Feedback } from "@/lib/types";

export interface InterviewAnswerDraft {
  version: 2;
  sessionId: string;
  questionId: string;
  answer: string;
  finalizedTranscript?: string;
  mode?: string;
  submittedAt?: string;
  metrics?: PersistedAnswerMetrics;
  feedback?: Feedback;
  persistenceStatus: "editing" | "pending" | "failed";
  updatedAt: string;
}

export function readInterviewAnswerDraft(
  sessionId: string,
  questionId: string | number,
): InterviewAnswerDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(INTERVIEW_ANSWER_DRAFT_KEY) || "null") as
      | (Omit<Partial<InterviewAnswerDraft>, "version"> & { version?: number })
      | null;
    if (
      (parsed?.version !== 1 && parsed?.version !== 2) ||
      parsed.sessionId !== sessionId ||
      parsed.questionId !== String(questionId) ||
      typeof parsed.answer !== "string"
    ) {
      return null;
    }
    return {
      version: 2,
      sessionId: parsed.sessionId,
      questionId: parsed.questionId,
      answer: parsed.answer.slice(0, MAX_DRAFT_LENGTH),
      finalizedTranscript: parsed.finalizedTranscript?.slice(0, MAX_DRAFT_LENGTH),
      mode: parsed.mode,
      submittedAt: parsed.submittedAt,
      metrics: parsed.metrics,
      feedback: parsed.feedback,
      persistenceStatus: parsed.persistenceStatus ?? "editing",
      updatedAt: parsed.updatedAt || new Date(0).toISOString(),
    };
  } catch {
    localStorage.removeItem(INTERVIEW_ANSWER_DRAFT_KEY);
    return null;
  }
}

export function saveInterviewAnswerLocalDraft(
  sessionId: string,
  questionId: string | number,
  answer: string,
  details: Partial<
    Pick<
      InterviewAnswerDraft,
      "finalizedTranscript" | "mode" | "submittedAt" | "metrics" | "feedback" | "persistenceStatus"
    >
  > = {},
) {
  if (typeof window === "undefined" || !sessionId) return;
  const normalized = answer.slice(0, MAX_DRAFT_LENGTH);
  if (!normalized.trim()) {
    clearInterviewAnswerLocalDraft(sessionId, questionId);
    return;
  }
  const draft: InterviewAnswerDraft = {
    version: 2,
    sessionId,
    questionId: String(questionId),
    answer: normalized,
    ...details,
    persistenceStatus: details.persistenceStatus ?? "editing",
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(INTERVIEW_ANSWER_DRAFT_KEY, JSON.stringify(draft));
}

export function clearInterviewAnswerLocalDraft(sessionId?: string, questionId?: string | number) {
  if (typeof window === "undefined") return;
  if (!sessionId || questionId === undefined) {
    localStorage.removeItem(INTERVIEW_ANSWER_DRAFT_KEY);
    return;
  }
  const current = readInterviewAnswerDraft(sessionId, questionId);
  if (current) localStorage.removeItem(INTERVIEW_ANSWER_DRAFT_KEY);
}
