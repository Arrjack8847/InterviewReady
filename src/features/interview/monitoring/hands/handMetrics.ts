import { HAND_THRESHOLDS as T } from "./handThresholds";
import type { HandFrameAnalysis, HandGuidance, HandMetricsSummary } from "./handTypes";

export const createEmptyHandSummary = (): HandMetricsSummary => ({
  measurableDurationMs: 0,
  noHandsDurationMs: 0,
  oneHandDurationMs: 0,
  twoHandsDurationMs: 0,
  naturalGestureDurationMs: 0,
  activeGestureDurationMs: 0,
  excessiveGestureDurationMs: 0,
  clearFaceDurationMs: 0,
  handsNearFaceDurationMs: 0,
  faceObstructionDurationMs: 0,
  cameraObstructionDurationMs: 0,
  extendedHandsNearFaceEventCount: 0,
  faceObstructionEventCount: 0,
  cameraObstructionEventCount: 0,
  excessiveHandMovementEventCount: 0,
  naturalGestureRatio: 0,
  excessiveGestureRatio: 0,
  clearFaceFromHandsRatio: 0,
});

export function createHandMetricsController() {
  let summary = createEmptyHandSummary();
  let last: HandFrameAnalysis | null = null;
  let nearStarted: number | null = null;
  let faceStarted: number | null = null;
  let cameraStarted: number | null = null;
  let excessiveStarted: number | null = null;
  let recorded = { near: false, face: false, camera: false, excessive: false };
  const movements: number[] = [];

  function resetTracking() {
    last = null;
    nearStarted = faceStarted = cameraStarted = excessiveStarted = null;
    recorded = { near: false, face: false, camera: false, excessive: false };
    movements.length = 0;
  }
  function ratios() {
    const d = Math.max(summary.measurableDurationMs, 1);
    return {
      ...summary,
      naturalGestureRatio: (summary.noHandsDurationMs + summary.naturalGestureDurationMs) / d,
      excessiveGestureRatio: summary.excessiveGestureDurationMs / d,
      clearFaceFromHandsRatio: summary.clearFaceDurationMs / d,
    };
  }
  function process(frame: HandFrameAnalysis, recordMetrics: boolean) {
    if (!recordMetrics || !frame.measurable) {
      resetTracking();
      return;
    }
    const elapsed = last ? Math.max(0, Math.min(frame.timestamp - last.timestamp, 1_000)) : 0;
    const movement = Boolean(
      last &&
      frame.hands.some((hand, index) => {
        const before = last?.hands[index];
        return (
          before &&
          Math.hypot(hand.centerX - before.centerX, hand.centerY - before.centerY) >
            T.significantMovementDistance
        );
      }),
    );
    if (movement) movements.push(frame.timestamp);
    while (movements[0] && frame.timestamp - movements[0] > T.movementWindowMs) movements.shift();
    const excessive = movements.length > T.excessiveDirectionChanges;
    frame = {
      ...frame,
      significantMovement: movement,
      gestureActivity: excessive
        ? "excessive"
        : movement
          ? "active"
          : frame.handCount
            ? "natural"
            : "still",
    };
    summary.measurableDurationMs += elapsed;
    if (frame.handCount === 0) summary.noHandsDurationMs += elapsed;
    else if (frame.handCount === 1) summary.oneHandDurationMs += elapsed;
    else summary.twoHandsDurationMs += elapsed;
    if (frame.gestureActivity === "natural" || frame.gestureActivity === "still")
      summary.naturalGestureDurationMs += elapsed;
    if (frame.gestureActivity === "active") summary.activeGestureDurationMs += elapsed;
    if (excessive) summary.excessiveGestureDurationMs += elapsed;
    const near = frame.leftHandNearFace || frame.rightHandNearFace;
    const faceBlocked = frame.faceObstruction === "significantly_obstructed";
    const cameraBlocked = (frame.cameraObstructionRatio || 0) >= T.cameraObstructionArea;
    if (!faceBlocked) summary.clearFaceDurationMs += elapsed;
    else summary.faceObstructionDurationMs += elapsed;
    if (near) summary.handsNearFaceDurationMs += elapsed;
    if (cameraBlocked) summary.cameraObstructionDurationMs += elapsed;
    nearStarted = near ? (nearStarted ?? frame.timestamp) : null;
    faceStarted = faceBlocked ? (faceStarted ?? frame.timestamp) : null;
    cameraStarted = cameraBlocked ? (cameraStarted ?? frame.timestamp) : null;
    excessiveStarted = excessive ? (excessiveStarted ?? frame.timestamp) : null;
    if (!near) recorded.near = false;
    if (!faceBlocked) recorded.face = false;
    if (!cameraBlocked) recorded.camera = false;
    if (!excessive) recorded.excessive = false;
    const event = (
      started: number | null,
      threshold: number,
      key: keyof typeof recorded,
      increment: () => void,
    ) => {
      if (started !== null && frame.timestamp - started >= threshold && !recorded[key]) {
        increment();
        recorded[key] = true;
      }
    };
    event(nearStarted, T.nearFaceEventMs, "near", () => summary.extendedHandsNearFaceEventCount++);
    event(faceStarted, T.faceObstructionEventMs, "face", () => summary.faceObstructionEventCount++);
    event(
      cameraStarted,
      T.cameraObstructionEventMs,
      "camera",
      () => summary.cameraObstructionEventCount++,
    );
    event(
      excessiveStarted,
      T.excessiveMovementEventMs,
      "excessive",
      () => summary.excessiveHandMovementEventCount++,
    );
    last = frame;
    summary = ratios();
  }
  function getGuidance(): HandGuidance {
    if (!last?.measurable)
      return {
        label: "Gesture analysis unavailable",
        activity: "not_measurable",
        activeDurationMs: 0,
      };
    const duration = (start: number | null) => (start === null ? 0 : last!.timestamp - start);
    if (duration(cameraStarted) >= T.cameraObstructionGuidanceMs)
      return {
        label: "Move your hand away from the camera",
        activity: last.gestureActivity,
        activeDurationMs: duration(cameraStarted),
      };
    if (duration(faceStarted) >= T.faceObstructionGuidanceMs)
      return {
        label: "Avoid covering your face",
        activity: last.gestureActivity,
        activeDurationMs: duration(faceStarted),
      };
    if (duration(nearStarted) >= T.nearFaceGuidanceMs)
      return {
        label: "Keep hands slightly lower",
        activity: last.gestureActivity,
        activeDurationMs: duration(nearStarted),
      };
    if (duration(excessiveStarted) >= T.excessiveMovementGuidanceMs)
      return {
        label: "Use slower, deliberate gestures",
        activity: "excessive",
        activeDurationMs: duration(excessiveStarted),
      };
    return {
      label:
        last.handCount === 0
          ? "Hands not visible — optional"
          : last.gestureActivity === "active"
            ? "Active gestures"
            : "Natural gestures",
      activity: last.gestureActivity,
      activeDurationMs: 0,
    };
  }
  return { process, getSummary: () => ratios(), getGuidance, resetTracking };
}
