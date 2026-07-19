import {
  classifyBackgroundNoise,
  classifyMicrophoneLevel,
  estimateNoiseFloor,
} from "./audioAnalysis";
import { SPEECH_DELIVERY_THRESHOLDS as T } from "./audioThresholds";
import type {
  AudioDeliveryMetrics,
  SpeechDeliverySnapshot,
} from "./audioTypes";

const MAX_FRAME_ELAPSED_MS = 500;
const MAX_NOISE_SAMPLES = 40;

function createEmptyMetrics(): AudioDeliveryMetrics {
  return {
    activeSpeechMs: 0,
    totalSilenceMs: 0,
    longestPauseMs: 0,
    longPauseCount: 0,
    extendedSilenceCount: 0,
    averageSpeechLevel: 0,
    speechLevelVariability: 0,
    lowVolumeMs: 0,
    highVolumeMs: 0,
    clippingEventCount: 0,
    backgroundNoiseState: "quiet",
    highNoiseMs: 0,
    possibleOverlappingSpeechEventCount: 0,
  };
}

const NOISE_PRIORITY = {
  unavailable: 0,
  quiet: 1,
  moderate: 2,
  noisy: 3,
} as const;

function normalizeSignalValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function normalizeTimestamp(value: number): number {
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return performance.now();
}

function combineBackgroundNoise(
  completed: AudioDeliveryMetrics,
  current: AudioDeliveryMetrics,
): AudioDeliveryMetrics["backgroundNoiseState"] {
  const completedWeight = Math.max(
    0,
    completed.totalSilenceMs,
  );

  const currentWeight = Math.max(
    0,
    current.totalSilenceMs,
  );

  const totalWeight =
    completedWeight + currentWeight;

  if (totalWeight <= 0) {
    return NOISE_PRIORITY[
      current.backgroundNoiseState
    ] >
      NOISE_PRIORITY[
        completed.backgroundNoiseState
      ]
      ? current.backgroundNoiseState
      : completed.backgroundNoiseState;
  }

  const weightedNoise =
    (NOISE_PRIORITY[
      completed.backgroundNoiseState
    ] *
      completedWeight +
      NOISE_PRIORITY[
        current.backgroundNoiseState
      ] *
        currentWeight) /
    totalWeight;

  if (weightedNoise >= 2.5) {
    return "noisy";
  }

  if (weightedNoise >= 1.5) {
    return "moderate";
  }

  return "quiet";
}

function combineSpeechLevelStatistics(
  completed: AudioDeliveryMetrics,
  current: AudioDeliveryMetrics,
): {
  averageSpeechLevel: number;
  speechLevelVariability: number;
} {
  const completedWeight = Math.max(
    0,
    completed.activeSpeechMs,
  );

  const currentWeight = Math.max(
    0,
    current.activeSpeechMs,
  );

  const totalWeight =
    completedWeight + currentWeight;

  if (totalWeight <= 0) {
    return {
      averageSpeechLevel: 0,
      speechLevelVariability: 0,
    };
  }

  const combinedMean =
    (completed.averageSpeechLevel *
      completedWeight +
      current.averageSpeechLevel *
        currentWeight) /
    totalWeight;

  const completedVariance =
    completed.speechLevelVariability ** 2;

  const currentVariance =
    current.speechLevelVariability ** 2;

  const combinedVariance =
    (completedWeight *
      (completedVariance +
        (completed.averageSpeechLevel -
          combinedMean) **
          2) +
      currentWeight *
        (currentVariance +
          (current.averageSpeechLevel -
            combinedMean) **
            2)) /
    totalWeight;

  return {
    averageSpeechLevel: Math.max(
      0,
      combinedMean,
    ),

    speechLevelVariability: Math.sqrt(
      Math.max(0, combinedVariance),
    ),
  };
}

