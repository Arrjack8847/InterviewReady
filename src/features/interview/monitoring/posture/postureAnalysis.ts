import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { POSTURE_THRESHOLDS as T } from "./postureThresholds";
import type { FramingState, PostureFrameAnalysis } from "./postureTypes";

const NOSE = 0;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

function confident(point: NormalizedLandmark | undefined) {
  return Boolean(point && (point.visibility ?? 1) >= T.minimumLandmarkVisibility);
}

const unavailable = (timestamp: number): PostureFrameAnalysis => ({
  measurable: false,
  timestamp,
  shoulderAlignment: "unknown",
  shoulderAngleDegrees: null,
  torsoLean: "unknown",
  torsoLeanRatio: null,
  framing: "not_measurable",
  shoulderMidpointX: null,
  shoulderMidpointY: null,
  bodyWidthRatio: null,
  upperBodyHeightRatio: null,
  stable: false,
});

export function analyzePostureFrame(
  landmarks: NormalizedLandmark[] | null,
  timestamp: number,
): PostureFrameAnalysis {
  // Approximate coaching only: never infer health, disability, emotion, confidence, or employability.
  if (!landmarks) return unavailable(timestamp);
  const nose = landmarks[NOSE];
  const leftEar = landmarks[LEFT_EAR];
  const rightEar = landmarks[RIGHT_EAR];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  const leftHip = landmarks[LEFT_HIP];
  const rightHip = landmarks[RIGHT_HIP];
  if (![nose, leftEar, rightEar, leftShoulder, rightShoulder, leftHip, rightHip].every(confident)) {
    return unavailable(timestamp);
  }
  if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip)
    return unavailable(timestamp);
  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  if (shoulderWidth < 0.01) return unavailable(timestamp);
  const shoulderMidpointX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderMidpointY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipMidpointX = (leftHip.x + rightHip.x) / 2;
  const hipMidpointY = (leftHip.y + rightHip.y) / 2;
  const shoulderAngleDegrees =
    (Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x) * 180) /
    Math.PI;
  const torsoLeanRatio = (shoulderMidpointX - hipMidpointX) / shoulderWidth;
  let framing: FramingState = "good";
  if (shoulderWidth > T.tooCloseShoulderWidth) framing = "too_close";
  else if (shoulderWidth < T.tooFarShoulderWidth) framing = "too_far";
  else if (nose.y < T.tooHighNoseY) framing = "too_high";
  else if (nose.y > T.tooLowNoseY) framing = "too_low";
  else if (Math.abs(shoulderMidpointX - 0.5) > T.shoulderCenterOffset) framing = "off_center";
  return {
    measurable: true,
    timestamp,
    shoulderAlignment:
      shoulderAngleDegrees < -T.levelShoulderDegrees
        ? "right_high"
        : shoulderAngleDegrees > T.levelShoulderDegrees
          ? "left_high"
          : "level",
    shoulderAngleDegrees,
    torsoLean:
      torsoLeanRatio < -T.torsoLeanRatio
        ? "left"
        : torsoLeanRatio > T.torsoLeanRatio
          ? "right"
          : "center",
    torsoLeanRatio,
    framing,
    shoulderMidpointX,
    shoulderMidpointY,
    bodyWidthRatio: shoulderWidth,
    upperBodyHeightRatio: Math.abs(hipMidpointY - nose.y),
    stable: true,
  };
}
