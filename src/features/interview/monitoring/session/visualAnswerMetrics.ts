import { createEmptyCameraEngagementSummary } from "../engagement/cameraEngagement";
import type { CameraEngagementSummary } from "../face/faceTypes";
import { createEmptyHandSummary } from "../hands/handMetrics";
import type { HandMetricsSummary } from "../hands/handTypes";
import { createEmptyPostureSummary } from "../posture/postureMetrics";
import type { PostureMetricsSummary } from "../posture/postureTypes";

export type ScoredVisualSummary = {
  engagement: CameraEngagementSummary;
  posture: PostureMetricsSummary;
  hands: HandMetricsSummary;
};

const nonNegativeDifference = (end: number, start: number) => Math.max(0, end - start);

const weightedAverageDifference = (
  endAverage: number,
  endCount: number,
  startAverage: number,
  startCount: number,
) => {
  const count = nonNegativeDifference(endCount, startCount);
  if (count === 0) return 0;
  return (endAverage * endCount - startAverage * startCount) / count;
};

const weightedAverage = (
  leftAverage: number,
  leftCount: number,
  rightAverage: number,
  rightCount: number,
) => {
  const count = leftCount + rightCount;
  return count > 0 ? (leftAverage * leftCount + rightAverage * rightCount) / count : 0;
};

export const createEmptyScoredVisualSummary = (): ScoredVisualSummary => ({
  engagement: createEmptyCameraEngagementSummary(),
  posture: createEmptyPostureSummary(),
  hands: createEmptyHandSummary(),
});

export const copyScoredVisualSummary = (summary: ScoredVisualSummary): ScoredVisualSummary => ({
  engagement: { ...summary.engagement },
  posture: { ...summary.posture },
  hands: { ...summary.hands },
});

function subtractEngagement(
  end: CameraEngagementSummary,
  start: CameraEngagementSummary,
): CameraEngagementSummary {
  const measurableFrames = nonNegativeDifference(end.measurableFrames, start.measurableFrames);
  const engagedFrames = nonNegativeDifference(end.engagedFrames, start.engagedFrames);
  const centeredFrames = nonNegativeDifference(end.centeredFrames, start.centeredFrames);

  return {
    measurableFrames,
    engagedFrames,
    centeredFrames,
    measurableDurationMs: nonNegativeDifference(
      end.measurableDurationMs,
      start.measurableDurationMs,
    ),
    engagedDurationMs: nonNegativeDifference(end.engagedDurationMs, start.engagedDurationMs),
    lookingAwayDurationMs: nonNegativeDifference(
      end.lookingAwayDurationMs,
      start.lookingAwayDurationMs,
    ),
    offCenterDurationMs: nonNegativeDifference(end.offCenterDurationMs, start.offCenterDurationMs),
    lookingAwayEventCount: nonNegativeDifference(
      end.lookingAwayEventCount,
      start.lookingAwayEventCount,
    ),
    extendedLookingAwayMs: nonNegativeDifference(
      end.extendedLookingAwayMs,
      start.extendedLookingAwayMs,
    ),
    offCenterEventCount: nonNegativeDifference(end.offCenterEventCount, start.offCenterEventCount),
    excessiveMovementEventCount: nonNegativeDifference(
      end.excessiveMovementEventCount,
      start.excessiveMovementEventCount,
    ),
    cameraEngagementRatio: measurableFrames > 0 ? engagedFrames / measurableFrames : 0,
    centeredPresenceRatio: measurableFrames > 0 ? centeredFrames / measurableFrames : 0,
    averageHeadYaw: weightedAverageDifference(
      end.averageHeadYaw,
      end.measurableFrames,
      start.averageHeadYaw,
      start.measurableFrames,
    ),
    averageHeadPitch: weightedAverageDifference(
      end.averageHeadPitch,
      end.measurableFrames,
      start.averageHeadPitch,
      start.measurableFrames,
    ),
    averageHeadRoll: weightedAverageDifference(
      end.averageHeadRoll,
      end.measurableFrames,
      start.averageHeadRoll,
      start.measurableFrames,
    ),
  };
}

