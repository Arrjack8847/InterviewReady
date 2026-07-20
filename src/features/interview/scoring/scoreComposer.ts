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
import type {
  AnswerScoreBreakdown,
  ScoreContribution,
} from "./scoringTypes";

const TOP_LEVEL_LABELS = {
  answerQuality: "Answer quality",
  speechDelivery: "Speech delivery",
  visualPresentation: "Visual presentation",
} as const;

type AnswerValidity =
  | "meaningful"
  | "partially_meaningful"
  | "unrelated"
  | "non_answer"
  | "nonsense"
  | "blank";

type RelevanceClassification =
  | "directly_relevant"
  | "partially_relevant"
  | "unrelated";

interface ComposeInterviewScoreInput {
  mode?: string;

  answerQualityScore: number | null;
  speechDeliveryScore?: number | null;
  visualPresentationScore?: number | null;

  /**
   * Optional evaluation metadata used to prevent delivery
   * scores from rescuing invalid or unrelated answers.
   */
  answerValidity?: AnswerValidity;
  relevanceClassification?: RelevanceClassification;
}

interface GuardedScoreResult {
  score: number;
  safeguardsApplied: string[];
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    Math.max(Math.round(value), 0),
    100,
  );
}

function applyAnswerQualitySafeguards({
  rawOverallScore,
  answerQualityScore,
  answerValidity,
  relevanceClassification,
}: {
  rawOverallScore: number;
  answerQualityScore: number;
  answerValidity?: AnswerValidity;
  relevanceClassification?: RelevanceClassification;
}): GuardedScoreResult {
  const safeguards =
    INTERVIEW_SCORING_CONFIG.answerQualitySafeguards;

  const normalizedAnswerScore =
    clampScore(answerQualityScore);

  let guardedScore =
    clampScore(rawOverallScore);

  const safeguardsApplied: string[] = [];

  /**
   * Delivery should have limited positive influence when
   * the actual answer is weak.
   *
   * Poor delivery can still reduce the final result, but
   * excellent delivery cannot fully rescue weak content.
   */
  if (
    normalizedAnswerScore <
      safeguards.fullDeliveryContributionThreshold &&
    guardedScore > normalizedAnswerScore
  ) {
    const deliveryContributionRatio =
      normalizedAnswerScore /
      safeguards.fullDeliveryContributionThreshold;

    const positiveDeliveryLift =
      guardedScore - normalizedAnswerScore;

    guardedScore =
      normalizedAnswerScore +
      positiveDeliveryLift *
        deliveryContributionRatio;

    safeguardsApplied.push(
      "Speech and visual delivery received limited influence because answer quality was below the meaningful-answer threshold.",
    );
  }

  /**
   * A weak answer should never become a moderate or strong
   * answer purely because microphone or camera metrics were good.
   */
  if (
    normalizedAnswerScore <
    safeguards.weakAnswerThreshold
  ) {
    const cappedScore = Math.min(
      guardedScore,
      safeguards.weakAnswerCompositeMaximum,
    );

    if (cappedScore !== guardedScore) {
      safeguardsApplied.push(
        "The final score was capped because answer quality was weak.",
      );
    }

    guardedScore = cappedScore;
  }

  /**
   * Deterministic validity caps take priority over delivery.
   */
  if (answerValidity === "blank") {
    guardedScore = Math.min(
      guardedScore,
      safeguards.blankMaximum,
    );

    safeguardsApplied.push(
      "No answer was provided, so delivery metrics could not increase the score.",
    );
  }

  if (answerValidity === "nonsense") {
    guardedScore = Math.min(
      guardedScore,
      safeguards.nonsenseMaximum,
    );

    safeguardsApplied.push(
      "No meaningful answer was detected, so delivery metrics could not increase the score.",
    );
  }

  if (answerValidity === "non_answer") {
    guardedScore = Math.min(
      guardedScore,
      safeguards.nonAnswerMaximum,
    );

    safeguardsApplied.push(
      "The response was classified as a non-answer, so the final score was limited.",
    );
  }

  if (
    answerValidity === "unrelated" ||
    relevanceClassification === "unrelated"
  ) {
    guardedScore = Math.min(
      guardedScore,
      safeguards.unrelatedMaximum,
    );

    safeguardsApplied.push(
      "The response was unrelated to the question, so the final score was limited.",
    );
  }

  return {
    score: clampScore(guardedScore),
    safeguardsApplied: Array.from(
      new Set(safeguardsApplied),
    ),
  };
}

function adjustContributionsToFinalScore(
  contributions: ScoreContribution[],
  rawOverallScore: number,
  finalOverallScore: number,
): ScoreContribution[] {
  if (rawOverallScore <= 0) {
    return contributions.map((item) => ({
      ...item,
      contribution: 0,
    }));
  }

  if (rawOverallScore === finalOverallScore) {
    return contributions;
  }

  const adjustmentRatio =
    finalOverallScore / rawOverallScore;

  return contributions.map((item) => ({
    ...item,

    contribution: item.measurable
      ? Math.round(
          item.contribution *
            adjustmentRatio *
            100,
        ) / 100
      : 0,
  }));
}

