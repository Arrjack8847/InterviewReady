import { SPEECH_DELIVERY_THRESHOLDS as T } from "./audioThresholds";
import type { BackgroundNoiseState, MicrophoneLevelState, PauseDurationState } from "./audioTypes";

export function calculateRms(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

export function calculatePeak(samples: Float32Array) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

export function toRelativeDecibels(rms: number) {
  return 20 * Math.log10(Math.max(rms, Number.EPSILON));
}

export function estimateNoiseFloor(samples: number[]) {
  if (!samples.length) return T.fallbackNoiseFloor;
  const sorted = [...samples].filter(Number.isFinite).sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.25)] ?? T.fallbackNoiseFloor;
}

export function classifyMicrophoneLevel(rms: number, peak: number): MicrophoneLevelState {
  if (peak >= T.clippingPeakThreshold) return "clipping";
  if (rms < T.fallbackNoiseFloor) return "silent";
  if (rms < T.lowLevelRms) return "low";
  if (rms > T.highLevelRms) return "high";
  return "good";
}

export function classifyBackgroundNoise(noiseFloor: number): BackgroundNoiseState {
  if (noiseFloor >= T.noisyRms) return "noisy";
  if (noiseFloor >= T.moderateNoiseRms) return "moderate";
  return "quiet";
}

export function classifyPauseDuration(durationMs: number): PauseDurationState {
  if (durationMs >= T.extendedSilenceMs) return "extended";
  if (durationMs >= T.longPauseMs) return "long";
  if (durationMs >= T.normalPauseMs) return "noticeable";
  return "normal";
}

export function isSilenceLikely(rms: number, noiseFloor = T.fallbackNoiseFloor) {
  if (!Number.isFinite(rms)) return false;
  return rms <= Math.max(noiseFloor * T.speechExitNoiseMultiplier, T.fallbackNoiseFloor);
}

export function isClippingLikely(peaks: readonly number[]) {
  let repeatedClippedFrames = 0;
  for (const peak of peaks) {
    repeatedClippedFrames = peak >= T.clippingPeakThreshold ? repeatedClippedFrames + 1 : 0;
    if (repeatedClippedFrames >= T.clippingFramesPerEvent) return true;
  }
  return false;
}

export function calculateVariability(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}
