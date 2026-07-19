export const FACE_ANALYSIS_THRESHOLDS = {
  yawDegrees: 12,
  pitchDegrees: 11,
  rollDegrees: 10,
  centerOffsetX: 0.16,
  centerOffsetY: 0.18,
  minimumFaceWidth: 0.12,
  minimumFaceHeight: 0.16,
  maximumFaceWidth: 0.82,
  maximumFaceHeight: 0.88,
  smoothingFactor: 0.3,
} as const;

export const ENGAGEMENT_THRESHOLDS = {
  briefLookAwayMs: 2_000,
  visibleLookAwayMs: 5_000,
  extendedLookAwayMs: 10_000,
  offCenterGuidanceMs: 3_000,
  offCenterEventMs: 8_000,
  movementWindowMs: 10_000,
  excessiveDirectionChanges: 6,
} as const;
