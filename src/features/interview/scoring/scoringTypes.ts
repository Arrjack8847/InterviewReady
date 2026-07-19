export type QuestionScoringProfile =
  | "behavioral"
  | "technical"
  | "situational"
  | "motivational"
  | "general";

export interface MetricValue {
  /** Normalized coaching score on a 0-100 scale. */
  value: number | null;
  /** Original measurement, such as WPM, a ratio, or an event rate. */
  rawValue?: number | null;
  measurable: boolean;
  applicable: boolean;
  sampleCount?: number;
  durationMs?: number;
  reason?: string;
}

export interface AnswerQualityMetrics {
  relevance?: MetricValue;
  completeness?: MetricValue;
  structure?: MetricValue;
  specificity?: MetricValue;
  technicalAccuracy?: MetricValue;
  overall?: MetricValue;
}

export interface CanonicalSpeechDeliveryMetrics {
  speakingPace?: MetricValue;
  answerFlow?: MetricValue;
  fillerControl?: MetricValue;
  volumeConsistency?: MetricValue;
  audioClarity?: MetricValue;
  overall?: MetricValue;
}

export interface CanonicalVisualPresentationMetrics {
  cameraEngagement?: MetricValue;
  professionalFraming?: MetricValue;
  centeredPresence?: MetricValue;
  postureStability?: MetricValue;
  clearFaceFromHands?: MetricValue;
  gestureStability?: MetricValue;
  overall?: MetricValue;
}

export interface InterviewIntegrityMetrics {
  noFaceEventCount?: number;
  multipleFaceEventCount?: number;
  pauseCount?: number;
  totalPausedMs?: number;
  noFaceDurationMs?: number;
  multipleFaceDurationMs?: number;
  cameraUnavailableMs?: number;
  analysisErrorCount?: number;
}

export interface ScoreContribution {
  key: string;
  label: string;
  rawScore: number | null;
  configuredWeight: number;
  effectiveWeight: number;
  contribution: number;
  measurable: boolean;
  applicable: boolean;
  reason?: string;
}

export interface ScoreCategoryBreakdown {
  score: number | null;
  contributions: ScoreContribution[];
}

export interface AnswerScoreBreakdown {
  overallScore: number | null;
  answerQualityScore: number | null;
  speechDeliveryScore: number | null;
  visualPresentationScore: number | null;
  contributions: ScoreContribution[];
  explanations: string[];
  scoringVersion: string;
}

export interface AnswerInterviewMetrics {
  questionId: number;
  questionProfile: QuestionScoringProfile;
  status: "completed" | "skipped" | "evaluation_unavailable";
  answerQuality?: AnswerQualityMetrics;
  score?: AnswerScoreBreakdown;
  version: string;
}

export interface SessionInterviewMetrics {
  metricsVersion: string;
  scoringVersion: string;
  answers: AnswerInterviewMetrics[];
  skippedQuestionIds: number[];
  answerQuality?: AnswerQualityMetrics;
  speechDelivery?: CanonicalSpeechDeliveryMetrics;
  visualPresentation?: CanonicalVisualPresentationMetrics;
  integrity?: InterviewIntegrityMetrics;
  score: AnswerScoreBreakdown;
}

export type MeasurementStatus = "measured" | "not_measurable" | "not_applicable";

export interface PersistedAnswerMetrics {
  metricsVersion: string;
  scoringVersion: string;
  measurementStatus: {
    answerQuality: MeasurementStatus;
    speechDelivery: MeasurementStatus;
    audioQuality: MeasurementStatus;
    visualPresentation: MeasurementStatus;
  };
  raw: {
    totalWords?: number;
    activeSpeechDurationMs?: number;
    answerDurationMs?: number;
    pausedDurationMs?: number;
    wordsPerMinute?: number;
    fillerCount?: number;
    fillerRate?: number;
    longPauseCount?: number;
    longestSilenceMs?: number;
    averageRms?: number;
    peakAmplitude?: number;
    clippingEventCount?: number;
    lowVolumeDurationMs?: number;
    highVolumeDurationMs?: number;
    backgroundNoiseDurationMs?: number;
    measurableVideoDurationMs?: number;
    engagedDurationMs?: number;
    centeredDurationMs?: number;
    professionallyFramedDurationMs?: number;
    postureStableDurationMs?: number;
    gestureStableDurationMs?: number;
    obstructionDurationMs?: number;
    noFaceEventCount?: number;
    multipleFaceEventCount?: number;
    automaticPauseCount?: number;
  };
  normalized: {
    answerQuality?: number;
    speechDelivery?: number;
    audioQuality?: number;
    visualPresentation?: number;
    overall?: number;
  };
  contributions: Array<{
    category: string;
    measured: boolean;
    configuredWeight: number;
    effectiveWeight: number;
    score?: number;
    contribution?: number;
    unavailableReason?: string;
  }>;
  integrityEvents?: Array<{
    type: string;
    startedAt?: string;
    durationMs?: number;
  }>;
}

export type MetricMap = Record<string, MetricValue | undefined>;
