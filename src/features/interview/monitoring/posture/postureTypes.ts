export type ShoulderAlignment = "level" | "left_high" | "right_high" | "unknown";
export type TorsoLeanDirection = "center" | "left" | "right" | "unknown";
export type FramingState =
  | "good"
  | "too_close"
  | "too_far"
  | "too_high"
  | "too_low"
  | "off_center"
  | "not_measurable";
export type PostureGuidanceState =
  | "good"
  | "minor_adjustment"
  | "needs_adjustment"
  | "not_measurable";

export interface PostureFrameAnalysis {
  measurable: boolean;
  timestamp: number;
  shoulderAlignment: ShoulderAlignment;
  shoulderAngleDegrees: number | null;
  torsoLean: TorsoLeanDirection;
  torsoLeanRatio: number | null;
  framing: FramingState;
  shoulderMidpointX: number | null;
  shoulderMidpointY: number | null;
  bodyWidthRatio: number | null;
  upperBodyHeightRatio: number | null;
  stable: boolean;
}

export interface PostureMetricsSummary {
  measurableFrames: number;
  measurableDurationMs: number;
  goodFramingDurationMs: number;
  centeredPostureDurationMs: number;
  levelShoulderDurationMs: number;
  stableUpperBodyDurationMs: number;
  prolongedLeanDurationMs: number;
  prolongedShoulderTiltDurationMs: number;
  framingIssueDurationMs: number;
  prolongedLeanEventCount: number;
  prolongedShoulderTiltEventCount: number;
  framingIssueEventCount: number;
  excessiveBodyMovementEventCount: number;
  postureMeasurableRatio: number;
  professionalFramingRatio: number;
  centeredPostureRatio: number;
  levelShoulderRatio: number;
  stableUpperBodyRatio: number;
  averageShoulderAngleDegrees: number;
  averageTorsoLeanRatio: number;
}

export interface PostureGuidance {
  state: PostureGuidanceState;
  postureLabel: string;
  framingLabel: string;
  activeDurationMs: number;
}
