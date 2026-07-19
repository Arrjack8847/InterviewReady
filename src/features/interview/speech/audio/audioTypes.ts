export type MicrophoneLevelState = "silent" | "low" | "good" | "high" | "clipping" | "unavailable";
export type BackgroundNoiseState = "quiet" | "moderate" | "noisy" | "unavailable";
export type SpeakingPaceState = "slow" | "balanced" | "fast" | "not_measurable";
export type AnswerFlowState = "continuous" | "some_pauses" | "frequent_pauses" | "not_measurable";
export type PauseDurationState = "normal" | "noticeable" | "long" | "extended";

export interface AudioFrameAnalysis {
  timestamp: number;
  measurable: boolean;
  rms: number | null;
  peak: number | null;
  decibels: number | null;
  microphoneLevel: MicrophoneLevelState;
  speechLikely: boolean;
  clippingLikely: boolean;
  backgroundNoiseState: BackgroundNoiseState;
}

export interface SpeechDeliverySnapshot {
  microphoneLevel: MicrophoneLevelState;
  backgroundNoiseState: BackgroundNoiseState;
  speechLikely: boolean;
  silenceDurationMs: number;
  activeSpeechMs: number;
  guidance: string;
  rms: number;
  peak: number;
  noiseFloor: number;
}

export interface AudioDeliveryMetrics {
  activeSpeechMs: number;
  totalSilenceMs: number;
  longestPauseMs: number;
  longPauseCount: number;
  extendedSilenceCount: number;
  averageSpeechLevel: number;
  speechLevelVariability: number;
  lowVolumeMs: number;
  highVolumeMs: number;
  clippingEventCount: number;
  backgroundNoiseState: BackgroundNoiseState;
  highNoiseMs: number;
  possibleOverlappingSpeechEventCount: number;
}
