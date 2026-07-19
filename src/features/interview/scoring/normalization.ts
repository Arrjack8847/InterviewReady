import type {
  MetricMap,
  MetricValue,
  ScoreCategoryBreakdown,
  ScoreContribution,
} from "./scoringTypes";

export function clampNormalizedScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

export function roundScore(value: number) {
  return Math.round(clampNormalizedScore(value));
}

export function normalizeRatioToScore(value: number | null | undefined) {
  return Number.isFinite(value) ? clampNormalizedScore(Number(value) * 100) : null;
}

export function normalizeCountToScore(
  count: number | null | undefined,
  penaltyPerEvent: number,
  maximumPenalty = 100,
) {
  if (!Number.isFinite(count)) return null;
  return clampNormalizedScore(
    100 - Math.min(Math.max(Number(count), 0) * penaltyPerEvent, maximumPenalty),
  );
}

export function normalizeDurationRatioToScore(
  affectedDurationMs: number | null | undefined,
  measurableDurationMs: number | null | undefined,
) {
  if (
    !Number.isFinite(affectedDurationMs) ||
    !Number.isFinite(measurableDurationMs) ||
    Number(measurableDurationMs) <= 0
  )
    return null;
  return clampNormalizedScore(
    (1 - Math.min(Math.max(Number(affectedDurationMs), 0) / Number(measurableDurationMs), 1)) * 100,
  );
}

export function measuredMetric(
  value: number,
  options: Omit<MetricValue, "value" | "measurable" | "applicable"> = {},
): MetricValue {
  return {
    value: clampNormalizedScore(value),
    measurable: true,
    applicable: true,
    ...options,
  };
}

export function unavailableMetric(reason: string, applicable = true): MetricValue {
  return { value: null, rawValue: null, measurable: false, applicable, reason };
}

export function composeMetricCategory(
  metrics: MetricMap,
  weights: Readonly<Record<string, number>>,
  labels: Readonly<Record<string, string>> = {},
): ScoreCategoryBreakdown {
  const entries = Object.entries(weights);
  const availableWeight = entries.reduce((total, [key, configuredWeight]) => {
    const metric = metrics[key];
    return metric?.applicable && metric.measurable && metric.value !== null
      ? total + configuredWeight
      : total;
  }, 0);

  const contributions: ScoreContribution[] = entries.map(([key, configuredWeight]) => {
    const metric = metrics[key];
    const measurable = Boolean(
      metric?.applicable &&
      metric.measurable &&
      metric.value !== null &&
      Number.isFinite(metric.value),
    );
    const effectiveWeight =
      measurable && availableWeight > 0 ? configuredWeight / availableWeight : 0;
    const rawScore = measurable ? clampNormalizedScore(metric!.value!) : null;
    return {
      key,
      label: labels[key] || key,
      rawScore,
      configuredWeight,
      effectiveWeight,
      contribution: rawScore === null ? 0 : rawScore * effectiveWeight,
      measurable,
      applicable: metric?.applicable ?? true,
      reason: metric?.reason,
    };
  });

  if (availableWeight <= 0) return { score: null, contributions };
  return {
    score: roundScore(contributions.reduce((total, item) => total + item.contribution, 0)),
    contributions,
  };
}
