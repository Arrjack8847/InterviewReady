import assert from "node:assert/strict";
import { after, test } from "node:test";

import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
});
after(() => vite.close());

const composer = await vite.ssrLoadModule("/src/features/interview/scoring/scoreComposer.ts");
const normalization = await vite.ssrLoadModule("/src/features/interview/scoring/normalization.ts");
const adapters = await vite.ssrLoadModule("/src/features/interview/scoring/metricAdapters.ts");
const aggregation = await vite.ssrLoadModule(
  "/src/features/interview/scoring/sessionAggregation.ts",
);
const configModule = await vite.ssrLoadModule("/src/features/interview/scoring/scoringConfig.ts");
const visualAnswerMetrics = await vite.ssrLoadModule(
  "/src/features/interview/monitoring/session/visualAnswerMetrics.ts",
);
const answerMetricsModule = await vite.ssrLoadModule(
  "/src/features/interview/scoring/answerMetrics.ts",
);
const selectors = await vite.ssrLoadModule("/src/features/interview/scoring/scoreSelectors.ts");

const { composeInterviewScore } = composer;
const {
  clampNormalizedScore,
  composeMetricCategory,
  measuredMetric,
  normalizeDurationRatioToScore,
  normalizeRatioToScore,
  unavailableMetric,
} = normalization;
const { createAnswerQualityMetrics, createCanonicalSpeechMetrics, createCanonicalVisualMetrics } =
  adapters;
const { aggregateFillerRate, aggregateMetricValues, aggregateSessionMetrics } = aggregation;
const { INTERVIEW_METRICS_VERSION, INTERVIEW_SCORING_CONFIG, INTERVIEW_SCORING_VERSION } =
  configModule;
const { createPersistedAnswerMetrics } = answerMetricsModule;

const feedback = (overall, overrides = {}) => ({
  overall,
  clarity: overall,
  relevance: overall,
  structure: overall,
  technicalAccuracy: overall,
  strengths: [],
  weaknesses: [],
  improvedAnswer: "",
  summary: "",
  interviewTip: "",
  scoreScale: "hundred",
  questionType: "general",
  ...overrides,
});

const visualFixture = (overrides = {}) => ({
  cameraEnabledSeconds: 30,
  faceVisiblePercentage: 100,
  lookingAwayCount: 0,
  headMovementScore: 100,
  cameraPresenceScore: 100,
  metricsVersion: INTERVIEW_METRICS_VERSION,
  cameraEngagementMeasurableMs: 20_000,
  postureMeasurableMs: 20_000,
  cameraEngagementRatio: 0.8,
  centeredPresenceRatio: 0.8,
  professionalFramingRatio: 0.8,
  levelShoulderRatio: 0.8,
  stableUpperBodyRatio: 0.8,
  handVisibleDurationMs: 0,
  ...overrides,
});

test("all measurable categories use the configured video weights", () => {
  const result = composeInterviewScore({
    mode: "video",
    answerQualityScore: 80,
    speechDeliveryScore: 60,
    visualPresentationScore: 40,
  });
  assert.equal(result.overallScore, 70);
  assert.equal(
    result.contributions.reduce((total, item) => total + item.effectiveWeight, 0),
    1,
  );
});

test("unavailable top-level categories are excluded and remaining weights renormalize", () => {
  const noVisual = composeInterviewScore({
    mode: "video",
    answerQualityScore: 80,
    speechDeliveryScore: 60,
    visualPresentationScore: null,
  });
  const noSpeech = composeInterviewScore({
    mode: "video",
    answerQualityScore: 80,
    speechDeliveryScore: null,
    visualPresentationScore: 40,
  });
  assert.equal(noVisual.overallScore, 75);
  assert.equal(noSpeech.overallScore, 73);
  assert.equal(
    noVisual.contributions.find((item) => item.key === "visualPresentation").effectiveWeight,
    0,
  );
});

