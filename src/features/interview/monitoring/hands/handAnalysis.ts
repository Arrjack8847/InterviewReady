import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { NormalizedFaceBounds } from "../face/faceAnalysis";
import { HAND_THRESHOLDS as T } from "./handThresholds";
import type { DetectedHand, FaceObstructionState, HandFrameAnalysis } from "./handTypes";

export function calculateHandBounds(landmarks: NormalizedLandmark[]) {
  if (!landmarks.length) return null;
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function overlapRatio(
  hand: { x: number; y: number; width: number; height: number },
  face: NormalizedFaceBounds,
) {
  const x = Math.max(hand.x, face.x);
  const y = Math.max(hand.y, face.y);
  const width = Math.max(0, Math.min(hand.x + hand.width, face.x + face.width) - x);
  const height = Math.max(0, Math.min(hand.y + hand.height, face.y + face.height) - y);
  return face.width * face.height > 0 ? (width * height) / (face.width * face.height) : 0;
}

export function analyzeHandFrame(
  hands: NormalizedLandmark[][],
  faceBounds: NormalizedFaceBounds | null,
  timestamp: number,
): HandFrameAnalysis {
  // Hands are optional. This is presentation coaching, never identity, emotion, disability, or cheating analysis.
  if (!faceBounds)
    return {
      measurable: false,
      timestamp,
      handCount: 0,
      visibility: "unknown",
      hands: [],
      gestureActivity: "not_measurable",
      leftHandNearFace: false,
      rightHandNearFace: false,
      faceObstruction: "not_measurable",
      cameraObstructionRatio: null,
      significantMovement: false,
    };
  const expanded = {
    x: faceBounds.x - faceBounds.width * T.faceMarginRatio,
    y: faceBounds.y - faceBounds.height * T.faceMarginRatio,
    width: faceBounds.width * (1 + T.faceMarginRatio * 2),
    height: faceBounds.height * (1 + T.faceMarginRatio * 2),
  };
  const detected: DetectedHand[] = hands.map((landmarks) => {
    const bounds = calculateHandBounds(landmarks) || { x: 0, y: 0, width: 0, height: 0 };
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    return {
      side: "unknown",
      confidence: 1,
      centerX,
      centerY,
      widthRatio: bounds.width,
      heightRatio: bounds.height,
      areaRatio: bounds.width * bounds.height,
      faceOverlapRatio: overlapRatio(bounds, faceBounds),
    };
  });
  const maxOverlap = Math.max(0, ...detected.map((hand) => hand.faceOverlapRatio));
  const obstruction: FaceObstructionState =
    maxOverlap >= T.significantFaceOverlap
      ? "significantly_obstructed"
      : maxOverlap >= T.partialFaceOverlap
        ? "partially_obstructed"
        : "clear";
  const near = detected.map(
    (hand) =>
      hand.centerX >= expanded.x &&
      hand.centerX <= expanded.x + expanded.width &&
      hand.centerY >= expanded.y &&
      hand.centerY <= expanded.y + expanded.height,
  );
  return {
    measurable: true,
    timestamp,
    handCount: detected.length,
    visibility: detected.length === 0 ? "none" : detected.length === 1 ? "one_hand" : "two_hands",
    hands: detected,
    gestureActivity: detected.length ? "natural" : "still",
    leftHandNearFace: near[0] || false,
    rightHandNearFace: near[1] || false,
    faceObstruction: obstruction,
    cameraObstructionRatio: Math.max(0, ...detected.map((hand) => hand.areaRatio)),
    significantMovement: false,
  };
}
