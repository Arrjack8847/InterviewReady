import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { FACE_ANALYSIS_THRESHOLDS as T } from "./faceThresholds";
import type { CameraEngagementFrame, HeadPoseEstimate } from "./faceTypes";

// MediaPipe Face Mesh: nose tip, outer eye corners, upper forehead, chin, and side cheeks.
const NOSE_TIP = 1;
const LEFT_EYE_OUTER = 263;
const RIGHT_EYE_OUTER = 33;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_CHEEK = 454;
const RIGHT_CHEEK = 234;

export interface NormalizedFaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateFaceBounds(
  landmarks: NormalizedLandmark[] | null,
): NormalizedFaceBounds | null {
  if (!landmarks?.length) return null;
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

const unknownPose = (): HeadPoseEstimate => ({
  yaw: null,
  pitch: null,
  roll: null,
  horizontalDirection: "unknown",
  verticalDirection: "unknown",
  tiltDirection: "unknown",
});

function classifyPose(yaw: number, pitch: number, roll: number): HeadPoseEstimate {
  return {
    yaw,
    pitch,
    roll,
    horizontalDirection: yaw < -T.yawDegrees ? "left" : yaw > T.yawDegrees ? "right" : "center",
    verticalDirection: pitch < -T.pitchDegrees ? "up" : pitch > T.pitchDegrees ? "down" : "center",
    tiltDirection: roll < -T.rollDegrees ? "left" : roll > T.rollDegrees ? "right" : "center",
  };
}

export function estimateCameraEngagementFrame(
  landmarks: NormalizedLandmark[] | null,
  timestamp: number,
): CameraEngagementFrame {
  // This is an approximate presentation-coaching signal, not gaze, emotion, identity,
  // attention, or cheating detection. Natural and accessibility-related movement is valid.
  if (!landmarks) {
    return {
      measurable: false,
      engaged: false,
      centered: false,
      headPose: unknownPose(),
      faceCenterX: null,
      faceCenterY: null,
      timestamp,
    };
  }

  const nose = landmarks[NOSE_TIP];
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
  const forehead = landmarks[FOREHEAD];
  const chin = landmarks[CHIN];
  const leftCheek = landmarks[LEFT_CHEEK];
  const rightCheek = landmarks[RIGHT_CHEEK];
  if (!nose || !leftEye || !rightEye || !forehead || !chin || !leftCheek || !rightCheek) {
    return estimateCameraEngagementFrame(null, timestamp);
  }

  const faceWidth = Math.abs(leftCheek.x - rightCheek.x);
  const faceHeight = Math.abs(chin.y - forehead.y);
  const eyeSpan = Math.abs(leftEye.x - rightEye.x);
  if (faceWidth < 0.001 || faceHeight < 0.001 || eyeSpan < 0.001) {
    return estimateCameraEngagementFrame(null, timestamp);
  }

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const noseVerticalRatio = (nose.y - forehead.y) / faceHeight;
  const yaw = ((nose.x - eyeMidX) / eyeSpan) * 45;
  const pitch = (noseVerticalRatio - 0.56) * 80;
  const roll = (Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x) * 180) / Math.PI;
  const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
  const faceCenterY = (forehead.y + chin.y) / 2;
  const sizeIsMeasurable =
    faceWidth >= T.minimumFaceWidth &&
    faceWidth <= T.maximumFaceWidth &&
    faceHeight >= T.minimumFaceHeight &&
    faceHeight <= T.maximumFaceHeight;
  const centered =
    Math.abs(faceCenterX - 0.5) <= T.centerOffsetX &&
    Math.abs(faceCenterY - 0.5) <= T.centerOffsetY;
  const headPose = classifyPose(yaw, pitch, roll);
  const engaged =
    sizeIsMeasurable &&
    headPose.horizontalDirection === "center" &&
    headPose.verticalDirection === "center";

  return {
    measurable: sizeIsMeasurable,
    engaged,
    centered: sizeIsMeasurable && centered,
    headPose,
    faceCenterX,
    faceCenterY,
    timestamp,
  };
}

export function smoothHeadPose(
  previous: HeadPoseEstimate | null,
  current: HeadPoseEstimate,
  factor = T.smoothingFactor,
): HeadPoseEstimate {
  if (current.yaw === null || current.pitch === null || current.roll === null) return unknownPose();
  if (previous?.yaw === null || previous?.pitch === null || previous?.roll === null || !previous) {
    return classifyPose(current.yaw, current.pitch, current.roll);
  }
  const ema = (before: number, next: number) => factor * next + (1 - factor) * before;
  return classifyPose(
    ema(previous.yaw, current.yaw),
    ema(previous.pitch, current.pitch),
    ema(previous.roll, current.roll),
  );
}