test("answer-quality failure produces no performance score instead of a fabricated zero", () => {
  const result = composeInterviewScore({
    mode: "video",
    answerQualityScore: null,
    speechDeliveryScore: 80,
    visualPresentationScore: 80,
  });
  assert.equal(result.overallScore, null);
  assert.equal(createAnswerQualityMetrics(null).overall.value, null);
});

test("internal unavailable metrics renormalize while a measured zero remains included", () => {
  const category = composeMetricCategory(
    {
      measuredZero: measuredMetric(0),
      measuredHigh: measuredMetric(100),
      unavailable: unavailableMetric("Not measured"),
    },
    { measuredZero: 0.25, measuredHigh: 0.25, unavailable: 0.5 },
  );
  assert.equal(category.score, 50);
  assert.equal(category.contributions[0].effectiveWeight, 0.5);
  assert.equal(category.contributions[2].effectiveWeight, 0);
});

test("normalizers clamp scores and never return NaN or Infinity", () => {
  assert.equal(clampNormalizedScore(-20), 0);
  assert.equal(clampNormalizedScore(120), 100);
  assert.equal(clampNormalizedScore(Number.NaN), 0);
  assert.equal(clampNormalizedScore(Number.POSITIVE_INFINITY), 0);
  assert.equal(normalizeRatioToScore(1.5), 100);
  assert.equal(normalizeDurationRatioToScore(5_000, 10_000), 50);
  assert.equal(normalizeDurationRatioToScore(1, 0), null);
});

test("short speech does not create a delivery score from hardware-only metrics", () => {
  const result = createCanonicalSpeechMetrics({
    metricsVersion: INTERVIEW_METRICS_VERSION,
    spokenWordCount: 2,
    totalWordCount: 2,
    fillerWordCount: 0,
    pauseCount: 0,
    wordsPerMinute: 120,
    speakingPace: 120,
    speakingPaceWpm: 120,
    transcriptDurationSeconds: 1,
    activeSpeechMs: 1_000,
    speechClarityScore: 90,
    fillerWordsPer100Words: 0,
    answerFlowState: "continuous",
    volumeConsistency: "consistent",
    backgroundNoiseState: "quiet",
  });
  assert.equal(result.speakingPace.measurable, false);
  assert.equal(result.fillerControl.measurable, false);
  assert.equal(result.overall.value, null);
});

test("skipped questions are recorded and excluded from answer-quality averaging", () => {
  const session = aggregateSessionMetrics({
    mode: "text",
    questions: [
      { id: 1, text: "First" },
      { id: 2, text: "Skipped" },
      { id: 3, text: "Third" },
    ],
    answers: [
      { question: { id: 1, text: "First" }, answer: "A", feedback: feedback(80) },
      { question: { id: 3, text: "Third" }, answer: "B", feedback: feedback(60) },
    ],
  });
  assert.deepEqual(session.skippedQuestionIds, [2]);
  assert.equal(session.answerQuality.overall.value, 70);
  assert.equal(session.score.overallScore, 70);
});

test("duration and sample weighting use denominators instead of averaging percentages", () => {
  const durationWeighted = aggregateMetricValues(
    [measuredMetric(100, { durationMs: 10_000 }), measuredMetric(0, { durationMs: 30_000 })],
    "Unavailable",
    "duration",
  );
  const sampleWeighted = aggregateMetricValues(
    [measuredMetric(100, { sampleCount: 10 }), measuredMetric(0, { sampleCount: 30 })],
    "Unavailable",
    "samples",
  );
  assert.equal(durationWeighted.value, 25);
  assert.equal(sampleWeighted.value, 25);
});

test("filler aggregation is word weighted", () => {
  assert.equal(
    aggregateFillerRate([
      { fillerCount: 1, wordCount: 10 },
      { fillerCount: 0, wordCount: 90 },
    ]),
    1,
  );
  assert.equal(aggregateFillerRate([]), null);
});

