import type { AnswerWithFeedback, Question, SpeechMetrics, VisualMetrics } from "@/lib/types";
import { INTERVIEW_METRICS_VERSION, INTERVIEW_SCORING_VERSION } from "./scoringConfig";
import {
  createAnswerInterviewMetrics,
  createCanonicalSpeechMetrics,
  createCanonicalVisualMetrics,
} from "./metricAdapters";
import { measuredMetric, unavailableMetric } from "./normalization";
import { composeInterviewScore } from "./scoreComposer";
import type {
  AnswerInterviewMetrics,
  AnswerQualityMetrics,
  InterviewIntegrityMetrics,
  MetricValue,
  SessionInterviewMetrics,
} from "./scoringTypes";

export function aggregateMetricValues(
  metrics: Array<MetricValue | undefined>,
  unavailableReason: string,
  weighting: "equal" | "duration" | "samples" = "equal",
) {
  const available = metrics.filter((metric): metric is MetricValue =>
    Boolean(metric?.applicable && metric.measurable && metric.value !== null),
  );
  if (!available.length) return unavailableMetric(unavailableReason);
  const getWeight = (metric: MetricValue) =>
    weighting === "duration"
      ? Math.max(0, metric.durationMs || 0)
      : weighting === "samples"
        ? Math.max(0, metric.sampleCount || 0)
        : 1;
  const totalWeight = available.reduce((total, metric) => total + getWeight(metric), 0);
  if (totalWeight <= 0) return unavailableMetric(unavailableReason);
  const score =
    available.reduce((total, metric) => total + metric.value! * getWeight(metric), 0) / totalWeight;
  return measuredMetric(score, {
    sampleCount: available.reduce((total, metric) => total + (metric.sampleCount || 0), 0),
    durationMs: available.reduce((total, metric) => total + (metric.durationMs || 0), 0),
  });
}

export function aggregateFillerRate(
  answers: ReadonlyArray<{ fillerCount: number; wordCount: number }>,
) {
  const totals = answers.reduce(
    (result, answer) => ({
      fillerCount: result.fillerCount + Math.max(0, Number(answer.fillerCount) || 0),
      wordCount: result.wordCount + Math.max(0, Number(answer.wordCount) || 0),
    }),
    { fillerCount: 0, wordCount: 0 },
  );
  return totals.wordCount > 0 ? (totals.fillerCount / totals.wordCount) * 100 : null;
}

function aggregateAnswerQuality(answers: AnswerInterviewMetrics[]): AnswerQualityMetrics {
  const completed = answers.filter((answer) => answer.status === "completed");
  return {
    relevance: aggregateMetricValues(
      completed.map((answer) => answer.answerQuality?.relevance),
      "No relevance evaluations were available.",
    ),
    completeness: aggregateMetricValues(
      completed.map((answer) => answer.answerQuality?.completeness),
      "Completeness is not returned by the current evaluator.",
    ),
    structure: aggregateMetricValues(
      completed.map((answer) => answer.answerQuality?.structure),
      "No structure evaluations were available.",
    ),
    specificity: aggregateMetricValues(
      completed.map((answer) => answer.answerQuality?.specificity),
      "Specificity is not returned by the current evaluator.",
    ),
    technicalAccuracy: aggregateMetricValues(
      completed.map((answer) => answer.answerQuality?.technicalAccuracy),
      "No applicable role-specific evaluations were available.",
    ),
    overall: aggregateMetricValues(
      completed.map((answer) => answer.answerQuality?.overall),
      "No completed answer evaluations were available.",
    ),
  };
}

export function aggregateSessionMetrics({
  mode,
  answers,
  questions,
  speechMetrics,
  visualMetrics,
  integrity,
}: {
  mode?: string;
  answers: AnswerWithFeedback[];
  questions?: Question[];
  speechMetrics?: SpeechMetrics | null;
  visualMetrics?: VisualMetrics | null;
  integrity?: InterviewIntegrityMetrics;
}): SessionInterviewMetrics {
  const answerMetrics = answers.map(createAnswerInterviewMetrics);
  const completedIds = new Set(answerMetrics.map((answer) => answer.questionId));
  const skippedQuestionIds = (questions || [])
    .map((question) => question.id)
    .filter((questionId) => !completedIds.has(questionId));
  const answerQuality = aggregateAnswerQuality(answerMetrics);
  const speechDelivery = createCanonicalSpeechMetrics(speechMetrics);
  const visualPresentation = createCanonicalVisualMetrics(visualMetrics);
  const score = composeInterviewScore({
    mode,
    answerQualityScore: answerQuality.overall?.value ?? null,
    speechDeliveryScore: speechDelivery.overall?.value ?? null,
    visualPresentationScore: visualPresentation.overall?.value ?? null,
  });

  return {
    metricsVersion: INTERVIEW_METRICS_VERSION,
    scoringVersion: INTERVIEW_SCORING_VERSION,
    answers: answerMetrics,
    skippedQuestionIds,
    answerQuality,
    speechDelivery,
    visualPresentation,
    integrity,
    score,
  };
}
