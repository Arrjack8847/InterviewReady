import type { AnswerWithFeedback, Feedback, SpeechMetrics, VisualMetrics } from "@/lib/types";
import { INTERVIEW_SCORING_CONFIG, INTERVIEW_METRICS_VERSION } from "./scoringConfig";
import {
  clampNormalizedScore,
  composeMetricCategory,
  measuredMetric,
  normalizeDurationRatioToScore,
  normalizeRatioToScore,
  unavailableMetric,
} from "./normalization";
import type {
  AnswerInterviewMetrics,
  AnswerQualityMetrics,
  CanonicalSpeechDeliveryMetrics,
  CanonicalVisualPresentationMetrics,
  MetricValue,
  QuestionScoringProfile,
} from "./scoringTypes";
import { composeAnswerScore } from "./scoreComposer";

const SPEECH_LABELS = {
  answerFlow: "Answer flow",
  speakingPace: "Speaking pace",
  fillerControl: "Filler control",
  volumeConsistency: "Volume consistency",
  audioClarity: "Audio clarity",
};

const VISUAL_LABELS = {
  cameraEngagement: "Camera engagement",
  professionalFraming: "Professional framing",
  centeredPresence: "Centered presence",
  postureStability: "Posture stability",
  clearFaceFromHands: "Clear face from hands",
  gestureStability: "Gesture stability",
};

function normalizeFeedbackScore(value: unknown, scale?: Feedback["scoreScale"]) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  const inferredScale = scale || (score >= 0 && score <= 10 ? "ten" : "hundred");
  return clampNormalizedScore(inferredScale === "ten" ? score * 10 : score);
}

export function getQuestionScoringProfile(feedback?: Partial<Feedback>): QuestionScoringProfile {
  switch (feedback?.questionType) {
    case "behavioural":
      return "behavioral";
    case "technical":
    case "situational":
    case "motivational":
      return feedback.questionType;
    default:
      return "general";
  }
}

function feedbackMetric(
  value: unknown,
  scale: Feedback["scoreScale"],
  reason: string,
  applicable = true,
) {
  if (!applicable) return unavailableMetric(reason, false);
  const score = normalizeFeedbackScore(value, scale);
  return score === null ? unavailableMetric(reason) : measuredMetric(score, { sampleCount: 1 });
}

export function createAnswerQualityMetrics(
  feedback?: Partial<Feedback> | null,
): AnswerQualityMetrics {
  if (!feedback) {
    return { overall: unavailableMetric("Answer evaluation is unavailable.") };
  }
  const profile = getQuestionScoringProfile(feedback);
  const scale = feedback.scoreScale;
  const questionSpecificScore = feedback.technicalAccuracy;
  return {
    relevance: feedbackMetric(feedback.relevance, scale, "Relevance was not returned."),
    structure: feedbackMetric(feedback.structure, scale, "Structure was not returned."),
    technicalAccuracy: feedbackMetric(
      questionSpecificScore,
      scale,
      profile === "technical"
        ? "Role-specific knowledge was not evaluated."
        : "Role-specific knowledge is not applicable to this question profile.",
      profile === "technical",
    ),
    completeness: feedbackMetric(
      questionSpecificScore,
      scale,
      profile === "general"
        ? "General-answer completeness was not returned."
        : "Completeness is not the question-specific content dimension for this profile.",
      profile === "general",
    ),
    specificity: feedbackMetric(
      questionSpecificScore,
      scale,
      profile === "behavioral" || profile === "situational" || profile === "motivational"
        ? "Question-specific supporting detail was not returned."
        : "Specificity is not the question-specific content dimension for this profile.",
      profile === "behavioral" || profile === "situational" || profile === "motivational",
    ),
    // The backend evaluator owns this value; supporting dimensions never recalculate it.
    overall: feedbackMetric(feedback.overall, scale, "Answer evaluation is unavailable."),
  };
}

export function createAnswerInterviewMetrics(answer: AnswerWithFeedback): AnswerInterviewMetrics {
  const answerQuality = createAnswerQualityMetrics(answer.feedback);
  const answerQualityScore = answerQuality.overall?.value ?? null;
  return {
    questionId: answer.question.id,
    questionProfile: getQuestionScoringProfile(answer.feedback),
    status: answerQuality.overall?.measurable ? "completed" : "evaluation_unavailable",
    answerQuality,
    score: composeAnswerScore({ mode: "text", answerQualityScore }),
    version: INTERVIEW_METRICS_VERSION,
  };
}

function categoryOverall(score: number | null, reason: string, durationMs?: number): MetricValue {
  return score === null
    ? unavailableMetric(reason)
    : measuredMetric(score, { durationMs, reason: "Available metrics were weight-normalized." });
}

