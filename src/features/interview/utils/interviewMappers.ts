import { getQuestionIdentityKey } from "../../../lib/types";
import type { AnswerWithFeedback, Question } from "@/lib/types";
import type { SavedInterviewAnswer } from "../types";

export function normalizeStoredQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((question, questionIndex) => {
      if (!question || typeof question !== "object") return null;
      const record = question as { id?: unknown; text?: unknown; question?: unknown };
      const text = String(record.text || record.question || "").trim();
      if (!text) return null;
      const numericId = Number(record.id);
      return {
        id: Number.isFinite(numericId) && numericId > 0 ? numericId : questionIndex + 1,
        text,
      };
    })
    .filter((question): question is NonNullable<typeof question> => question !== null);
}

export function mapSavedAnswerToHistoryItem(answer: SavedInterviewAnswer): AnswerWithFeedback {
  const scores = answer.scores || {};
  const feedback = answer.feedback || {
    scoreScale: Number(scores.overall || 0) > 10 ? ("hundred" as const) : ("ten" as const),
    overall: Number(scores.overall || 0),
    clarity: Number(scores.clarity || 0),
    relevance: Number(scores.relevance || 0),
    structure: Number(scores.structure || 0),
    technicalAccuracy: Number(scores.technicalAccuracy || 0),
    strengths: answer.strengths || [],
    weaknesses: answer.weaknesses || [],
    improvedAnswer: answer.improvedAnswer || "",
    summary: answer.summary || "",
    interviewTip: answer.interviewTip || "",
  };
  return {
    question: { id: answer.questionId, text: answer.questionText },
    answer: answer.answerText,
    feedback,
  };
}

export function getResumeIndex(
  questions: Question[],
  savedAnswers: SavedInterviewAnswer[],
  currentQuestionIndex?: number | null,
) {
  if (questions.length === 0) return 0;
  const answeredIds = new Set(
    savedAnswers.map((answer) => getQuestionIdentityKey(answer.questionId)),
  );
  const firstUnanswered = questions.findIndex(
    (question) => !answeredIds.has(getQuestionIdentityKey(question.id)),
  );
  if (firstUnanswered >= 0) return firstUnanswered;
  const storedIndex = Number(currentQuestionIndex || 0);
  return Number.isFinite(storedIndex)
    ? Math.min(Math.max(storedIndex, 0), questions.length - 1)
    : Math.max(questions.length - 1, 0);
}
