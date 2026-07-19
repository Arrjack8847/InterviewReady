import type {
  AnswerWithFeedback,
  FinalReport,
  InterviewSetup,
  Question,
  SpeechMetrics,
  VisualMetrics,
} from "@/lib/types";
import type { InterviewIntegrityMetrics } from "@/features/interview/scoring/scoringTypes";
import { INTERVIEW_METRICS_VERSION } from "@/features/interview/scoring/scoringConfig";
import {
  createCanonicalSpeechMetrics,
  createCanonicalVisualMetrics,
} from "@/features/interview/scoring/metricAdapters";
import { composeLegacyFinalScore } from "@/features/interview/scoring/scoreComposer";
import { aggregateSessionMetrics } from "@/features/interview/scoring/sessionAggregation";
import type { CameraEngagementSummary } from "@/features/interview/monitoring/face/faceTypes";
import type { PostureMetricsSummary } from "@/features/interview/monitoring/posture/postureTypes";
import type { HandMetricsSummary } from "@/features/interview/monitoring/hands/handTypes";
import type { AudioDeliveryMetrics } from "@/features/interview/speech/audio/audioTypes";
import {
  analyzeFillers,
  calculateActiveSpeechPace,
  countWords as countTranscriptWords,
} from "@/features/interview/speech/transcript/transcriptAnalysis";

type InterviewSetupLike = Partial<Omit<InterviewSetup, "mode">> & {
  mode?: string;
};

type ScoreKey = "overall" | "clarity" | "relevance" | "structure" | "technicalAccuracy";

type ScoreScale = "ten" | "hundred" | "auto";

const FILLER_PATTERNS = [
  /\bum+\b/gi,
  /\buh+\b/gi,
  /\ber+\b/gi,
  /\bah+\b/gi,
  /\blike\b/gi,
  /\byou know\b/gi,
  /\bbasically\b/gi,
  /\bactually\b/gi,
  /\bsort of\b/gi,
  /\bkind of\b/gi,
];

export function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function normalizeScore(value: unknown, scale: ScoreScale = "hundred"): number | null {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (scale === "ten") {
    return number > 10 ? clampScore(number) : clampScore(number * 10);
  }

  if (scale === "auto") {
    if (number >= 0 && number <= 1) {
      return clampScore(number * 100);
    }

    if (number > 1 && number <= 10) {
      return clampScore(number * 10);
    }
  }

  return clampScore(number);
}

export function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value));

  if (validValues.length === 0) return null;

  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function averageScore(values: Array<number | null | undefined>) {
  const validValues = values.filter((value): value is number => Number.isFinite(value));
  const result = average(validValues);

  return result === null ? null : clampScore(result);
}

function getEvaluatedItems(history: AnswerWithFeedback[]) {
  return history.filter((item) => readFeedbackScore(item, "overall") !== null);
}

function readFeedbackScore(item: AnswerWithFeedback, key: ScoreKey) {
  const feedback = (item.feedback || {}) as unknown as Record<string, unknown>;
  const feedbackScale = feedback.scoreScale === "hundred" ? "hundred" : "ten";
  const backendKey =
    key === "overall"
      ? "overallScore"
      : key === "technicalAccuracy"
        ? "technicalScore"
        : `${key}Score`;

  return (
    normalizeScore(feedback[key], feedbackScale) ??
    normalizeScore(feedback[backendKey], "hundred") ??
    null
  );
}

export function getAnswerScoreSummary(history: AnswerWithFeedback[]) {
  const evaluatedItems = getEvaluatedItems(history);
  const scores = evaluatedItems
    .map((item) => readFeedbackScore(item, "overall"))
    .filter((score): score is number => score !== null);

  return {
    answeredCount: history.length,
    scoredAnswerCount: scores.length,
    averageScore: averageScore(scores),
    answerScores: scores,
  };
}

export function calculateAnswerAverageScore(history: AnswerWithFeedback[]) {
  return getAnswerScoreSummary(history).averageScore ?? 0;
}

export function toTenPointDisplayScore(value: unknown, scoreScale: "hundred" | "ten" = "hundred") {
  const score100 = normalizeScore(value, scoreScale);

  if (score100 === null) return 0;

  return Math.min(Math.max(Math.round(score100 / 10), 0), 10);
}