function combineEngagement(
  left: CameraEngagementSummary,
  right: CameraEngagementSummary,
): CameraEngagementSummary {
  const measurableFrames = left.measurableFrames + right.measurableFrames;
  const engagedFrames = left.engagedFrames + right.engagedFrames;
  const centeredFrames = left.centeredFrames + right.centeredFrames;

  return {
    measurableFrames,
    engagedFrames,
    centeredFrames,
    measurableDurationMs: left.measurableDurationMs + right.measurableDurationMs,
    engagedDurationMs: left.engagedDurationMs + right.engagedDurationMs,
    lookingAwayDurationMs: left.lookingAwayDurationMs + right.lookingAwayDurationMs,
    offCenterDurationMs: left.offCenterDurationMs + right.offCenterDurationMs,
    lookingAwayEventCount: left.lookingAwayEventCount + right.lookingAwayEventCount,
    extendedLookingAwayMs: left.extendedLookingAwayMs + right.extendedLookingAwayMs,
    offCenterEventCount: left.offCenterEventCount + right.offCenterEventCount,
    excessiveMovementEventCount:
      left.excessiveMovementEventCount + right.excessiveMovementEventCount,
    cameraEngagementRatio: measurableFrames > 0 ? engagedFrames / measurableFrames : 0,
    centeredPresenceRatio: measurableFrames > 0 ? centeredFrames / measurableFrames : 0,
    averageHeadYaw: weightedAverage(
      left.averageHeadYaw,
      left.measurableFrames,
      right.averageHeadYaw,
      right.measurableFrames,
    ),
    averageHeadPitch: weightedAverage(
      left.averageHeadPitch,
      left.measurableFrames,
      right.averageHeadPitch,
      right.measurableFrames,
    ),
    averageHeadRoll: weightedAverage(
      left.averageHeadRoll,
      left.measurableFrames,
      right.averageHeadRoll,
      right.measurableFrames,
    ),
  };
}

function subtractPosture(
  end: PostureMetricsSummary,
  start: PostureMetricsSummary,
): PostureMetricsSummary {
  const measurableFrames = nonNegativeDifference(end.measurableFrames, start.measurableFrames);
  const measurableDurationMs = nonNegativeDifference(
    end.measurableDurationMs,
    start.measurableDurationMs,
  );
  const durationDifference = (key: keyof PostureMetricsSummary) =>
    nonNegativeDifference(Number(end[key]), Number(start[key]));

  const result: PostureMetricsSummary = {
    measurableFrames,
    measurableDurationMs,
    goodFramingDurationMs: durationDifference("goodFramingDurationMs"),
    centeredPostureDurationMs: durationDifference("centeredPostureDurationMs"),
    levelShoulderDurationMs: durationDifference("levelShoulderDurationMs"),
    stableUpperBodyDurationMs: durationDifference("stableUpperBodyDurationMs"),
    prolongedLeanDurationMs: durationDifference("prolongedLeanDurationMs"),
    prolongedShoulderTiltDurationMs: durationDifference("prolongedShoulderTiltDurationMs"),
    framingIssueDurationMs: durationDifference("framingIssueDurationMs"),
    prolongedLeanEventCount: durationDifference("prolongedLeanEventCount"),
    prolongedShoulderTiltEventCount: durationDifference("prolongedShoulderTiltEventCount"),
    framingIssueEventCount: durationDifference("framingIssueEventCount"),
    excessiveBodyMovementEventCount: durationDifference("excessiveBodyMovementEventCount"),
    postureMeasurableRatio: measurableFrames > 0 ? 1 : 0,
    professionalFramingRatio: 0,
    centeredPostureRatio: 0,
    levelShoulderRatio: 0,
    stableUpperBodyRatio: 0,
    averageShoulderAngleDegrees: weightedAverageDifference(
      end.averageShoulderAngleDegrees,
      end.measurableFrames,
      start.averageShoulderAngleDegrees,
      start.measurableFrames,
    ),
    averageTorsoLeanRatio: weightedAverageDifference(
      end.averageTorsoLeanRatio,
      end.measurableFrames,
      start.averageTorsoLeanRatio,
      start.measurableFrames,
    ),
  };

  if (measurableDurationMs > 0) {
    result.professionalFramingRatio = result.goodFramingDurationMs / measurableDurationMs;
    result.centeredPostureRatio = result.centeredPostureDurationMs / measurableDurationMs;
    result.levelShoulderRatio = result.levelShoulderDurationMs / measurableDurationMs;
    result.stableUpperBodyRatio = result.stableUpperBodyDurationMs / measurableDurationMs;
  }
  return result;
}

