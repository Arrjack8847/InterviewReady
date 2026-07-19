import { calculateAnswerAverageScore, calculateAnswerBreakdown } from "@/lib/metrics";
import type { AnswerWithFeedback, FinalReport } from "@/lib/types";

export function buildFallbackFinalReport(history: AnswerWithFeedback[]): FinalReport {
  return {
    overallScore: calculateAnswerAverageScore(history),
    breakdown: calculateAnswerBreakdown(history),
    strengths: [
      "You completed the interview practice.",
      "Your answers show a starting point for improvement.",
    ],
    improvements: [
      "Use more specific examples from your projects or experience.",
      "Structure your answers clearly using the STAR method.",
      "Explain your professional reasoning clearly for role-specific and situational questions.",
    ],
    nextSteps: [
      "Prepare 3 project examples using the STAR method.",
      "Practice explaining role-specific answers and professional decisions clearly.",
      "Review weak answers and rewrite them.",
    ],
    improvedSampleAnswer:
      "A stronger answer should briefly explain the situation, describe your specific action, and clearly state the result or impact.",
    answerCount: history.filter((item) => item.answer.trim()).length,
    source: "fallback",
    warning:
      "We had trouble generating the enhanced report, so your report was created from the saved interview results.",
  };
}