test("completed-answer visual summaries aggregate by raw durations", () => {
  const short = visualAnswerMetrics.createEmptyScoredVisualSummary();
  short.engagement.measurableFrames = 10;
  short.engagement.engagedFrames = 10;
  short.engagement.centeredFrames = 10;
  short.engagement.measurableDurationMs = 10_000;
  short.engagement.engagedDurationMs = 10_000;
  short.engagement.cameraEngagementRatio = 1;
  short.engagement.centeredPresenceRatio = 1;

  const long = visualAnswerMetrics.createEmptyScoredVisualSummary();
  long.engagement.measurableFrames = 30;
  long.engagement.measurableDurationMs = 30_000;

  const combined = visualAnswerMetrics.combineScoredVisualSummaries(short, long);
  assert.equal(combined.engagement.cameraEngagementRatio, 0.25);
  assert.equal(combined.engagement.measurableDurationMs, 40_000);
});

test("legacy speech scores are preserved but not reinterpreted as v3 dimensions", () => {
  const result = createCanonicalSpeechMetrics({
    spokenWordCount: 50,
    fillerWordCount: 2,
    pauseCount: 1,
    wordsPerMinute: 130,
    speakingPace: 130,
    transcriptDurationSeconds: 30,
    speechClarityScore: 77,
  });
  assert.equal(result.overall.value, 77);
  assert.equal(result.speakingPace, undefined);
  assert.match(result.overall.reason, /Legacy/);
});

test("visual overlap event counts and face-presence fields do not add duplicate penalties", () => {
  const base = createCanonicalVisualMetrics(visualFixture());
  const noisyRawEvents = createCanonicalVisualMetrics(
    visualFixture({
      lookingAwayCount: 99,
      lookingAwayEventCount: 99,
      extendedLookingAwayMs: 99_000,
      faceVisiblePercentage: 1,
      cameraPresenceScore: 1,
    }),
  );
  assert.equal(base.overall.value, 80);
  assert.equal(noisyRawEvents.overall.value, base.overall.value);
});

test("no hands visible is neutral and not scored as zero", () => {
  const result = createCanonicalVisualMetrics(visualFixture());
  assert.equal(result.clearFaceFromHands.applicable, false);
  assert.equal(result.gestureStability.applicable, false);
  assert.equal(result.overall.value, 80);
});

test("configured weights total exactly 100 percent and version metadata is stable", () => {
  for (const weights of Object.values(INTERVIEW_SCORING_CONFIG.topLevelWeights)) {
    assert.equal(
      Object.values(weights).reduce((total, weight) => total + weight, 0),
      1,
    );
  }
  assert.equal(
    Object.values(INTERVIEW_SCORING_CONFIG.speechWeights).reduce(
      (total, weight) => total + weight,
      0,
    ),
    1,
  );
  assert.equal(
    Object.values(INTERVIEW_SCORING_CONFIG.visualWeights).reduce(
      (total, weight) => total + weight,
      0,
    ),
    1,
  );
  const score = composeInterviewScore({ mode: "text", answerQualityScore: 90 });
  assert.equal(score.scoringVersion, INTERVIEW_SCORING_VERSION);
  assert.equal(INTERVIEW_METRICS_VERSION, "interview-metrics-v3");
  assert.equal(INTERVIEW_SCORING_VERSION, "interview-score-v3");
});

test("report selectors preserve legacy scores and respect canonical unavailable scores", () => {
  assert.equal(selectors.selectOverallScore({ overallScore: 64 }), 64);
  const canonicalUnavailable = {
    overallScore: 91,
    scoreBreakdown: composeInterviewScore({
      mode: "video",
      answerQualityScore: null,
      speechDeliveryScore: 80,
      visualPresentationScore: 80,
    }),
  };
  assert.equal(selectors.selectOverallScore(canonicalUnavailable), null);
});

