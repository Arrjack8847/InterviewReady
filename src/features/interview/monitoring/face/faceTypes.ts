export type HorizontalHeadDirection = "left" | "center" | "right" | "unknown";
export type VerticalHeadDirection = "up" | "center" | "down" | "unknown";
export type HeadTiltDirection = "left" | "center" | "right" | "unknown";
export type CameraEngagementState = "engaged" | "briefly_away" | "looking_away" | "not_measurable";

export interface HeadPoseEstimate {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  horizontalDirection: HorizontalHeadDirection;
  verticalDirection: VerticalHeadDirection;
  tiltDirection: HeadTiltDirection;
}

export interface CameraEngagementFrame {
  measurable: boolean;
  engaged: boolean;
  centered: boolean;
  headPose: HeadPoseEstimate;
  faceCenterX: number | null;
  faceCenterY: number | null;
  timestamp: number;
}

export interface CameraEngagementSummary {
  measurableFrames: number;
  engagedFrames: number;
  centeredFrames: number;
  measurableDurationMs: number;
  engagedDurationMs: number;
  lookingAwayDurationMs: number;
  offCenterDurationMs: number;
  lookingAwayEventCount: number;
  extendedLookingAwayMs: number;
  offCenterEventCount: number;
  excessiveMovementEventCount: number;
  cameraEngagementRatio: number;
  centeredPresenceRatio: number;
  averageHeadYaw: number;
  averageHeadPitch: number;
  averageHeadRoll: number;
}

export interface CameraEngagementGuidance {
  engagementState: CameraEngagementState;
  engagementLabel: string;
  headPositionLabel: string;
  movementLabel: string;
  activeDurationMs: number;
}
