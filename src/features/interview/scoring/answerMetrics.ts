import type { Feedback, SpeechMetrics, VisualMetrics } from "@/lib/types";
import type { AudioDeliveryMetrics } from "../speech/audio/audioTypes";
import type { ScoredVisualSummary } from "../monitoring/session/visualAnswerMetrics";
import {
  createAnswerQualityMetrics,
  createCanonicalSpeechMetrics,
  createCanonicalVisualMetrics,
} from "./metricAdapters";
import { composeAnswerScore } from "./scoreComposer";
import {
  INTERVIEW_METRICS_VERSION,
  INTERVIEW_SCORING_VERSION,
  normalizeInterviewMode,
} from "./scoringConfig";
import type { MeasurementStatus, PersistedAnswerMetrics } from "./scoringTypes";

const finiteNonNegative = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : undefined;
};

const measuredStatus = (applicable: boolean, measurable: boolean | undefined): MeasurementStatus =>
  applicable ? (measurable ? "measured" : "not_measurable") : "not_applicable";

export function createAnswerVisualMetrics(
  summary?: ScoredVisualSummary | null,
): VisualMetrics | undefined {
  if (!summary) return undefined;
  const { engagement, posture, hands } = summary;
  const measurableDurationMs = Math.max(
    engagement.measurableDurationMs,
    posture.measurableDurationMs,
    hands.measurableDurationMs,
  );
  return {
    metricsVersion: INTERVIEW_METRICS_VERSION,
    cameraEnabledSeconds: measurableDurationMs / 1_000,
    faceVisiblePercentage: 0,
    lookingAwayCount: engagement.lookingAwayEventCount,
    headMovementScore: 0,
    cameraPresenceScore: 0,
    analysisDurationMs: measurableDurationMs,
    frameCount: engagement.measurableFrames,
    cameraEngagementRatio: engagement.cameraEngagementRatio,
    centeredPresenceRatio: engagement.centeredPresenceRatio,
    cameraEngagementMeasurableMs: engagement.measurableDurationMs,
    postureMeasurableMs: posture.measurableDurationMs,
    professionalFramingRatio: posture.professionalFramingRatio,
    levelShoulderRatio: posture.levelShoulderRatio,
    stableUpperBodyRatio: posture.stableUpperBodyRatio,
    handVisibleDurationMs: hands.oneHandDurationMs + hands.twoHandsDurationMs,
    totalFaceObstructionMs: hands.faceObstructionDurationMs,
    totalCameraObstructionMs: hands.cameraObstructionDurationMs,
    totalExcessiveGestureMs: hands.excessiveGestureDurationMs,
  };
}