function combinePosture(
  left: PostureMetricsSummary,
  right: PostureMetricsSummary,
): PostureMetricsSummary {
  const measurableFrames = left.measurableFrames + right.measurableFrames;
  const measurableDurationMs = left.measurableDurationMs + right.measurableDurationMs;
  const sum = (key: keyof PostureMetricsSummary) => Number(left[key]) + Number(right[key]);
  const result: PostureMetricsSummary = {
    measurableFrames,
    measurableDurationMs,
    goodFramingDurationMs: sum("goodFramingDurationMs"),
    centeredPostureDurationMs: sum("centeredPostureDurationMs"),
    levelShoulderDurationMs: sum("levelShoulderDurationMs"),
    stableUpperBodyDurationMs: sum("stableUpperBodyDurationMs"),
    prolongedLeanDurationMs: sum("prolongedLeanDurationMs"),
    prolongedShoulderTiltDurationMs: sum("prolongedShoulderTiltDurationMs"),
    framingIssueDurationMs: sum("framingIssueDurationMs"),
    prolongedLeanEventCount: sum("prolongedLeanEventCount"),
    prolongedShoulderTiltEventCount: sum("prolongedShoulderTiltEventCount"),
    framingIssueEventCount: sum("framingIssueEventCount"),
    excessiveBodyMovementEventCount: sum("excessiveBodyMovementEventCount"),
    postureMeasurableRatio: measurableFrames > 0 ? 1 : 0,
    professionalFramingRatio: 0,
    centeredPostureRatio: 0,
    levelShoulderRatio: 0,
    stableUpperBodyRatio: 0,
    averageShoulderAngleDegrees: weightedAverage(
      left.averageShoulderAngleDegrees,
      left.measurableFrames,
      right.averageShoulderAngleDegrees,
      right.measurableFrames,
    ),
    averageTorsoLeanRatio: weightedAverage(
      left.averageTorsoLeanRatio,
      left.measurableFrames,
      right.averageTorsoLeanRatio,
      right.measurableFrames,
    ),
  };
  if (measurableDurationMs > 0) {
    result.professionalFramingRatio = result.goodFramingDurationMs / measurableDurationMs;
    result.centeredPostureRatio = result.centeredPostureDurationMs / measurableDurationMs;
    result.levelShoulderRatio = result.levelShoulderDurationMs / measurableDurationMs;
    result.stableUpperBodyRatio = result.stableUpperBodyDurationMs / measurableDurationMs;
  }
  return result;
}

