export type HandSide = "left" | "right" | "unknown";
export type HandVisibilityState = "none" | "one_hand" | "two_hands" | "unknown";
export type GestureActivityState = "still" | "natural" | "active" | "excessive" | "not_measurable";
export type FaceObstructionState =
  | "clear"
  | "partially_obstructed"
  | "significantly_obstructed"
  | "not_measurable";

export interface DetectedHand {
  side: HandSide;
  confidence: number;
  centerX: number;
  centerY: number;
  widthRatio: number;
  heightRatio: number;
  areaRatio: number;
  faceOverlapRatio: number;
}

export interface HandFrameAnalysis {
  measurable: boolean;
  timestamp: number;
  handCount: number;
  visibility: HandVisibilityState;
  hands: DetectedHand[];
  gestureActivity: GestureActivityState;
  leftHandNearFace: boolean;
  rightHandNearFace: boolean;
  faceObstruction: FaceObstructionState;
  cameraObstructionRatio: number | null;
  significantMovement: boolean;
}

export interface HandMetricsSummary {
  measurableDurationMs: number;
  noHandsDurationMs: number;
  oneHandDurationMs: number;
  twoHandsDurationMs: number;
  naturalGestureDurationMs: number;
  activeGestureDurationMs: number;
  excessiveGestureDurationMs: number;
  clearFaceDurationMs: number;
  handsNearFaceDurationMs: number;
  faceObstructionDurationMs: number;
  cameraObstructionDurationMs: number;
  extendedHandsNearFaceEventCount: number;
  faceObstructionEventCount: number;
  cameraObstructionEventCount: number;
  excessiveHandMovementEventCount: number;
  naturalGestureRatio: number;
  excessiveGestureRatio: number;
  clearFaceFromHandsRatio: number;
}

export interface HandGuidance {
  label: string;
  activity: GestureActivityState;
  activeDurationMs: number;
}
