import type { FinalReport } from "@/lib/types";
import type { AnswerScoreBreakdown, ScoreContribution } from "./scoringTypes";

export function selectScoreBreakdown(report?: FinalReport | null): AnswerScoreBreakdown | null {
  return report?.scoreBreakdown || report?.canonicalMetrics?.score || null;
}

export function selectOverallScore(report?: FinalReport | null) {
  const breakdown = selectScoreBreakdown(report);
  return breakdown ? breakdown.overallScore : (report?.overallScore ?? null);
}

export function selectAnswerQualityScore(report?: FinalReport | null) {
  return selectScoreBreakdown(report)?.answerQualityScore ?? null;
}

export function selectSpeechDeliveryScore(report?: FinalReport | null) {
  return selectScoreBreakdown(report)?.speechDeliveryScore ?? report?.speechConfidenceScore ?? null;
}

export function selectVisualPresentationScore(report?: FinalReport | null) {
  return (
    selectScoreBreakdown(report)?.visualPresentationScore ??
    report?.overallPresentationScore ??
    null
  );
}

export function selectScoreContributions(report?: FinalReport | null): ScoreContribution[] {
  return selectScoreBreakdown(report)?.contributions || [];
}

export function selectUnavailableMetrics(report?: FinalReport | null) {
  return selectScoreContributions(report).filter((item) => item.applicable && !item.measurable);
}