export function createPersistedAnswerMetrics({
  mode,
  feedback,
  speechMetrics,
  audioMetrics,
  visualMetrics,
  visualSummary,
  answerDurationMs,
  pausedDurationMs,
  integrityEvents = [],
}: {
  mode?: string;
  feedback?: Partial<Feedback> | null;
  speechMetrics?: SpeechMetrics | null;
  audioMetrics?: AudioDeliveryMetrics | null;
  visualMetrics?: VisualMetrics | null;
  visualSummary?: ScoredVisualSummary | null;
  answerDurationMs?: number;
  pausedDurationMs?: number;
  integrityEvents?: PersistedAnswerMetrics["integrityEvents"];
}): PersistedAnswerMetrics {
  const normalizedMode = normalizeInterviewMode(mode);
  const answerQuality = createAnswerQualityMetrics(feedback);
  const speechDelivery = createCanonicalSpeechMetrics(speechMetrics);
  const answerVisualMetrics = visualMetrics ?? createAnswerVisualMetrics(visualSummary);
  const visualPresentation = createCanonicalVisualMetrics(answerVisualMetrics);
  const score = composeAnswerScore({
    mode: normalizedMode,
    answerQualityScore: answerQuality.overall?.value ?? null,
    speechDeliveryScore: speechDelivery.overall?.value ?? null,
    visualPresentationScore: visualPresentation.overall?.value ?? null,
  });
  const engagement = visualSummary?.engagement;
  const posture = visualSummary?.posture;
  const hands = visualSummary?.hands;
  const autoPauses = integrityEvents.filter(
    (event) => event.type.startsWith("automatic_") && event.type.endsWith("_pause"),
  );
  const normalized: PersistedAnswerMetrics["normalized"] = {};
  if (answerQuality.overall?.value !== null && answerQuality.overall?.value !== undefined)
    normalized.answerQuality = answerQuality.overall.value;
  if (speechDelivery.overall?.value !== null && speechDelivery.overall?.value !== undefined)
    normalized.speechDelivery = speechDelivery.overall.value;
  if (
    speechDelivery.audioClarity?.value !== null &&
    speechDelivery.audioClarity?.value !== undefined
  )
    normalized.audioQuality = speechDelivery.audioClarity.value;
  if (visualPresentation.overall?.value !== null && visualPresentation.overall?.value !== undefined)
    normalized.visualPresentation = visualPresentation.overall.value;
  if (score.overallScore !== null) normalized.overall = score.overallScore;

  return {
    metricsVersion: INTERVIEW_METRICS_VERSION,
    scoringVersion: INTERVIEW_SCORING_VERSION,
    measurementStatus: {
      answerQuality: measuredStatus(true, answerQuality.overall?.measurable),
      speechDelivery: measuredStatus(normalizedMode !== "text", speechDelivery.overall?.measurable),
      audioQuality: measuredStatus(
        normalizedMode !== "text",
        speechDelivery.audioClarity?.measurable,
      ),
      visualPresentation: measuredStatus(
        normalizedMode === "video",
        visualPresentation.overall?.measurable,
      ),
    },
    raw: {
      totalWords: finiteNonNegative(
        speechMetrics?.totalWordCount ?? speechMetrics?.spokenWordCount,
      ),
      activeSpeechDurationMs: finiteNonNegative(
        audioMetrics?.activeSpeechMs ?? speechMetrics?.activeSpeechMs,
      ),
      answerDurationMs: finiteNonNegative(answerDurationMs),
      pausedDurationMs: finiteNonNegative(pausedDurationMs),
      wordsPerMinute: finiteNonNegative(
        speechMetrics?.speakingPaceWpm ?? speechMetrics?.wordsPerMinute,
      ),
      fillerCount: finiteNonNegative(speechMetrics?.fillerWordCount),
      fillerRate: finiteNonNegative(speechMetrics?.fillerWordsPer100Words),
      longPauseCount: finiteNonNegative(
        audioMetrics?.longPauseCount ?? speechMetrics?.longPauseCount,
      ),
      longestSilenceMs: finiteNonNegative(
        audioMetrics?.longestPauseMs ?? speechMetrics?.longestPauseMs,
      ),
      averageRms: finiteNonNegative(audioMetrics?.averageSpeechLevel),
      clippingEventCount: finiteNonNegative(audioMetrics?.clippingEventCount),
      lowVolumeDurationMs: finiteNonNegative(audioMetrics?.lowVolumeMs),
      highVolumeDurationMs: finiteNonNegative(audioMetrics?.highVolumeMs),
      backgroundNoiseDurationMs: finiteNonNegative(audioMetrics?.highNoiseMs),
      measurableVideoDurationMs: finiteNonNegative(engagement?.measurableDurationMs),
      engagedDurationMs: finiteNonNegative(engagement?.engagedDurationMs),
      centeredDurationMs: finiteNonNegative(
        engagement ? engagement.measurableDurationMs - engagement.offCenterDurationMs : undefined,
      ),
      professionallyFramedDurationMs: finiteNonNegative(posture?.goodFramingDurationMs),
      postureStableDurationMs: finiteNonNegative(posture?.stableUpperBodyDurationMs),
      gestureStableDurationMs: finiteNonNegative(
        hands ? hands.measurableDurationMs - hands.excessiveGestureDurationMs : undefined,
      ),
      obstructionDurationMs: finiteNonNegative(
        hands
          ? Math.max(hands.faceObstructionDurationMs, hands.cameraObstructionDurationMs)
          : undefined,
      ),
      noFaceEventCount:
        normalizedMode === "video"
          ? autoPauses.filter((event) => event.type === "automatic_no_face_pause").length
          : undefined,
      multipleFaceEventCount:
        normalizedMode === "video"
          ? autoPauses.filter((event) => event.type === "automatic_multiple_faces_pause").length
          : undefined,
      automaticPauseCount: normalizedMode === "video" ? autoPauses.length : undefined,
    },
    normalized,
    contributions: score.contributions.map((item) => ({
      category: item.key,
      measured: item.measurable,
      configuredWeight: item.configuredWeight,
      effectiveWeight: item.effectiveWeight,
      ...(item.rawScore === null ? {} : { score: item.rawScore }),
      ...(item.measurable ? { contribution: item.contribution } : {}),
      ...(!item.measurable && item.reason ? { unavailableReason: item.reason } : {}),
    })),
    ...(integrityEvents.length ? { integrityEvents } : {}),
  };
}
