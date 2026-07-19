import { POSTURE_THRESHOLDS as T } from "./postureThresholds";
import type { PostureFrameAnalysis, PostureGuidance, PostureMetricsSummary } from "./postureTypes";

export function createEmptyPostureSummary(): PostureMetricsSummary {
  return {
    measurableFrames: 0,
    measurableDurationMs: 0,
    goodFramingDurationMs: 0,
    centeredPostureDurationMs: 0,
    levelShoulderDurationMs: 0,
    stableUpperBodyDurationMs: 0,
    prolongedLeanDurationMs: 0,
    prolongedShoulderTiltDurationMs: 0,
    framingIssueDurationMs: 0,
    prolongedLeanEventCount: 0,
    prolongedShoulderTiltEventCount: 0,
    framingIssueEventCount: 0,
    excessiveBodyMovementEventCount: 0,
    postureMeasurableRatio: 0,
    professionalFramingRatio: 0,
    centeredPostureRatio: 0,
    levelShoulderRatio: 0,
    stableUpperBodyRatio: 0,
    averageShoulderAngleDegrees: 0,
    averageTorsoLeanRatio: 0,
  };
}

export function createPostureMetricsController() {
  let summary = createEmptyPostureSummary();
  let last: PostureFrameAnalysis | null = null;
  let smoothed: PostureFrameAnalysis | null = null;
  const totals = { shoulder: 0, lean: 0 };
  let leanStarted: number | null = null;
  let shoulderStarted: number | null = null;
  let framingStarted: number | null = null;
  let leanRecorded = false;
  let shoulderRecorded = false;
  let framingRecorded = false;
  const transitions: number[] = [];

  const ema = (before: number | null, next: number | null) =>
    before === null || next === null
      ? next
      : T.smoothingFactor * next + (1 - T.smoothingFactor) * before;

  function ratios() {
    const duration = Math.max(summary.measurableDurationMs, 1);
    return {
      ...summary,
      postureMeasurableRatio: summary.measurableFrames > 0 ? 1 : 0,
      professionalFramingRatio: summary.goodFramingDurationMs / duration,
      centeredPostureRatio: summary.centeredPostureDurationMs / duration,
      levelShoulderRatio: summary.levelShoulderDurationMs / duration,
      stableUpperBodyRatio: summary.stableUpperBodyDurationMs / duration,
      averageShoulderAngleDegrees:
        summary.measurableFrames > 0 ? totals.shoulder / summary.measurableFrames : 0,
      averageTorsoLeanRatio:
        summary.measurableFrames > 0 ? totals.lean / summary.measurableFrames : 0,
    };
  }

  function resetTracking() {
    last = null;
    smoothed = null;
    leanStarted = null;
    shoulderStarted = null;
    framingStarted = null;
    leanRecorded = false;
    shoulderRecorded = false;
    framingRecorded = false;
    transitions.length = 0;
  }

  function process(frame: PostureFrameAnalysis, record: boolean) {
    if (!record || !frame.measurable) {
      resetTracking();
      return;
    }
    smoothed = smoothed
      ? {
          ...frame,
          shoulderAngleDegrees: ema(smoothed.shoulderAngleDegrees, frame.shoulderAngleDegrees),
          torsoLeanRatio: ema(smoothed.torsoLeanRatio, frame.torsoLeanRatio),
          shoulderMidpointX: ema(smoothed.shoulderMidpointX, frame.shoulderMidpointX),
          shoulderMidpointY: ema(smoothed.shoulderMidpointY, frame.shoulderMidpointY),
          bodyWidthRatio: ema(smoothed.bodyWidthRatio, frame.bodyWidthRatio),
          upperBodyHeightRatio: ema(smoothed.upperBodyHeightRatio, frame.upperBodyHeightRatio),
        }
      : frame;
    const elapsed = last ? Math.max(0, Math.min(frame.timestamp - last.timestamp, 1_000)) : 0;
    const leanBad = Math.abs(smoothed.torsoLeanRatio || 0) > T.torsoLeanRatio;
    const shoulderBad = Math.abs(smoothed.shoulderAngleDegrees || 0) > T.levelShoulderDegrees;
    const framingBad = frame.framing !== "good";
    summary.measurableFrames += 1;
    summary.measurableDurationMs += elapsed;
    if (!framingBad) summary.goodFramingDurationMs += elapsed;
    if (!leanBad) summary.centeredPostureDurationMs += elapsed;
    if (!shoulderBad) summary.levelShoulderDurationMs += elapsed;
    const significantMovement = Boolean(
      last &&
      Math.hypot(
        (frame.shoulderMidpointX || 0) - (last.shoulderMidpointX || 0),
        (frame.shoulderMidpointY || 0) - (last.shoulderMidpointY || 0),
      ) > 0.08,
    );
    if (!significantMovement) summary.stableUpperBodyDurationMs += elapsed;
    totals.shoulder += smoothed.shoulderAngleDegrees || 0;
    totals.lean += smoothed.torsoLeanRatio || 0;

    leanStarted = leanBad ? (leanStarted ?? frame.timestamp) : null;
    shoulderStarted = shoulderBad ? (shoulderStarted ?? frame.timestamp) : null;
    framingStarted = framingBad ? (framingStarted ?? frame.timestamp) : null;
    if (!leanBad) leanRecorded = false;
    if (!shoulderBad) shoulderRecorded = false;
    if (!framingBad) framingRecorded = false;
    if (leanStarted !== null && frame.timestamp - leanStarted >= T.prolongedPostureEventMs) {
      summary.prolongedLeanDurationMs += elapsed;
      if (!leanRecorded) {
        summary.prolongedLeanEventCount += 1;
        leanRecorded = true;
      }
    }
    if (
      shoulderStarted !== null &&
      frame.timestamp - shoulderStarted >= T.prolongedPostureEventMs
    ) {
      summary.prolongedShoulderTiltDurationMs += elapsed;
      if (!shoulderRecorded) {
        summary.prolongedShoulderTiltEventCount += 1;
        shoulderRecorded = true;
      }
    }
    if (framingStarted !== null) {
      summary.framingIssueDurationMs += elapsed;
      if (frame.timestamp - framingStarted >= T.framingEventMs && !framingRecorded) {
        summary.framingIssueEventCount += 1;
        framingRecorded = true;
      }
    }
    if (significantMovement) {
      transitions.push(frame.timestamp);
    }
    while (transitions[0] && frame.timestamp - transitions[0] > T.movementWindowMs)
      transitions.shift();
    if (transitions.length === T.excessiveTransitions + 1)
      summary.excessiveBodyMovementEventCount += 1;
    last = frame;
    summary = ratios();
  }

  function getGuidance(): PostureGuidance {
    if (!last?.measurable)
      return {
        state: "not_measurable",
        postureLabel: "Posture unavailable",
        framingLabel: "Framing unavailable",
        activeDurationMs: 0,
      };
    const leanMs = leanStarted === null ? 0 : last.timestamp - leanStarted;
    const shoulderMs = shoulderStarted === null ? 0 : last.timestamp - shoulderStarted;
    const framingMs = framingStarted === null ? 0 : last.timestamp - framingStarted;
    const postureLabel =
      leanMs >= T.postureGuidanceMs
        ? "Return toward the center"
        : shoulderMs >= T.postureGuidanceMs
          ? "Keep your shoulders relaxed and level"
          : "Centered";
    const framingLabel =
      framingMs < T.framingGuidanceMs
        ? "Good"
        : last.framing === "too_close"
          ? "Move a little farther away"
          : last.framing === "too_far"
            ? "Move a little closer"
            : last.framing === "too_high"
              ? "Lower the camera slightly"
              : last.framing === "too_low"
                ? "Raise the camera slightly"
                : "Return toward the center";
    const activeDurationMs = Math.max(leanMs, shoulderMs, framingMs);
    return {
      state:
        activeDurationMs >= T.prolongedPostureEventMs
          ? "needs_adjustment"
          : activeDurationMs >= Math.min(T.postureGuidanceMs, T.framingGuidanceMs)
            ? "minor_adjustment"
            : "good",
      postureLabel,
      framingLabel,
      activeDurationMs,
    };
  }

  return {
    process,
    getSummary: () => ratios(),
    getGuidance,
    getSmoothed: () => smoothed,
    resetTracking,
  };
}
