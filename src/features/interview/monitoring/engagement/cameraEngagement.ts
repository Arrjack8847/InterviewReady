import { ENGAGEMENT_THRESHOLDS as T } from "../face/faceThresholds";
import type {
  CameraEngagementFrame,
  CameraEngagementGuidance,
  CameraEngagementSummary,
  HeadPoseEstimate,
} from "../face/faceTypes";

export function createEmptyCameraEngagementSummary(): CameraEngagementSummary {
  return {
    measurableFrames: 0,
    engagedFrames: 0,
    centeredFrames: 0,
    measurableDurationMs: 0,
    engagedDurationMs: 0,
    lookingAwayDurationMs: 0,
    offCenterDurationMs: 0,
    lookingAwayEventCount: 0,
    extendedLookingAwayMs: 0,
    offCenterEventCount: 0,
    excessiveMovementEventCount: 0,
    cameraEngagementRatio: 0,
    centeredPresenceRatio: 0,
    averageHeadYaw: 0,
    averageHeadPitch: 0,
    averageHeadRoll: 0,
  };
}

export function createCameraEngagementController() {
  let summary = createEmptyCameraEngagementSummary();
  let lastFrame: CameraEngagementFrame | null = null;
  let awayStartedAt: number | null = null;
  let offCenterStartedAt: number | null = null;
  let awayEventRecorded = false;
  let offCenterEventRecorded = false;
  let smoothedPose: HeadPoseEstimate | null = null;
  let poseTotals = { yaw: 0, pitch: 0, roll: 0 };
  const directionChanges: Array<{ timestamp: number; direction: string }> = [];
  let movementWindowRecorded = false;

  const ratios = () => ({
    ...summary,
    cameraEngagementRatio:
      summary.measurableFrames > 0 ? summary.engagedFrames / summary.measurableFrames : 0,
    centeredPresenceRatio:
      summary.measurableFrames > 0 ? summary.centeredFrames / summary.measurableFrames : 0,
    averageHeadYaw: summary.measurableFrames > 0 ? poseTotals.yaw / summary.measurableFrames : 0,
    averageHeadPitch:
      summary.measurableFrames > 0 ? poseTotals.pitch / summary.measurableFrames : 0,
    averageHeadRoll: summary.measurableFrames > 0 ? poseTotals.roll / summary.measurableFrames : 0,
  });

  function resetTracking() {
    lastFrame = null;
    awayStartedAt = null;
    offCenterStartedAt = null;
    awayEventRecorded = false;
    offCenterEventRecorded = false;
    smoothedPose = null;
    directionChanges.length = 0;
    movementWindowRecorded = false;
  }

  function reset() {
    summary = createEmptyCameraEngagementSummary();
    poseTotals = { yaw: 0, pitch: 0, roll: 0 };
    resetTracking();
  }

  function process(frame: CameraEngagementFrame, record: boolean) {
    if (!record || !frame.measurable) {
      resetTracking();
      return;
    }
    const elapsed = lastFrame
      ? Math.max(0, Math.min(frame.timestamp - lastFrame.timestamp, 1_000))
      : 0;
    summary.measurableFrames += 1;
    summary.measurableDurationMs += elapsed;
    if (frame.engaged) {
      summary.engagedFrames += 1;
      summary.engagedDurationMs += elapsed;
      awayStartedAt = null;
      awayEventRecorded = false;
    } else {
      awayStartedAt ??= frame.timestamp;
      summary.lookingAwayDurationMs += elapsed;
      const awayDuration = frame.timestamp - awayStartedAt;
      if (awayDuration >= T.extendedLookAwayMs) {
        summary.extendedLookingAwayMs += elapsed;
        if (!awayEventRecorded) {
          summary.lookingAwayEventCount += 1;
          awayEventRecorded = true;
        }
      }
    }
    if (frame.centered) {
      summary.centeredFrames += 1;
      offCenterStartedAt = null;
      offCenterEventRecorded = false;
    } else {
      offCenterStartedAt ??= frame.timestamp;
      summary.offCenterDurationMs += elapsed;
      if (frame.timestamp - offCenterStartedAt >= T.offCenterEventMs && !offCenterEventRecorded) {
        summary.offCenterEventCount += 1;
        offCenterEventRecorded = true;
      }
    }
    const pose = frame.headPose;
    if (pose.yaw !== null && pose.pitch !== null && pose.roll !== null) {
      poseTotals.yaw += pose.yaw;
      poseTotals.pitch += pose.pitch;
      poseTotals.roll += pose.roll;
      const direction = `${pose.horizontalDirection}:${pose.verticalDirection}`;
      const prior = directionChanges.at(-1);
      if (!prior || prior.direction !== direction)
        directionChanges.push({ timestamp: frame.timestamp, direction });
      while (
        directionChanges[0] &&
        frame.timestamp - directionChanges[0].timestamp > T.movementWindowMs
      ) {
        directionChanges.shift();
      }
      if (directionChanges.length > T.excessiveDirectionChanges && !movementWindowRecorded) {
        summary.excessiveMovementEventCount += 1;
        movementWindowRecorded = true;
      } else if (directionChanges.length <= Math.floor(T.excessiveDirectionChanges / 2)) {
        movementWindowRecorded = false;
      }
      smoothedPose = pose;
    }
    lastFrame = frame;
    summary = ratios();
  }

  function getGuidance(frame: CameraEngagementFrame | null): CameraEngagementGuidance {
    if (!frame?.measurable) {
      return {
        engagementState: "not_measurable",
        engagementLabel: "Waiting for a clear face",
        headPositionLabel: "Not measurable",
        movementLabel: "Normal",
        activeDurationMs: 0,
      };
    }
    const awayMs = awayStartedAt === null ? 0 : frame.timestamp - awayStartedAt;
    const offCenterMs = offCenterStartedAt === null ? 0 : frame.timestamp - offCenterStartedAt;
    const engagementState = frame.engaged
      ? "engaged"
      : awayMs >= T.visibleLookAwayMs
        ? "looking_away"
        : awayMs >= T.briefLookAwayMs
          ? "briefly_away"
          : "engaged";
    let headPositionLabel = "Centered";
    if (
      offCenterMs >= T.offCenterGuidanceMs &&
      frame.faceCenterX !== null &&
      frame.faceCenterY !== null
    ) {
      headPositionLabel =
        frame.faceCenterX < 0.5 - 0.16
          ? "Move slightly right"
          : frame.faceCenterX > 0.5 + 0.16
            ? "Move slightly left"
            : frame.faceCenterY < 0.5 - 0.18
              ? "Lower camera slightly"
              : "Raise camera slightly";
    }
    return {
      engagementState,
      engagementLabel:
        engagementState === "engaged"
          ? "Engaged"
          : engagementState === "briefly_away"
            ? "Briefly looking away"
            : "Look toward the camera",
      headPositionLabel,
      movementLabel:
        directionChanges.length > T.excessiveDirectionChanges
          ? "Hold a steadier position"
          : "Natural movement",
      activeDurationMs: Math.max(awayMs, offCenterMs),
    };
  }

  return {
    process,
    getSummary: () => ratios(),
    getGuidance,
    reset,
    resetTracking,
    getSmoothedPose: () => smoothedPose,
  };
}