export function calculateAnswerBreakdown(history: AnswerWithFeedback[]): FinalReport["breakdown"] {
  const answeredItems = getEvaluatedItems(history);
  const answerAverage = getAnswerScoreSummary(answeredItems).averageScore ?? 0;

  const clarity = averageScore(answeredItems.map((item) => readFeedbackScore(item, "clarity")));
  const relevance = averageScore(answeredItems.map((item) => readFeedbackScore(item, "relevance")));
  const structure = averageScore(answeredItems.map((item) => readFeedbackScore(item, "structure")));
  const technicalAccuracy = averageScore(
    answeredItems.map((item) => readFeedbackScore(item, "technicalAccuracy")),
  );
  const confidence = averageScore([clarity, structure]);

  return {
    clarity: clarity ?? answerAverage,
    relevance: relevance ?? answerAverage,
    structure: structure ?? answerAverage,
    confidence: confidence ?? answerAverage,
    technicalAccuracy: technicalAccuracy ?? answerAverage,
  };
}

export function hasUsableSpeechMetrics(metrics?: SpeechMetrics | null) {
  if (!metrics) return false;

  return (
    Number(metrics.spokenWordCount || 0) > 0 &&
    Number(metrics.transcriptDurationSeconds || 0) > 0 &&
    Number(metrics.wordsPerMinute || 0) > 0
  );
}

export function calculateSpeechScore(metrics?: SpeechMetrics | null) {
  return createCanonicalSpeechMetrics(metrics).overall?.value ?? null;
}

export function hasUsableVideoMetrics(metrics?: VisualMetrics | null) {
  if (!metrics) return false;

  return (
    Number(metrics.frameCount || 0) > 0 &&
    Number(metrics.analysisDurationMs || 0) > 0 &&
    typeof metrics.overallPresentationScore === "number"
  );
}

export function calculateVideoPresentationScore(metrics?: VisualMetrics | null) {
  return createCanonicalVisualMetrics(metrics).overall?.value ?? null;
}

export function calculateFinalInterviewScore({
  mode,
  answerScore,
  speechScore,
  videoPresentationScore,
}: {
  mode?: string;
  answerScore?: number | null;
  speechScore?: number | null;
  videoPresentationScore?: number | null;
}) {
  return composeLegacyFinalScore({
    mode,
    answerScore: normalizeScore(answerScore, "hundred"),
    speechScore,
    videoPresentationScore,
  });
}

export function debugScoring(label: string, payload: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.debug(`[InterviewReady scoring] ${label}`, payload);
  }
}

export function calculateSpeechMetrics(text: string, durationMs: number): SpeechMetrics {
  const spokenWordCount = countWords(text);
  const durationSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const durationMinutes = durationSeconds > 0 ? durationSeconds / 60 : 0;
  const wordsPerMinute = durationMinutes > 0 ? Math.round(spokenWordCount / durationMinutes) : 0;

  const fillerWordCount = FILLER_PATTERNS.reduce((total, pattern) => {
    const matches = text.match(pattern);
    return total + (matches?.length || 0);
  }, 0);

  const expectedSeconds = spokenWordCount > 0 ? (spokenWordCount / 130) * 60 : 0;
  const pauseCount = Math.max(0, Math.round((durationSeconds - expectedSeconds) / 4));

  const paceScore =
    wordsPerMinute === 0 ? 0 : 100 - Math.min(Math.abs(wordsPerMinute - 130) * 0.8, 35);

  const fillerPenalty =
    spokenWordCount > 0 ? Math.min((fillerWordCount / spokenWordCount) * 260, 28) : 0;

  const pausePenalty = Math.min(pauseCount * 4, 24);

  return {
    spokenWordCount,
    fillerWordCount,
    pauseCount,
    wordsPerMinute,
    speakingPace: clampScore(paceScore),
    transcriptDurationSeconds: durationSeconds,
    speechClarityScore: clampScore(paceScore - fillerPenalty - pausePenalty),
  };
}