export function combineAudioDeliveryMetrics(
  completed: AudioDeliveryMetrics,
  current: AudioDeliveryMetrics,
): AudioDeliveryMetrics {
  const levelStatistics =
    combineSpeechLevelStatistics(
      completed,
      current,
    );

  return {
    activeSpeechMs:
      completed.activeSpeechMs +
      current.activeSpeechMs,

    totalSilenceMs:
      completed.totalSilenceMs +
      current.totalSilenceMs,

    longestPauseMs: Math.max(
      completed.longestPauseMs,
      current.longestPauseMs,
    ),

    longPauseCount:
      completed.longPauseCount +
      current.longPauseCount,

    extendedSilenceCount:
      completed.extendedSilenceCount +
      current.extendedSilenceCount,

    averageSpeechLevel:
      levelStatistics.averageSpeechLevel,

    speechLevelVariability:
      levelStatistics.speechLevelVariability,

    lowVolumeMs:
      completed.lowVolumeMs +
      current.lowVolumeMs,

    highVolumeMs:
      completed.highVolumeMs +
      current.highVolumeMs,

    clippingEventCount:
      completed.clippingEventCount +
      current.clippingEventCount,

    backgroundNoiseState:
      combineBackgroundNoise(
        completed,
        current,
      ),

    highNoiseMs:
      completed.highNoiseMs +
      current.highNoiseMs,

    possibleOverlappingSpeechEventCount:
      completed.possibleOverlappingSpeechEventCount +
      current.possibleOverlappingSpeechEventCount,
  };
}