export function createCanonicalSpeechMetrics(
  metrics?: SpeechMetrics | null,
): CanonicalSpeechDeliveryMetrics {
  if (!metrics) {
    return { overall: unavailableMetric("Speech delivery was not captured.") };
  }
  if (metrics.metricsVersion !== INTERVIEW_METRICS_VERSION) {
    const legacyScore = Number(metrics.speechClarityScore);
    const legacyMeasurable =
      Number(metrics.spokenWordCount || 0) > 0 &&
      Number(metrics.transcriptDurationSeconds || 0) > 0 &&
      Number.isFinite(legacyScore);
    return {
      overall: legacyMeasurable
        ? measuredMetric(legacyScore, {
            durationMs: Number(metrics.transcriptDurationSeconds) * 1_000,
            reason: "Legacy speech score preserved without reinterpretation.",
          })
        : unavailableMetric("Legacy speech delivery was not measurable."),
    };
  }
  const words = Math.max(0, Number(metrics.totalWordCount ?? metrics.spokenWordCount ?? 0));
  const activeSpeechMs = Math.max(
    0,
    Number(metrics.activeSpeechMs ?? metrics.transcriptDurationSeconds * 1_000),
  );
  const paceWpm = Number(metrics.speakingPaceWpm ?? metrics.wordsPerMinute);
  const paceMeasurable =
    Number.isFinite(paceWpm) &&
    paceWpm > 0 &&
    metrics.speakingPaceState !== "not_measurable" &&
    (words >= INTERVIEW_SCORING_CONFIG.minimums.paceWords ||
      activeSpeechMs >= INTERVIEW_SCORING_CONFIG.minimums.activeSpeechMs);
  const speakingPace = paceMeasurable
    ? measuredMetric(100 - Math.min(Math.abs(paceWpm - 130) * 0.8, 45), {
        rawValue: paceWpm,
        durationMs: activeSpeechMs,
      })
    : unavailableMetric("Not enough finalized speech for a reliable pace estimate.");

  const flowState = metrics.answerFlowState;
  const answerFlow =
    activeSpeechMs >= INTERVIEW_SCORING_CONFIG.minimums.answerFlowActiveSpeechMs &&
    flowState &&
    flowState !== "not_measurable"
      ? measuredMetric(
          flowState === "frequent_pauses" ? 55 : flowState === "some_pauses" ? 78 : 100,
          {
            rawValue: Number(metrics.longPauseCount ?? metrics.pauseCount),
            durationMs: activeSpeechMs,
          },
        )
      : unavailableMetric("Not enough active speech for answer-flow scoring.");

  const fillerRate = Number(metrics.fillerWordsPer100Words);
  const fillerControl =
    words >= INTERVIEW_SCORING_CONFIG.minimums.fillerWords && Number.isFinite(fillerRate)
      ? measuredMetric(100 - Math.min(Math.max(fillerRate, 0) * 5, 60), {
          rawValue: fillerRate,
          sampleCount: words,
        })
      : unavailableMetric("Filler control is not scored below 20 finalized words.");

  const volumeState = metrics.volumeConsistency;
  const volumeConsistency =
    activeSpeechMs > 0 && volumeState && volumeState !== "not_measurable"
      ? measuredMetric(
          volumeState === "highly_variable" ? 65 : volumeState === "slightly_variable" ? 82 : 100,
          { rawValue: Number(metrics.speechLevelVariability ?? 0), durationMs: activeSpeechMs },
        )
      : unavailableMetric("Volume consistency was not measurable.");

  const noiseState = metrics.backgroundNoiseState;
  const audioClarity =
    activeSpeechMs > 0 && noiseState && noiseState !== "unavailable"
      ? measuredMetric(
          (noiseState === "noisy" ? 70 : noiseState === "moderate" ? 86 : 100) -
            Math.min(Math.max(Number(metrics.clippingEventCount || 0), 0) * 5, 20),
          {
            rawValue: Number(metrics.highNoiseMs || 0),
            durationMs: activeSpeechMs + Math.max(0, Number(metrics.totalSilenceMs || 0)),
          },
        )
      : unavailableMetric("Audio clarity was not measurable.");

  const category = composeMetricCategory(
    { speakingPace, answerFlow, fillerControl, volumeConsistency, audioClarity },
    INTERVIEW_SCORING_CONFIG.speechWeights,
    SPEECH_LABELS,
  );
  const hasCoreDeliveryMetric = [speakingPace, answerFlow, fillerControl].some(
    (metric) => metric.measurable && metric.value !== null,
  );
  return {
    speakingPace,
    answerFlow,
    fillerControl,
    volumeConsistency,
    audioClarity,
    overall: categoryOverall(
      hasCoreDeliveryMetric ? category.score : null,
      "Speech delivery needs more finalized words or active speech before it is scored.",
      activeSpeechMs,
    ),
  };
}