export function mergeSpeechDeliveryMetrics(
  base: SpeechMetrics | undefined,
  audio: AudioDeliveryMetrics,
  transcript: string,
): SpeechMetrics | undefined {
  if (!base) return undefined;
  // Browser audio analysis is an optional enhancement. Preserve the existing
  // speech score when permission, device, or browser support makes it unavailable.
  if (audio.activeSpeechMs <= 0) return base;

  const totalWordCount = countTranscriptWords(transcript);
  const fillers = analyzeFillers(transcript);
  const pace = calculateActiveSpeechPace(totalWordCount, audio.activeSpeechMs);
  const pauseRate =
    audio.activeSpeechMs > 0 ? audio.longPauseCount / (audio.activeSpeechMs / 60_000) : 0;
  const answerFlowState =
    audio.activeSpeechMs < 5_000
      ? ("not_measurable" as const)
      : pauseRate > 4
        ? ("frequent_pauses" as const)
        : pauseRate > 1.5
          ? ("some_pauses" as const)
          : ("continuous" as const);
  const volumeConsistency =
    audio.activeSpeechMs <= 0
      ? ("not_measurable" as const)
      : audio.speechLevelVariability > 0.09
        ? ("highly_variable" as const)
        : audio.speechLevelVariability > 0.045
          ? ("slightly_variable" as const)
          : ("consistent" as const);
  const speechDeliverySummary =
    pace.state === "balanced"
      ? "Your speaking pace was balanced for the measurable parts of the interview."
      : pace.state === "fast"
        ? "Your speaking pace was fast at times; slowing slightly may improve clarity."
        : pace.state === "slow"
          ? "Your speaking pace was measured as slower; use the pace that supports clear communication."
          : "More active speech is needed for a reliable speaking-pace estimate.";
  const enrichedMetrics: SpeechMetrics = {
    ...base,
    metricsVersion: INTERVIEW_METRICS_VERSION,
    wordsPerMinute: pace.wpm || base.wordsPerMinute,
    speakingPace: pace.wpm || base.speakingPace,
    fillerWordCount: fillers.fillerWordCount,
    speakingPaceWpm: pace.wpm,
    speakingPaceState: pace.state,
    totalWordCount,
    activeSpeechMs: audio.activeSpeechMs,
    totalSilenceMs: audio.totalSilenceMs,
    longestPauseMs: audio.longestPauseMs,
    longPauseCount: audio.longPauseCount,
    extendedSilenceCount: audio.extendedSilenceCount,
    fillerWordsPer100Words: fillers.fillerWordsPer100Words,
    mostFrequentFillers: fillers.mostFrequentFillers,
    averageSpeechLevel: audio.averageSpeechLevel,
    speechLevelVariability: audio.speechLevelVariability,
    lowVolumeMs: audio.lowVolumeMs,
    highVolumeMs: audio.highVolumeMs,
    clippingEventCount: audio.clippingEventCount,
    backgroundNoiseState: audio.backgroundNoiseState,
    highNoiseMs: audio.highNoiseMs,
    possibleOverlappingSpeechEventCount: audio.possibleOverlappingSpeechEventCount,
    answerFlowState,
    volumeConsistency,
    speechDeliverySummary,
  };
  const canonicalSpeech = createCanonicalSpeechMetrics(enrichedMetrics);
  return {
    ...enrichedMetrics,
    speechClarityScore: canonicalSpeech.overall?.value ?? base.speechClarityScore,
  };
}

export function calculateVisualMetrics({
  mode,
  cameraEnabledMs,
  cameraWasStarted,
}: {
  mode: string;
  cameraEnabledMs: number;
  cameraWasStarted: boolean;
}): VisualMetrics {
  const isVideoMode = mode.toLowerCase() === "video";
  const cameraEnabledSeconds = Math.max(0, Math.round(cameraEnabledMs / 1000));

  return {
    cameraEnabledSeconds,
    faceVisiblePercentage: 0,
    lookingAwayCount: 0,
    headMovementScore: 0,
    cameraPresenceScore: 0,
    faceVisibilityScore: 0,
    faceCenteringScore: 0,
    handVisibilityScore: 0,
    movementStabilityScore: 0,
    overallPresentationScore: 0,
    eyeContactScore: 0,
    analysisDurationMs: 0,
    frameCount: 0,
    faceDetectedFrames: 0,
    faceCenteredFrames: 0,
    handDetectedFrames: 0,
    stableFrames: 0,
    eyeContactFrames: 0,
    screenFacingFrames: 0,
    lookingAwayFrames: 0,
    validFaceFrames: 0,
    visualSummary:
      isVideoMode && !cameraWasStarted
        ? ["Camera was not active long enough for video presentation analysis."]
        : undefined,
  };
}