function subtractHands(end: HandMetricsSummary, start: HandMetricsSummary): HandMetricsSummary {
  const difference = (key: keyof HandMetricsSummary) =>
    nonNegativeDifference(Number(end[key]), Number(start[key]));
  const measurableDurationMs = difference("measurableDurationMs");
  const result: HandMetricsSummary = {
    measurableDurationMs,
    noHandsDurationMs: difference("noHandsDurationMs"),
    oneHandDurationMs: difference("oneHandDurationMs"),
    twoHandsDurationMs: difference("twoHandsDurationMs"),
    naturalGestureDurationMs: difference("naturalGestureDurationMs"),
    activeGestureDurationMs: difference("activeGestureDurationMs"),
    excessiveGestureDurationMs: difference("excessiveGestureDurationMs"),
    clearFaceDurationMs: difference("clearFaceDurationMs"),
    handsNearFaceDurationMs: difference("handsNearFaceDurationMs"),
    faceObstructionDurationMs: difference("faceObstructionDurationMs"),
    cameraObstructionDurationMs: difference("cameraObstructionDurationMs"),
    extendedHandsNearFaceEventCount: difference("extendedHandsNearFaceEventCount"),
    faceObstructionEventCount: difference("faceObstructionEventCount"),
    cameraObstructionEventCount: difference("cameraObstructionEventCount"),
    excessiveHandMovementEventCount: difference("excessiveHandMovementEventCount"),
    naturalGestureRatio: 0,
    excessiveGestureRatio: 0,
    clearFaceFromHandsRatio: 0,
  };
  if (measurableDurationMs > 0) {
    result.naturalGestureRatio = result.naturalGestureDurationMs / measurableDurationMs;
    result.excessiveGestureRatio = result.excessiveGestureDurationMs / measurableDurationMs;
    result.clearFaceFromHandsRatio = result.clearFaceDurationMs / measurableDurationMs;
  }
  return result;
}

function combineHands(left: HandMetricsSummary, right: HandMetricsSummary): HandMetricsSummary {
  const sum = (key: keyof HandMetricsSummary) => Number(left[key]) + Number(right[key]);
  const measurableDurationMs = left.measurableDurationMs + right.measurableDurationMs;
  const result: HandMetricsSummary = {
    measurableDurationMs,
    noHandsDurationMs: sum("noHandsDurationMs"),
    oneHandDurationMs: sum("oneHandDurationMs"),
    twoHandsDurationMs: sum("twoHandsDurationMs"),
    naturalGestureDurationMs: sum("naturalGestureDurationMs"),
    activeGestureDurationMs: sum("activeGestureDurationMs"),
    excessiveGestureDurationMs: sum("excessiveGestureDurationMs"),
    clearFaceDurationMs: sum("clearFaceDurationMs"),
    handsNearFaceDurationMs: sum("handsNearFaceDurationMs"),
    faceObstructionDurationMs: sum("faceObstructionDurationMs"),
    cameraObstructionDurationMs: sum("cameraObstructionDurationMs"),
    extendedHandsNearFaceEventCount: sum("extendedHandsNearFaceEventCount"),
    faceObstructionEventCount: sum("faceObstructionEventCount"),
    cameraObstructionEventCount: sum("cameraObstructionEventCount"),
    excessiveHandMovementEventCount: sum("excessiveHandMovementEventCount"),
    naturalGestureRatio: 0,
    excessiveGestureRatio: 0,
    clearFaceFromHandsRatio: 0,
  };
  if (measurableDurationMs > 0) {
    result.naturalGestureRatio = result.naturalGestureDurationMs / measurableDurationMs;
    result.excessiveGestureRatio = result.excessiveGestureDurationMs / measurableDurationMs;
    result.clearFaceFromHandsRatio = result.clearFaceDurationMs / measurableDurationMs;
  }
  return result;
}

export function subtractScoredVisualSummary(
  end: ScoredVisualSummary,
  start: ScoredVisualSummary,
): ScoredVisualSummary {
  return {
    engagement: subtractEngagement(end.engagement, start.engagement),
    posture: subtractPosture(end.posture, start.posture),
    hands: subtractHands(end.hands, start.hands),
  };
}

export function combineScoredVisualSummaries(
  left: ScoredVisualSummary,
  right: ScoredVisualSummary,
): ScoredVisualSummary {
  return {
    engagement: combineEngagement(left.engagement, right.engagement),
    posture: combinePosture(left.posture, right.posture),
    hands: combineHands(left.hands, right.hands),
  };
}
