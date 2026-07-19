import {
  INTERVIEW_SCORING_CONFIG,
  INTERVIEW_SCORING_VERSION,
  normalizeInterviewMode,
} from "./scoringConfig";
import {
  composeMetricCategory,
  measuredMetric,
  roundScore,
  unavailableMetric,
} from "./normalization";
import type { AnswerScoreBreakdown, ScoreContribution } from "./scoringTypes";

const TOP_LEVEL_LABELS = {
  answerQuality: "Answer quality",
  speechDelivery: "Speech delivery",
  visualPresentation: "Visual presentation",
} as const;

export function composeInterviewScore({
  mode,
  answerQualityScore,
  speechDeliveryScore,
  visualPresentationScore,
}: {
  mode?: string;
  answerQualityScore: number | null;
  speechDeliveryScore?: number | null;
  visualPresentationScore?: number | null;
}): AnswerScoreBreakdown {
  const normalizedMode = normalizeInterviewMode(mode);
  const configuredWeights = INTERVIEW_SCORING_CONFIG.topLevelWeights[normalizedMode];
  const metrics = {
    answerQuality:
      answerQualityScore === null
        ? unavailableMetric("Answer evaluation is unavailable.")
        : measuredMetric(answerQualityScore),
    speechDelivery:
      configuredWeights.speechDelivery <= 0
        ? unavailableMetric("Speech delivery is not applicable in text mode.", false)
        : speechDeliveryScore === null || speechDeliveryScore === undefined
          ? unavailableMetric("Speech delivery was not measured.")
          : measuredMetric(speechDeliveryScore),
    visualPresentation:
      configuredWeights.visualPresentation <= 0
        ? unavailableMetric("Visual presentation is not applicable in this mode.", false)
        : visualPresentationScore === null || visualPresentationScore === undefined
          ? unavailableMetric("Visual presentation was not measured.")
          : measuredMetric(visualPresentationScore),
  };
  const category = composeMetricCategory(metrics, configuredWeights, TOP_LEVEL_LABELS);

  // Content is required for a candidate-performance score. Delivery-only data remains
  // available for coaching but cannot stand in for a failed answer evaluation.
  const overallScore = answerQualityScore === null ? null : category.score;
  const contributions: ScoreContribution[] = category.contributions.map((item) => ({
    ...item,
    contribution: overallScore === null ? 0 : item.contribution,
  }));
  const explanations = buildScoreExplanations(contributions, overallScore);

  return {
    overallScore,
    answerQualityScore,
    speechDeliveryScore: speechDeliveryScore ?? null,
    visualPresentationScore: visualPresentationScore ?? null,
    contributions,
    explanations,
    scoringVersion: INTERVIEW_SCORING_VERSION,
  };
}

export const composeAnswerScore = composeInterviewScore;

function buildScoreExplanations(contributions: ScoreContribution[], overallScore: number | null) {
  if (overallScore === null) {
    return ["Answer quality was unavailable, so no candidate-performance score was produced."];
  }
  const answer = contributions.find((item) => item.key === "answerQuality");
  const unavailable = contributions.filter((item) => item.applicable && !item.measurable);
  const explanations = [
    answer?.measurable
      ? "Answer quality was measured and remained the dominant score component."
      : "Answer quality was not measured.",
  ];
  if (unavailable.length) {
    explanations.push(
      `${unavailable.map((item) => item.label).join(" and ")} ${unavailable.length === 1 ? "was" : "were"} unavailable and excluded; available weights were renormalized.`,
    );
  }
  return explanations;
}

export function composeLegacyFinalScore({
  mode,
  answerScore,
  speechScore,
  videoPresentationScore,
}: {
  mode?: string;
  answerScore?: number | null;
  speechScore?: number | null;
  videoPresentationScore?: number | null;
}) {
  return (
    composeInterviewScore({
      mode,
      answerQualityScore: answerScore ?? null,
      speechDeliveryScore: speechScore,
      visualPresentationScore: videoPresentationScore,
    }).overallScore ?? 0
  );
}