export function mergeVisualMetrics(
  baseMetrics: VisualMetrics,
  liveVideoMetrics?: Partial<VisualMetrics>,
): VisualMetrics {
  if (!liveVideoMetrics || !liveVideoMetrics.frameCount) {
    return baseMetrics;
  }

  const cameraPresenceScore =
    liveVideoMetrics.cameraPresenceScore ?? baseMetrics.cameraPresenceScore ?? 0;

  const faceVisibilityScore =
    liveVideoMetrics.faceVisibilityScore ?? baseMetrics.faceVisibilityScore ?? 0;

  const faceCenteringScore =
    liveVideoMetrics.faceCenteringScore ?? baseMetrics.faceCenteringScore ?? 0;

  const movementStabilityScore =
    liveVideoMetrics.movementStabilityScore ?? baseMetrics.movementStabilityScore ?? 0;

  const handVisibilityScore =
    liveVideoMetrics.handVisibilityScore ?? baseMetrics.handVisibilityScore ?? 0;

  const eyeContactScore = liveVideoMetrics.eyeContactScore ?? baseMetrics.eyeContactScore ?? 0;

  const analysisDurationMs =
    liveVideoMetrics.analysisDurationMs ?? baseMetrics.analysisDurationMs ?? 0;

  const overallPresentationScore =
    liveVideoMetrics.overallPresentationScore ??
    clampScore(
      faceVisibilityScore * 0.25 +
        faceCenteringScore * 0.2 +
        eyeContactScore * 0.2 +
        movementStabilityScore * 0.2 +
        cameraPresenceScore * 0.15,
    );

  return {
    ...baseMetrics,
    cameraPresenceScore,
    faceVisiblePercentage: faceVisibilityScore,
    headMovementScore: movementStabilityScore,
    faceVisibilityScore,
    faceCenteringScore,
    handVisibilityScore,
    movementStabilityScore,
    overallPresentationScore,
    eyeContactScore,
    analysisDurationMs,
    frameCount: liveVideoMetrics.frameCount ?? baseMetrics.frameCount,
    faceDetectedFrames: liveVideoMetrics.faceDetectedFrames ?? baseMetrics.faceDetectedFrames,
    faceCenteredFrames: liveVideoMetrics.faceCenteredFrames ?? baseMetrics.faceCenteredFrames,
    handDetectedFrames: liveVideoMetrics.handDetectedFrames ?? baseMetrics.handDetectedFrames,
    stableFrames: liveVideoMetrics.stableFrames ?? baseMetrics.stableFrames,
    eyeContactFrames: liveVideoMetrics.eyeContactFrames ?? baseMetrics.eyeContactFrames,
    screenFacingFrames: liveVideoMetrics.screenFacingFrames ?? baseMetrics.screenFacingFrames,
    lookingAwayFrames: liveVideoMetrics.lookingAwayFrames ?? baseMetrics.lookingAwayFrames,
    validFaceFrames: liveVideoMetrics.validFaceFrames ?? baseMetrics.validFaceFrames,
    lookingAwayCount: liveVideoMetrics.lookingAwayFrames ?? baseMetrics.lookingAwayCount,
    visualSummary: liveVideoMetrics.visualSummary?.length
      ? liveVideoMetrics.visualSummary
      : baseMetrics.visualSummary,
  };
}