test("per-answer snapshots persist raw, normalized, versioned, and renormalized metrics", () => {
  const visualSummary = visualAnswerMetrics.createEmptyScoredVisualSummary();
  visualSummary.engagement.measurableFrames = 100;
  visualSummary.engagement.engagedFrames = 80;
  visualSummary.engagement.centeredFrames = 75;
  visualSummary.engagement.measurableDurationMs = 20_000;
  visualSummary.engagement.engagedDurationMs = 16_000;
  visualSummary.engagement.offCenterDurationMs = 5_000;
  visualSummary.engagement.cameraEngagementRatio = 0.8;
  visualSummary.engagement.centeredPresenceRatio = 0.75;
  visualSummary.posture.measurableFrames = 100;
  visualSummary.posture.measurableDurationMs = 20_000;
  visualSummary.posture.goodFramingDurationMs = 16_000;
  visualSummary.posture.stableUpperBodyDurationMs = 18_000;
  visualSummary.posture.professionalFramingRatio = 0.8;
  visualSummary.posture.levelShoulderRatio = 0.9;
  visualSummary.posture.stableUpperBodyRatio = 0.9;

  const snapshot = createPersistedAnswerMetrics({
    mode: "video",
    feedback: feedback(84),
    speechMetrics: {
      metricsVersion: INTERVIEW_METRICS_VERSION,
      spokenWordCount: 30,
      totalWordCount: 30,
      fillerWordCount: 2,
      fillerWordsPer100Words: 6.67,
      pauseCount: 1,
      longPauseCount: 1,
      longestPauseMs: 1_800,
      wordsPerMinute: 120,
      speakingPace: 120,
      speakingPaceWpm: 120,
      speakingPaceState: "balanced",
      transcriptDurationSeconds: 20,
      activeSpeechMs: 15_000,
      speechClarityScore: 80,
      answerFlowState: "continuous",
      volumeConsistency: "consistent",
      backgroundNoiseState: "quiet",
    },
    audioMetrics: {
      activeSpeechMs: 15_000,
      totalSilenceMs: 5_000,
      longestPauseMs: 1_800,
      longPauseCount: 1,
      extendedSilenceCount: 0,
      averageSpeechLevel: 0.08,
      speechLevelVariability: 0.02,
      lowVolumeMs: 500,
      highVolumeMs: 0,
      clippingEventCount: 0,
      backgroundNoiseState: "quiet",
      highNoiseMs: 0,
      possibleOverlappingSpeechEventCount: 0,
    },
    visualSummary,
    answerDurationMs: 20_000,
    pausedDurationMs: 3_000,
    integrityEvents: [
      { type: "automatic_no_face_pause", startedAt: "2026-07-18T00:00:00.000Z", durationMs: 3_000 },
    ],
  });

  assert.equal(snapshot.metricsVersion, INTERVIEW_METRICS_VERSION);
  assert.equal(snapshot.scoringVersion, INTERVIEW_SCORING_VERSION);
  assert.equal(snapshot.raw.totalWords, 30);
  assert.equal(snapshot.raw.activeSpeechDurationMs, 15_000);
  assert.equal(snapshot.raw.pausedDurationMs, 3_000);
  assert.equal(snapshot.raw.automaticPauseCount, 1);
  assert.equal(snapshot.measurementStatus.answerQuality, "measured");
  assert.equal(snapshot.measurementStatus.visualPresentation, "measured");
  assert.ok(snapshot.normalized.overall >= 0 && snapshot.normalized.overall <= 100);
  assert.equal(
    snapshot.contributions
      .filter((item) => item.measured)
      .reduce((total, item) => total + item.effectiveWeight, 0),
    1,
  );
  assert.doesNotMatch(JSON.stringify(snapshot), /NaN|Infinity/);
});

test("unavailable per-answer categories stay explicit and are never stored as zero", () => {
  const snapshot = createPersistedAnswerMetrics({ mode: "text", feedback: null });
  assert.equal(snapshot.measurementStatus.answerQuality, "not_measurable");
  assert.equal(snapshot.measurementStatus.speechDelivery, "not_applicable");
  assert.equal(snapshot.measurementStatus.audioQuality, "not_applicable");
  assert.equal(snapshot.measurementStatus.visualPresentation, "not_applicable");
  assert.equal(snapshot.normalized.answerQuality, undefined);
  assert.equal(snapshot.normalized.overall, undefined);
  assert.equal(
    snapshot.contributions.every((item) => item.score === undefined),
    true,
  );
});
