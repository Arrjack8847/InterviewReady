export const INTERVIEW_METRICS_VERSION = "interview-metrics-v3";
export const INTERVIEW_SCORING_VERSION = "interview-score-v3";

export const INTERVIEW_SCORING_CONFIG = {
  metricsVersion: INTERVIEW_METRICS_VERSION,
  scoringVersion: INTERVIEW_SCORING_VERSION,
  topLevelWeights: {
    text: { answerQuality: 1, speechDelivery: 0, visualPresentation: 0 },
    voice: { answerQuality: 0.75, speechDelivery: 0.25, visualPresentation: 0 },
    video: { answerQuality: 0.65, speechDelivery: 0.2, visualPresentation: 0.15 },
  },
  speechWeights: {
    answerFlow: 0.3,
    speakingPace: 0.25,
    fillerControl: 0.2,
    volumeConsistency: 0.15,
    audioClarity: 0.1,
  },
  visualWeights: {
    cameraEngagement: 0.3,
    professionalFraming: 0.25,
    centeredPresence: 0.2,
    postureStability: 0.15,
    clearFaceFromHands: 0.05,
    gestureStability: 0.05,
  },
  minimums: {
    fillerWords: 20,
    paceWords: 20,
    activeSpeechMs: 15_000,
    answerFlowActiveSpeechMs: 5_000,
    measurableVideoMs: 10_000,
    visibleHandsMs: 1_000,
  },
} as const;

export type CanonicalInterviewMode = keyof typeof INTERVIEW_SCORING_CONFIG.topLevelWeights;

export function normalizeInterviewMode(mode?: string): CanonicalInterviewMode {
  const normalized = String(mode || "text").toLowerCase();
  return normalized === "voice" || normalized === "video" ? normalized : "text";
}