export function applyCameraEngagementMetrics(
  metrics: VisualMetrics | undefined,
  engagement: CameraEngagementSummary,
  posture?: PostureMetricsSummary,
  hands?: HandMetricsSummary,
): VisualMetrics | undefined {
  if (!metrics) return undefined;

  const hasEngagement = engagement.measurableFrames > 0;
  const coachingSummary: string[] = [];
  if (hasEngagement) {
    coachingSummary.push(
      engagement.cameraEngagementRatio >= 0.75
        ? "You maintained good camera engagement for most measurable interview frames."
        : "You looked away for longer periods at times; placing the interview window near the camera may help.",
      engagement.centeredPresenceRatio >= 0.75
        ? "Your head position was generally centered and stable."
        : "Your position moved outside the center of the frame at times; a small camera adjustment may help.",
      "Camera engagement is estimated from webcam-based facial orientation and may not reflect exact gaze direction.",
    );
  }
  let postureCoachingSummary: string | undefined;
  if (posture && posture.measurableFrames > 0) {
    postureCoachingSummary =
      posture.professionalFramingRatio >= 0.75 && posture.centeredPostureRatio >= 0.75
        ? "You maintained a stable and professional upper-body frame for most measurable moments."
        : "Small camera or sitting-position adjustments may create a more balanced professional frame.";
    coachingSummary.push(
      postureCoachingSummary,
      "Posture and framing are approximate webcam coaching signals and may vary with camera angle, clothing, lighting, mobility, and visibility.",
    );
  }
  let handGestureCoachingSummary: string | undefined;
  if (hands && hands.measurableDurationMs > 0) {
    handGestureCoachingSummary =
      hands.faceObstructionEventCount === 0 && hands.cameraObstructionEventCount === 0
        ? "Your hand use remained optional and did not obstruct your presentation."
        : "Your hands occasionally obscured the camera or face; keeping gestures slightly lower may improve visual clarity.";
    coachingSummary.push(
      handGestureCoachingSummary,
      "Hand-gesture analysis is approximate, gestures are optional, and results may vary with framing, lighting, mobility, culture, and landmark visibility.",
    );
  }
  const enrichedMetrics: VisualMetrics = {
    ...metrics,
    metricsVersion: INTERVIEW_METRICS_VERSION,
    ...(hasEngagement
      ? {
          faceCenteringScore: clampScore(engagement.centeredPresenceRatio * 100),
          eyeContactScore: clampScore(engagement.cameraEngagementRatio * 100),
          cameraEngagementRatio: engagement.cameraEngagementRatio,
          centeredPresenceRatio: engagement.centeredPresenceRatio,
          cameraEngagementMeasurableMs: engagement.measurableDurationMs,
          lookingAwayEventCount: engagement.lookingAwayEventCount,
          extendedLookingAwayMs: engagement.extendedLookingAwayMs,
          offCenterEventCount: engagement.offCenterEventCount,
          excessiveMovementEventCount: engagement.excessiveMovementEventCount,
          averageHeadYaw: engagement.averageHeadYaw,
          averageHeadPitch: engagement.averageHeadPitch,
          averageHeadRoll: engagement.averageHeadRoll,
        }
      : {}),
    ...(posture && posture.measurableFrames > 0
      ? {
          postureMeasurableMs: posture.measurableDurationMs,
          postureMeasurableRatio: posture.postureMeasurableRatio,
          professionalFramingRatio: posture.professionalFramingRatio,
          centeredPostureRatio: posture.centeredPostureRatio,
          levelShoulderRatio: posture.levelShoulderRatio,
          stableUpperBodyRatio: posture.stableUpperBodyRatio,
          prolongedLeanEventCount: posture.prolongedLeanEventCount,
          prolongedShoulderTiltEventCount: posture.prolongedShoulderTiltEventCount,
          framingIssueEventCount: posture.framingIssueEventCount,
          excessiveBodyMovementEventCount: posture.excessiveBodyMovementEventCount,
          averageShoulderAngleDegrees: posture.averageShoulderAngleDegrees,
          averageTorsoLeanRatio: posture.averageTorsoLeanRatio,
          postureCoachingSummary,
        }
      : {}),
    ...(hands && hands.measurableDurationMs > 0
      ? {
          handMeasurableMs: hands.measurableDurationMs,
          handVisibleDurationMs: hands.oneHandDurationMs + hands.twoHandsDurationMs,
          handAnalysisMeasurableRatio: 1,
          naturalGestureRatio: hands.naturalGestureRatio,
          excessiveGestureRatio: hands.excessiveGestureRatio,
          clearFaceFromHandsRatio: hands.clearFaceFromHandsRatio,
          extendedHandsNearFaceEventCount: hands.extendedHandsNearFaceEventCount,
          faceObstructionEventCount: hands.faceObstructionEventCount,
          cameraObstructionEventCount: hands.cameraObstructionEventCount,
          excessiveHandMovementEventCount: hands.excessiveHandMovementEventCount,
          totalHandsNearFaceMs: hands.handsNearFaceDurationMs,
          totalFaceObstructionMs: hands.faceObstructionDurationMs,
          totalCameraObstructionMs: hands.cameraObstructionDurationMs,
          totalExcessiveGestureMs: hands.excessiveGestureDurationMs,
          handGestureCoachingSummary,
        }
      : {}),
    visualSummary: [...(metrics.visualSummary || []), ...coachingSummary],
  };
  const canonicalVisual = createCanonicalVisualMetrics(enrichedMetrics);
  return {
    ...enrichedMetrics,
    overallPresentationScore:
      canonicalVisual.overall?.value ?? enrichedMetrics.overallPresentationScore,
  };
}

