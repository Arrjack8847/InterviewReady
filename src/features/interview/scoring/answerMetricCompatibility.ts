import type { PersistedAnswerMetrics } from "./scoringTypes";

export function readPersistedAnswerMetrics(
  ...candidates: unknown[]
): PersistedAnswerMetrics | undefined {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = candidate as Partial<PersistedAnswerMetrics>;
    if (
      typeof value.metricsVersion === "string" &&
      typeof value.scoringVersion === "string" &&
      value.measurementStatus &&
      typeof value.measurementStatus === "object" &&
      value.raw &&
      typeof value.raw === "object" &&
      value.normalized &&
      typeof value.normalized === "object" &&
      Array.isArray(value.contributions)
    ) {
      return value as PersistedAnswerMetrics;
    }
  }
  return undefined;
}
