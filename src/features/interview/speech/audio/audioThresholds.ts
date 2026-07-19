export const SPEECH_DELIVERY_THRESHOLDS = {
  /**
   * A natural thinking gap. This is currently reserved for future
   * pause classification and does not increment longPauseCount.
   */
  normalPauseMs: 1_500,

  /**
   * A silence interval is counted as one long pause when:
   * 1. speech has already been detected,
   * 2. silence lasts at least this long, and
   * 3. the candidate resumes speaking.
   */
  longPauseMs: 3_000,

  /**
   * A more significant silence interval used for live guidance and
   * extendedSilenceCount.
   */
  extendedSilenceMs: 6_000,

  /**
   * Speaking pace thresholds.
   */
  lowPaceWpm: 90,
  highPaceWpm: 170,

  /**
   * Minimum sample requirements before pace is treated as measurable.
   */
  minimumWordsForPace: 20,
  minimumActiveSpeechMsForPace: 15_000,

  /**
   * Audio clipping detection.
   */
  clippingPeakThreshold: 0.98,
  clippingFramesPerEvent: 3,
  clippingEventWindowMs: 1_000,

  /**
   * Microphone level classification.
   */
  lowLevelRms: 0.012,
  highLevelRms: 0.28,

  /**
   * Voice activity detection relative to the calibrated noise floor.
   *
   * A higher entry multiplier reduces false speech detection.
   * A lower exit multiplier prevents speech state from flickering.
   */
  speechEnterNoiseMultiplier: 2.8,
  speechExitNoiseMultiplier: 1.8,

  /**
   * Fallback noise floor used before or when calibration is unavailable.
   */
  fallbackNoiseFloor: 0.008,

  /**
   * Initial noise-floor calibration period.
   */
  noiseCalibrationMs: 2_000,

  /**
   * Background-noise classification.
   */
  moderateNoiseRms: 0.025,
  noisyRms: 0.06,

  /**
   * Audio analysis timing.
   */
  sampleIntervalMs: 100,
  liveGuidancePublishIntervalMs: 500,

  /**
   * Web Audio analyser configuration.
   */
  analyserFftSize: 2048,
  analyserSmoothing: 0.75,
} as const;

export type SpeechDeliveryThresholds =
  typeof SPEECH_DELIVERY_THRESHOLDS;