export function calculateResumeMatchScore(setup: InterviewSetupLike) {
  const skills = setup.resumeSkills || setup.resume?.skills || [];
  const projects = setup.resumeProjects || setup.resume?.projects || [];
  const hasSummary = Boolean(setup.resumeSummary || setup.resume?.summary);
  const hasEducation = Boolean(setup.resumeEducation || setup.resume?.education);
  const roleSpecific = Boolean(setup.targetRole && setup.targetRole !== setup.role);

  return clampScore(
    35 +
      Math.min(skills.length * 6, 30) +
      Math.min(projects.length * 8, 20) +
      (hasSummary ? 8 : 0) +
      (hasEducation ? 4 : 0) +
      (roleSpecific ? 3 : 0),
  );
}

export function calculateCompanyReadinessScore(
  setup: InterviewSetupLike,
  history: AnswerWithFeedback[],
) {
  const relevanceAverage = averageScore(
    getEvaluatedItems(history).map((item) => readFeedbackScore(item, "relevance")),
  );

  return clampScore(
    averageScore([
      relevanceAverage,
      setup.targetCompany ? 80 : 48,
      setup.jobDescription ? 85 : 55,
      setup.targetRole ? 75 : 50,
    ]) ?? 0,
  );
}

export function calculateCommunicationScore(
  history: AnswerWithFeedback[],
  speechMetrics?: SpeechMetrics | null,
) {
  const answeredItems = getEvaluatedItems(history);
  const feedbackCommunication = averageScore(
    answeredItems.flatMap((item) => [
      readFeedbackScore(item, "clarity"),
      readFeedbackScore(item, "structure"),
    ]),
  );
  const speechScore = calculateSpeechScore(speechMetrics);

  return averageScore([feedbackCommunication, speechScore]) ?? 0;
}