export function composeInterviewScore({
  mode,
  answerQualityScore,
  speechDeliveryScore,
  visualPresentationScore,
  answerValidity,
  relevanceClassification,
}: ComposeInterviewScoreInput): AnswerScoreBreakdown {
  const normalizedMode =
    normalizeInterviewMode(mode);

  const configuredWeights =
    INTERVIEW_SCORING_CONFIG.topLevelWeights[
      normalizedMode
    ];

  const metrics = {
    answerQuality:
      answerQualityScore === null
        ? unavailableMetric(
            "Answer evaluation is unavailable.",
          )
        : measuredMetric(answerQualityScore),

    speechDelivery:
      configuredWeights.speechDelivery <= 0
        ? unavailableMetric(
            "Speech delivery is not applicable in text mode.",
            false,
          )
        : speechDeliveryScore === null ||
            speechDeliveryScore === undefined
          ? unavailableMetric(
              "Speech delivery was not measured.",
            )
          : measuredMetric(
              speechDeliveryScore,
            ),

    visualPresentation:
      configuredWeights.visualPresentation <= 0
        ? unavailableMetric(
            "Visual presentation is not applicable in this mode.",
            false,
          )
        : visualPresentationScore === null ||
            visualPresentationScore === undefined
          ? unavailableMetric(
              "Visual presentation was not measured.",
            )
          : measuredMetric(
              visualPresentationScore,
            ),
  };

  const category = composeMetricCategory(
    metrics,
    configuredWeights,
    TOP_LEVEL_LABELS,
  );

  /**
   * Answer quality is required for a candidate-performance
   * score. Delivery-only measurements are still available
   * for coaching, but they cannot replace answer evaluation.
   */
  if (
    answerQualityScore === null ||
    category.score === null
  ) {
    const contributions: ScoreContribution[] =
      category.contributions.map((item) => ({
        ...item,
        contribution: 0,
      }));

    return {
      overallScore: null,
      answerQualityScore: null,
      speechDeliveryScore:
        speechDeliveryScore ?? null,
      visualPresentationScore:
        visualPresentationScore ?? null,
      contributions,
      explanations: [
        "Answer quality was unavailable, so no candidate-performance score was produced.",
      ],
      scoringVersion:
        INTERVIEW_SCORING_VERSION,
    };
  }

  const rawOverallScore =
    roundScore(category.score);

  const guardedResult =
    applyAnswerQualitySafeguards({
      rawOverallScore,
      answerQualityScore,
      answerValidity,
      relevanceClassification,
    });

  const contributions =
    adjustContributionsToFinalScore(
      category.contributions,
      rawOverallScore,
      guardedResult.score,
    );

  const explanations =
    buildScoreExplanations({
      contributions,
      overallScore: guardedResult.score,
      safeguardsApplied:
        guardedResult.safeguardsApplied,
    });

  return {
    overallScore: guardedResult.score,
    answerQualityScore:
      roundScore(answerQualityScore),

    speechDeliveryScore:
      speechDeliveryScore === null ||
      speechDeliveryScore === undefined
        ? null
        : roundScore(speechDeliveryScore),

    visualPresentationScore:
      visualPresentationScore === null ||
      visualPresentationScore === undefined
        ? null
        : roundScore(
            visualPresentationScore,
          ),

    contributions,
    explanations,
    scoringVersion:
      INTERVIEW_SCORING_VERSION,
  };
}

export const composeAnswerScore =
  composeInterviewScore;

function buildScoreExplanations({
  contributions,
  overallScore,
  safeguardsApplied,
}: {
  contributions: ScoreContribution[];
  overallScore: number | null;
  safeguardsApplied: string[];
}): string[] {
  if (overallScore === null) {
    return [
      "Answer quality was unavailable, so no candidate-performance score was produced.",
    ];
  }

  const answer = contributions.find(
    (item) =>
      item.key === "answerQuality",
  );

  const unavailable = contributions.filter(
    (item) =>
      item.applicable &&
      !item.measurable,
  );

  const explanations: string[] = [
    answer?.measurable
      ? "Answer quality was measured and remained the dominant score component."
      : "Answer quality was not measured.",
  ];

  if (unavailable.length > 0) {
    const unavailableLabels =
      unavailable
        .map((item) => item.label)
        .join(" and ");

    explanations.push(
      `${unavailableLabels} ${
        unavailable.length === 1
          ? "was"
          : "were"
      } unavailable and excluded; available weights were renormalized.`,
    );
  }

  explanations.push(...safeguardsApplied);

  return Array.from(
    new Set(explanations),
  );
}

export function composeLegacyFinalScore({
  mode,
  answerScore,
  speechScore,
  videoPresentationScore,
  answerValidity,
  relevanceClassification,
}: {
  mode?: string;
  answerScore?: number | null;
  speechScore?: number | null;
  videoPresentationScore?: number | null;
  answerValidity?: AnswerValidity;
  relevanceClassification?: RelevanceClassification;
}): number {
  return (
    composeInterviewScore({
      mode,
      answerQualityScore:
        answerScore ?? null,
      speechDeliveryScore:
        speechScore,
      visualPresentationScore:
        videoPresentationScore,
      answerValidity,
      relevanceClassification,
    }).overallScore ?? 0
  );
}