export function createAudioMetricsController() {
  let active = false;
  let answerStarted = false;

  let speechLikely = false;

  /**
   * Initial silence should not count as a pause. This becomes true only after
   * speech has been detected during the current active answer segment.
   */
  let hasDetectedSpeech = false;

  let lastTimestamp: number | null = null;
  let silenceStarted: number | null = null;

  let noiseSamples: number[] = [];
  let calibrationStarted: number | null = null;

  /*
   * Explicit `number` type prevents TypeScript from inferring the literal
   * type of T.fallbackNoiseFloor, such as 0.008.
   */
  let noiseFloor: number =
    T.fallbackNoiseFloor;

  let speechLevelCount = 0;
  let speechLevelSum = 0;
  let speechLevelSquareSum = 0;

  let clippedFrames = 0;
  let clippingWindowStarted:
    | number
    | null = null;

  let answerMetrics =
    createEmptyMetrics();

  let completedMetrics =
    createEmptyMetrics();

  function resetAnswer() {
    active = false;
    answerStarted = false;

    speechLikely = false;
    hasDetectedSpeech = false;
    lastTimestamp = null;
    silenceStarted = null;

    noiseSamples = [];
    calibrationStarted = null;
    noiseFloor = T.fallbackNoiseFloor;

    speechLevelCount = 0;
    speechLevelSum = 0;
    speechLevelSquareSum = 0;

    clippedFrames = 0;
    clippingWindowStarted = null;

    answerMetrics =
      createEmptyMetrics();
  }

  function setActive(next: boolean) {
    /*
     * Repeated start or pause calls should not reset timing state.
     */
    if (active === next) {
      return;
    }

    active = next;
    lastTimestamp = null;
    silenceStarted = null;

    if (next) {
      answerStarted = true;

      /*
       * Ignore silence before the first spoken word whenever the answer starts
       * or resumes after an automatic monitoring pause.
       */
      hasDetectedSpeech = false;
    } else {
      speechLikely = false;
      hasDetectedSpeech = false;
      clippedFrames = 0;
      clippingWindowStarted = null;
    }
  }

  function updateNoiseCalibration(
    rms: number,
    timestamp: number,
  ) {
    /*
     * Do not recalibrate from audio captured while the answer is paused.
     */
    const calibrationAllowed =
      !answerStarted || active;

    if (!calibrationAllowed) {
      return;
    }

    if (calibrationStarted === null) {
      calibrationStarted = timestamp;
    }

    const withinCalibrationWindow =
      timestamp -
        calibrationStarted <=
      T.noiseCalibrationMs;

    if (
      withinCalibrationWindow &&
      !speechLikely
    ) {
      noiseSamples.push(rms);

      if (
        noiseSamples.length >
        MAX_NOISE_SAMPLES
      ) {
        noiseSamples.splice(
          0,
          noiseSamples.length -
            MAX_NOISE_SAMPLES,
        );
      }

      noiseFloor =
        estimateNoiseFloor(
          noiseSamples,
        );
    }
  }

  function updateSpeechDetection(
    rms: number,
  ) {
    const enterThreshold = Math.max(
      noiseFloor *
        T.speechEnterNoiseMultiplier,
      T.lowLevelRms,
    );

    const exitThreshold = Math.max(
      noiseFloor *
        T.speechExitNoiseMultiplier,
      T.fallbackNoiseFloor,
    );

    speechLikely = speechLikely
      ? rms > exitThreshold
      : rms > enterThreshold;
  }

  function updateSpeechStatistics(
    rms: number,
  ) {
    speechLevelCount += 1;
    speechLevelSum += rms;
    speechLevelSquareSum +=
      rms * rms;

    answerMetrics.averageSpeechLevel =
      speechLevelCount > 0
        ? speechLevelSum /
          speechLevelCount
        : 0;

    const variance =
      speechLevelCount > 0
        ? speechLevelSquareSum /
            speechLevelCount -
          answerMetrics
            .averageSpeechLevel **
            2
        : 0;

    answerMetrics.speechLevelVariability =
      Math.sqrt(
        Math.max(0, variance),
      );
  }

  function updateClippingMetrics(
    peak: number,
    timestamp: number,
  ) {
    if (
      peak <
      T.clippingPeakThreshold
    ) {
      if (
        clippingWindowStarted !== null &&
        timestamp -
          clippingWindowStarted >
          T.clippingEventWindowMs
      ) {
        clippingWindowStarted = null;
        clippedFrames = 0;
      }

      return;
    }

    const currentWindowExpired =
      clippingWindowStarted === null ||
      timestamp -
        clippingWindowStarted >
        T.clippingEventWindowMs;

    if (currentWindowExpired) {
      clippingWindowStarted =
        timestamp;

      clippedFrames = 0;
    }

    clippedFrames += 1;

    if (
      clippedFrames ===
      T.clippingFramesPerEvent
    ) {
      answerMetrics.clippingEventCount +=
        1;
    }
  }

  /**
   * Count a pause only after speech resumes. This excludes preparation time
   * before the first word and trailing silence before Stop Answering.
   */
  function completeSilenceInterval(
    timestamp: number,
  ) {
    if (
      !hasDetectedSpeech ||
      silenceStarted === null
    ) {
      silenceStarted = null;
      return;
    }

    const silenceDuration = Math.max(
      0,
      timestamp - silenceStarted,
    );

    answerMetrics.longestPauseMs =
      Math.max(
        answerMetrics.longestPauseMs,
        silenceDuration,
      );

    if (
      silenceDuration >=
      T.longPauseMs
    ) {
      answerMetrics.longPauseCount +=
        1;
    }

    if (
      silenceDuration >=
      T.extendedSilenceMs
    ) {
      answerMetrics.extendedSilenceCount +=
        1;
    }

    silenceStarted = null;
  }

  function process(
    rawRms: number,
    rawPeak: number,
    rawTimestamp: number,
  ): SpeechDeliverySnapshot {
    const rms =
      normalizeSignalValue(rawRms);

    const peak =
      normalizeSignalValue(rawPeak);

    const timestamp =
      normalizeTimestamp(
        rawTimestamp,
      );

    updateNoiseCalibration(
      rms,
      timestamp,
    );

    updateSpeechDetection(rms);

    const microphoneLevel =
      classifyMicrophoneLevel(
        rms,
        peak,
      );

    const currentNoiseState =
      classifyBackgroundNoise(
        noiseFloor,
      );

    const elapsed =
      active &&
      lastTimestamp !== null
        ? Math.max(
            0,
            Math.min(
              timestamp -
                lastTimestamp,
              MAX_FRAME_ELAPSED_MS,
            ),
          )
        : 0;

    if (active) {
      answerMetrics.backgroundNoiseState =
        currentNoiseState;

      if (speechLikely) {
        /*
         * Finalise a silence interval only when speech resumes. The first
         * spoken segment has no preceding pause.
         */
        if (hasDetectedSpeech) {
          completeSilenceInterval(
            timestamp,
          );
        } else {
          silenceStarted = null;
        }

        hasDetectedSpeech = true;

        answerMetrics.activeSpeechMs +=
          elapsed;

        updateSpeechStatistics(rms);

        if (
          microphoneLevel === "low"
        ) {
          answerMetrics.lowVolumeMs +=
            elapsed;
        }

        if (
          microphoneLevel === "high" ||
          microphoneLevel ===
            "clipping"
        ) {
          answerMetrics.highVolumeMs +=
            elapsed;
        }
      } else if (hasDetectedSpeech) {
        /*
         * Silence is measured only after speech has already occurred during
         * this active answer segment.
         */
        answerMetrics.totalSilenceMs +=
          elapsed;

        if (
          silenceStarted === null
        ) {
          /*
           * Include the current sampling interval in the measured silence.
           */
          silenceStarted = Math.max(
            0,
            timestamp - elapsed,
          );
        }

        if (
          rms >= T.noisyRms
        ) {
          answerMetrics.highNoiseMs +=
            elapsed;
        }
      } else {
        /*
         * Preparation time before the first spoken word is intentionally not
         * treated as answer silence or a long pause.
         */
        silenceStarted = null;
      }

      updateClippingMetrics(
        peak,
        timestamp,
      );

      lastTimestamp = timestamp;
    } else {
      /*
       * Paused or inactive time must not change answer-scoring metrics.
       */
      lastTimestamp = null;
      silenceStarted = null;
      speechLikely = false;
      hasDetectedSpeech = false;
    }

    const silenceDurationMs =
      active &&
      hasDetectedSpeech &&
      silenceStarted !== null
        ? Math.max(
            0,
            timestamp -
              silenceStarted,
          )
        : 0;

    let guidance: string;

    if (!active) {
      guidance =
        "Audio scoring paused";
    } else if (
      microphoneLevel ===
        "clipping" ||
      microphoneLevel === "high"
    ) {
      guidance =
        "Microphone level may be too high";
    } else if (
      microphoneLevel === "low" &&
      speechLikely
    ) {
      guidance =
        "Speak a little louder";
    } else if (
      silenceDurationMs >=
      T.extendedSilenceMs
    ) {
      guidance =
        "Continue when you are ready";
    } else if (
      currentNoiseState ===
      "noisy"
    ) {
      guidance =
        "Background noise may affect clarity";
    } else if (speechLikely) {
      guidance =
        "Speech delivery active";
    } else {
      guidance =
        "Continue when ready";
    }

    return {
      microphoneLevel,

      backgroundNoiseState:
        active
          ? answerMetrics
              .backgroundNoiseState
          : currentNoiseState,

      speechLikely:
        active &&
        speechLikely,

      silenceDurationMs,

      activeSpeechMs:
        answerMetrics
          .activeSpeechMs,

      guidance,
      rms,
      peak,
      noiseFloor,
    };
  }

  function finishAnswer() {
    /*
     * Any silence still active here is trailing silence and is intentionally
     * not counted as a completed pause.
     */
    setActive(false);

    completedMetrics =
      combineAudioDeliveryMetrics(
        completedMetrics,
        answerMetrics,
      );

    resetAnswer();
  }

  function resetSession() {
    completedMetrics =
      createEmptyMetrics();

    resetAnswer();
  }

  function getAnswerMetrics(): AudioDeliveryMetrics {
    return {
      ...answerMetrics,
    };
  }

  function getMetrics(): AudioDeliveryMetrics {
    return combineAudioDeliveryMetrics(
      completedMetrics,
      answerMetrics,
    );
  }

  return {
    process,
    setActive,
    finishAnswer,
    resetAnswer,
    resetSession,
    getAnswerMetrics,
    getMetrics,
  };
}