export function enrichFinalReport({
  baseReport,
  setup,
  history,
  speechMetrics,
  visualMetrics,
  questions,
  integrityMetrics,
}: {
  baseReport: FinalReport;
  setup: InterviewSetupLike;
  history: AnswerWithFeedback[];
  speechMetrics?: SpeechMetrics | null;
  visualMetrics?: VisualMetrics | null;
  questions?: Question[];
  integrityMetrics?: InterviewIntegrityMetrics;
}): FinalReport {
  const mode = String(setup.mode || "text").toLowerCase();
  const isVoiceMode = mode === "voice";
  const isVideoMode = mode === "video";

  const answerScoreSummary = getAnswerScoreSummary(history);
  const answerBreakdown = calculateAnswerBreakdown(history);
  const canonicalMetrics = aggregateSessionMetrics({
    mode,
    answers: history,
    questions,
    speechMetrics,
    visualMetrics,
    integrity: integrityMetrics,
  });
  const scoreBreakdown = canonicalMetrics.score;
  const answerQualityScore = scoreBreakdown.answerQualityScore;
  const speechScore = scoreBreakdown.speechDeliveryScore;
  const videoPresentationScore = scoreBreakdown.visualPresentationScore;
  const hasSpeechScore = speechScore !== null && (isVoiceMode || isVideoMode);
  const hasVideoScore = videoPresentationScore !== null && isVideoMode;

  const resumeMatchScore = calculateResumeMatchScore(setup);
  const companyReadinessScore = calculateCompanyReadinessScore(setup, history);
  const communicationScore = calculateCommunicationScore(
    history,
    hasSpeechScore ? speechMetrics : null,
  );

  const cameraPresenceScore =
    hasVideoScore && typeof visualMetrics?.cameraPresenceScore === "number"
      ? visualMetrics.cameraPresenceScore
      : undefined;

  // A completed interview always has at least one evaluated answer. Keep the legacy
  // report total only as a defensive storage fallback; the canonical breakdown records
  // an explicit null instead of fabricating zero when answer quality is unavailable.
  const overallScore = scoreBreakdown.overallScore ?? baseReport.overallScore;

  const availableVisualMetrics =
    hasVideoScore && visualMetrics
      ? {
          ...visualMetrics,
          overallPresentationScore: videoPresentationScore,
        }
      : undefined;

  const videoStrengths =
    isVideoMode && availableVisualMetrics?.visualSummary?.length
      ? availableVisualMetrics.visualSummary.filter(
          (item) =>
            item.includes("consistent") ||
            item.includes("visible") ||
            item.includes("centering") ||
            item.includes("stability") ||
            item.includes("screen-facing"),
        )
      : [];

  const videoImprovements =
    isVideoMode && availableVisualMetrics?.visualSummary?.length
      ? availableVisualMetrics.visualSummary.filter(
          (item) =>
            item.includes("limited") ||
            item.includes("Try") ||
            item.includes("varied") ||
            item.includes("direction") ||
            item.includes("not active") ||
            item.includes("Not enough"),
        )
      : [];

  const nextSteps = [
    ...(baseReport.nextSteps || []),
    setup.targetCompany
      ? `Prepare two examples that connect your experience to ${setup.targetCompany}.`
      : "Add a target company so future practice can measure company readiness.",
    mode === "text"
      ? "Try one answer in voice mode later to practice speaking pace and clarity."
      : "Repeat one answer out loud and aim for a steady 110-150 words per minute.",
    isVideoMode && !hasVideoScore
      ? "Use video mode long enough for the system to capture real presentation frames."
      : "",
  ].filter(Boolean);

  const improvementPlan = [
    "Rewrite the weakest answer using Situation, Task, Action, Result.",
    "Add one measurable outcome to every project example.",
    mode === "text"
      ? "Practice a 60-90 second typed answer with clearer structure."
      : "Practice a 60-90 second answer out loud before the next session.",
  ];

  debugScoring("final score calculation", {
    mode,
    answerScores: answerScoreSummary.answerScores,
    answeredCount: answerScoreSummary.answeredCount,
    scoredAnswerCount: answerScoreSummary.scoredAnswerCount,
    answerQualityScore,
    speechScore: hasSpeechScore ? speechScore : null,
    videoPresentationScore: hasVideoScore ? videoPresentationScore : null,
    overallScore,
    scoringVersion: scoreBreakdown.scoringVersion,
    contributions: scoreBreakdown.contributions,
  });

  return {
    ...baseReport,
    overallScore,
    breakdown: {
      ...answerBreakdown,
      communication: communicationScore,
      resumeMatch: resumeMatchScore,
      companyReadiness: companyReadinessScore,
      ...(hasSpeechScore ? { speechConfidence: speechScore } : {}),
      ...(typeof cameraPresenceScore === "number" ? { cameraPresence: cameraPresenceScore } : {}),
    },
    strengths: Array.from(
      new Set(
        [
          ...(baseReport.strengths || []),
          resumeMatchScore >= 70 ? "Your resume context supports the target role." : "",
          companyReadinessScore >= 70
            ? "Your answers are reasonably aligned to the target company."
            : "",
          ...videoStrengths,
        ].filter(Boolean),
      ),
    ),
    improvements: Array.from(
      new Set(
        [
          ...(baseReport.improvements || []),
          resumeMatchScore < 70 ? "Add more resume-specific examples to strengthen role fit." : "",
          companyReadinessScore < 70
            ? "Use the target company and job description more directly in your answers."
            : "",
          (isVoiceMode || isVideoMode) && !hasSpeechScore
            ? "Speech metrics were unavailable because no usable speech transcript was captured."
            : "",
          hasSpeechScore && speechScore < 70
            ? "Reduce filler words and keep answers at a steadier speaking pace."
            : "",
          isVideoMode && hasVideoScore && videoPresentationScore < 70
            ? "Keep your camera active and your face clearly centered for stronger presentation feedback."
            : "",
          isVideoMode && !hasVideoScore
            ? "Video presentation metrics were unavailable because no usable camera analysis frames were captured."
            : "",
          ...videoImprovements,
        ].filter(Boolean),
      ),
    ),
    nextSteps: Array.from(new Set(nextSteps)).slice(0, 6),
    improvementPlan,
    communicationScore,
    resumeMatchScore,
    companyReadinessScore,
    speechConfidenceScore: hasSpeechScore ? speechScore : undefined,
    cameraPresenceScore,
    overallPresentationScore: hasVideoScore ? videoPresentationScore : undefined,
    speechMetrics: hasSpeechScore ? speechMetrics || undefined : undefined,
    visualMetrics: availableVisualMetrics,
    metricsVersion: canonicalMetrics.metricsVersion,
    scoringVersion: canonicalMetrics.scoringVersion,
    scoreBreakdown,
    canonicalMetrics,
    integrityMetrics,
    answerCount: answerScoreSummary.answeredCount,
    scoredAnswerCount: answerScoreSummary.scoredAnswerCount,
  };
}
