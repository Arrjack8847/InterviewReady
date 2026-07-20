export const INTERVIEW_METRICS_VERSION =
  "interview-metrics-v3";

export const INTERVIEW_SCORING_VERSION =
  "interview-score-v4";

export const INTERVIEW_SCORING_CONFIG = {
  metricsVersion: INTERVIEW_METRICS_VERSION,
  scoringVersion: INTERVIEW_SCORING_VERSION,

  /**
   * Answer quality must remain the main part of the score.
   *
   * Speech and video delivery can improve or reduce presentation
   * quality, but they must never rescue an irrelevant, blank,
   * nonsensical, or non-answer response.
   */
  topLevelWeights: {
    text: {
      answerQuality: 1,
      speechDelivery: 0,
      visualPresentation: 0,
    },

    voice: {
      answerQuality: 0.8,
      speechDelivery: 0.2,
      visualPresentation: 0,
    },

    video: {
      answerQuality: 0.75,
      speechDelivery: 0.15,
      visualPresentation: 0.1,
    },
  },

  /**
   * Controls how the voice-delivery score is calculated.
   */
  speechWeights: {
    answerFlow: 0.3,
    speakingPace: 0.25,
    fillerControl: 0.2,
    volumeConsistency: 0.15,
    audioClarity: 0.1,
  },

  /**
   * Controls how the video-presentation score is calculated.
   *
   * Camera presence should measure presentation only.
   * It must not become a major part of interview-answer correctness.
   */
  visualWeights: {
    cameraEngagement: 0.3,
    professionalFraming: 0.25,
    centeredPresence: 0.2,
    postureStability: 0.15,
    clearFaceFromHands: 0.05,
    gestureStability: 0.05,
  },

  /**
   * Safeguards used by scoreComposer.ts.
   *
   * These prevent excellent microphone or camera metrics from
   * producing a good overall score when the answer itself is poor.
   */
  answerQualitySafeguards: {
    blankMaximum: 0,
    nonsenseMaximum: 0,
    nonAnswerMaximum: 10,
    unrelatedMaximum: 24,

    /**
     * When answer quality is below this value, delivery should
     * have only limited influence on the final score.
     */
    weakAnswerThreshold: 25,

    /**
     * Maximum final score for an answer below weakAnswerThreshold,
     * even when speech or video delivery is strong.
     */
    weakAnswerCompositeMaximum: 30,

    /**
     * Delivery can provide its full contribution only after the
     * candidate gives a reasonably meaningful answer.
     */
    fullDeliveryContributionThreshold: 40,
  },

  /**
   * Minimum amount of measurable data required before a speech
   * or video metric should influence scoring.
   */
  minimums: {
    fillerWords: 20,
    paceWords: 20,
    activeSpeechMs: 15_000,
    answerFlowActiveSpeechMs: 5_000,
    measurableVideoMs: 10_000,
    visibleHandsMs: 1_000,
  },
} as const;

export type CanonicalInterviewMode =
  keyof typeof INTERVIEW_SCORING_CONFIG.topLevelWeights;

const INTERVIEW_MODE_ALIASES: Readonly<
  Record<string, CanonicalInterviewMode>
> = {
  text: "text",
  written: "text",
  typing: "text",

  voice: "voice",
  audio: "voice",
  speech: "voice",
  spoken: "voice",

  video: "video",
  camera: "video",
};

export function normalizeInterviewMode(
  mode?: string,
): CanonicalInterviewMode {
  const normalized = String(mode || "text")
    .trim()
    .toLowerCase();

  return INTERVIEW_MODE_ALIASES[normalized] || "text";
}