export function createCanonicalVisualMetrics(
  metrics?: VisualMetrics | null,
): CanonicalVisualPresentationMetrics {
  if (!metrics) {
    return { overall: unavailableMetric("Visual presentation was not captured.") };
  }
  const engagementDuration = Math.max(0, Number(metrics.cameraEngagementMeasurableMs || 0));
  const postureDuration = Math.max(0, Number(metrics.postureMeasurableMs || 0));
  const visibleHandsMs = Math.max(0, Number(metrics.handVisibleDurationMs || 0));
  const hasEngagement = engagementDuration >= INTERVIEW_SCORING_CONFIG.minimums.measurableVideoMs;
  const hasPosture = postureDuration >= INTERVIEW_SCORING_CONFIG.minimums.measurableVideoMs;
  const cameraEngagementScore = normalizeRatioToScore(metrics.cameraEngagementRatio);
  const centeredPresenceScore = normalizeRatioToScore(metrics.centeredPresenceRatio);
  const framingScore = normalizeRatioToScore(metrics.professionalFramingRatio);
  const postureScore =
    Number.isFinite(metrics.levelShoulderRatio) && Number.isFinite(metrics.stableUpperBodyRatio)
      ? normalizeRatioToScore(
          (Number(metrics.levelShoulderRatio) + Number(metrics.stableUpperBodyRatio)) / 2,
        )
      : null;

  const cameraEngagement =
    hasEngagement && cameraEngagementScore !== null
      ? measuredMetric(cameraEngagementScore, {
          rawValue: metrics.cameraEngagementRatio,
          durationMs: engagementDuration,
        })
      : unavailableMetric("Camera engagement requires 10 seconds of measurable interview video.");
  const centeredPresence =
    hasEngagement && centeredPresenceScore !== null
      ? measuredMetric(centeredPresenceScore, {
          rawValue: metrics.centeredPresenceRatio,
          durationMs: engagementDuration,
        })
      : unavailableMetric("Centered presence requires measurable interview video.");
  const professionalFraming =
    hasPosture && framingScore !== null
      ? measuredMetric(framingScore, {
          rawValue: metrics.professionalFramingRatio,
          durationMs: postureDuration,
        })
      : unavailableMetric("Professional framing requires 10 seconds of measurable posture video.");
  const postureStability =
    hasPosture && postureScore !== null
      ? measuredMetric(postureScore, { durationMs: postureDuration })
      : unavailableMetric("Posture stability requires measurable posture video.");

  const handsApplicable = visibleHandsMs >= INTERVIEW_SCORING_CONFIG.minimums.visibleHandsMs;
  const obstructionDuration = Math.max(
    Number(metrics.totalFaceObstructionMs || 0),
    Number(metrics.totalCameraObstructionMs || 0),
  );
  const clearFaceScore = normalizeDurationRatioToScore(obstructionDuration, visibleHandsMs);
  const gestureScore = normalizeDurationRatioToScore(
    Number(metrics.totalExcessiveGestureMs || 0),
    visibleHandsMs,
  );
  const clearFaceFromHands =
    handsApplicable && clearFaceScore !== null
      ? measuredMetric(clearFaceScore, {
          rawValue: obstructionDuration,
          durationMs: visibleHandsMs,
        })
      : unavailableMetric("No hands were visible long enough to score obstruction.", false);
  const gestureStability =
    handsApplicable && gestureScore !== null
      ? measuredMetric(gestureScore, {
          rawValue: Number(metrics.totalExcessiveGestureMs || 0),
          durationMs: visibleHandsMs,
        })
      : unavailableMetric("No hands were visible long enough to score gesture stability.", false);

  const category = composeMetricCategory(
    {
      cameraEngagement,
      professionalFraming,
      centeredPresence,
      postureStability,
      clearFaceFromHands,
      gestureStability,
    },
    INTERVIEW_SCORING_CONFIG.visualWeights,
    VISUAL_LABELS,
  );
  return {
    cameraEngagement,
    professionalFraming,
    centeredPresence,
    postureStability,
    clearFaceFromHands,
    gestureStability,
    overall: categoryOverall(
      category.score,
      "Visual presentation was not measurable.",
      Math.max(engagementDuration, postureDuration),
    ),
  };
}
