import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
});
after(() => vite.close());

const reportModule = await vite.ssrLoadModule("/src/features/report/buildReportViewModel.ts");
const configModule = await vite.ssrLoadModule("/src/features/report/reportConfig.ts");
const { buildInterviewReportViewModel, formatReportDate, formatReportDuration } = reportModule;
const { getAnswerScoreLabel, getPerformanceLabel } = configModule;

const contribution = (key, score, configuredWeight) => ({
  key,
  label:
    key === "answerQuality"
      ? "Answer quality"
      : key === "speechDelivery"
        ? "Speech delivery"
        : "Visual presentation",
  rawScore: score,
  configuredWeight,
  effectiveWeight: configuredWeight,
  contribution: score === null ? 0 : score * configuredWeight,
  measurable: score !== null,
  applicable: configuredWeight > 0,
});

const metric = (value, rawValue = value) => ({
  value,
  rawValue,
  measurable: value !== null,
  applicable: true,
});

function feedback(overall = 82, overrides = {}) {
  return {
    overall,
    clarity: 80,
    relevance: 86,
    structure: 78,
    technicalAccuracy: 81,
    scoreScale: "hundred",
    questionType: "general",
    strengths: ["The answer addressed the question directly."],
    weaknesses: [],
    improvedAnswer: "A clearer example answer.",
    summary: "A relevant answer with a clear main point.",
    interviewTip: "Add one specific result.",
    ...overrides,
  };
}

function canonicalReport(mode = "video", overrides = {}) {
  const weights =
    mode === "text" ? [1, 0, 0] : mode === "voice" ? [0.75, 0.25, 0] : [0.65, 0.2, 0.15];
  const speechScore = mode === "text" ? null : 78;
  const visualScore = mode === "video" ? 76 : null;
  return {
    overallScore: 82,
    breakdown: {
      clarity: 80,
      relevance: 86,
      structure: 78,
      confidence: 80,
      technicalAccuracy: 81,
    },
    strengths: [],
    improvements: [],
    nextSteps: [],
    improvedSampleAnswer: "",
    metricsVersion: "interview-metrics-v3",
    scoringVersion: "interview-score-v3",
    scoreBreakdown: {
      overallScore: 82,
      answerQualityScore: 84,
      speechDeliveryScore: speechScore,
      visualPresentationScore: visualScore,
      contributions: [
        contribution("answerQuality", 84, weights[0]),
        contribution("speechDelivery", speechScore, weights[1]),
        contribution("visualPresentation", visualScore, weights[2]),
      ],
      explanations: [],
      scoringVersion: "interview-score-v3",
    },
    canonicalMetrics: {
      metricsVersion: "interview-metrics-v3",
      scoringVersion: "interview-score-v3",
      answers: [],
      skippedQuestionIds: [],
      answerQuality: {
        relevance: metric(86),
        structure: metric(78),
        completeness: metric(72),
        specificity: metric(68),
        overall: metric(84),
      },
      speechDelivery: {
        speakingPace: mode === "text" ? metric(null) : metric(85, 142),
        answerFlow: mode === "text" ? metric(null) : metric(76),
        fillerControl: mode === "text" ? metric(null) : metric(73),
        volumeConsistency: mode === "text" ? metric(null) : metric(82),
        audioClarity: mode === "text" ? metric(null) : metric(84),
        overall: mode === "text" ? metric(null) : metric(78),
      },
      visualPresentation: {
        cameraEngagement: mode === "video" ? metric(74) : metric(null),
        professionalFraming: mode === "video" ? metric(82) : metric(null),
        centeredPresence: mode === "video" ? metric(75) : metric(null),
        postureStability: mode === "video" ? metric(76) : metric(null),
        clearFaceFromHands: { ...metric(null), applicable: false },
        gestureStability: { ...metric(null), applicable: false },
        overall: mode === "video" ? metric(76) : metric(null),
      },
      score: {},
    },
    speechMetrics:
      mode === "text"
        ? undefined
        : {
            spokenWordCount: 300,
            fillerWordCount: 8,
            pauseCount: 3,
            wordsPerMinute: 142,
            speakingPace: 142,
            transcriptDurationSeconds: 120,
            speechClarityScore: 78,
            speakingPaceWpm: 142,
            speechDeliverySummary: "Your delivery was mostly steady.",
          },
    visualMetrics:
      mode === "video"
        ? {
            cameraEnabledSeconds: 120,
            faceVisiblePercentage: 90,
            lookingAwayCount: 2,
            headMovementScore: 80,
            cameraPresenceScore: 80,
          }
        : undefined,
    ...overrides,
  };
}

function source(mode = "video", overrides = {}) {
  return {
    sessionId: "session-1",
    session: {
      id: "session-1",
      role: "Junior Software Developer",
      targetRole: "Junior Software Developer",
      type: "Role-Specific Interview",
      difficulty: "Graduate",
      mode,
      status: "completed",
      questionCount: 2,
      createdAt: "2026-07-17T10:00:00.000Z",
      completedAt: "2026-07-17T10:24:00.000Z",
      generatedQuestions: [
        { id: 1, text: "Tell me about a project." },
        { id: 2, text: "How do you debug an API?" },
      ],
    },
    report: canonicalReport(mode),
    answers: [
      {
        id: "answer-1",
        questionId: 1,
        questionText: "Tell me about a project.",
        answerText: "I built a project and tested the main workflow.",
        evaluationStatus: "completed",
        feedback: feedback(82),
      },
      {
        id: "answer-2",
        questionId: 2,
        questionText: "How do you debug an API?",
        answerText: "I check logs and inspect the network request.",
        evaluationStatus: "completed",
        feedback: feedback(78),
      },
    ],
    ...overrides,
  };
}

test("performance and answer labels use supportive centralized ranges", () => {
  assert.equal(getPerformanceLabel(95), "Excellent readiness");
  assert.equal(getPerformanceLabel(85), "Strong readiness");
  assert.equal(getPerformanceLabel(75), "Good foundation");
  assert.equal(getPerformanceLabel(65), "Developing");
  assert.equal(getPerformanceLabel(55), "Needs focused practice");
  assert.equal(getAnswerScoreLabel(59), "Needs revision");
  assert.equal(getPerformanceLabel(null), null);
});

test("complete video report builds all primary sections", () => {
  const view = buildInterviewReportViewModel(source("video"));
  assert.equal(view.status, "complete");
  assert.equal(view.overallScore, 82);
  assert.equal(view.answers.length, 2);
  assert.ok(view.speechDelivery);
  assert.ok(view.visualPresence);
  assert.equal(view.performanceLabel, "Strong readiness");
});

test("voice and text reports show only applicable delivery sections", () => {
  const voice = buildInterviewReportViewModel(source("voice"));
  const text = buildInterviewReportViewModel(source("text"));
  assert.ok(voice.speechDelivery);
  assert.equal(voice.visualPresence, null);
  assert.equal(text.speechDelivery, null);
  assert.equal(text.visualPresence, null);
});

test("legacy reports preserve stored scores without fabricating new categories", () => {
  const legacy = canonicalReport("text");
  delete legacy.scoringVersion;
  delete legacy.metricsVersion;
  delete legacy.scoreBreakdown;
  delete legacy.canonicalMetrics;
  const view = buildInterviewReportViewModel(source("text", { report: legacy }));
  assert.equal(view.isLegacy, true);
  assert.equal(view.overallScore, 82);
  assert.equal(view.methodology.scoringVersion, "legacy");
});

test("missing speech and visual metrics are unavailable rather than zero", () => {
  const report = canonicalReport("video");
  report.scoreBreakdown.speechDeliveryScore = null;
  report.scoreBreakdown.visualPresentationScore = null;
  report.scoreBreakdown.contributions[1] = contribution("speechDelivery", null, 0.2);
  report.scoreBreakdown.contributions[2] = contribution("visualPresentation", null, 0.15);
  delete report.speechMetrics;
  delete report.visualMetrics;
  const view = buildInterviewReportViewModel(source("video", { report }));
  assert.equal(view.categoryScores[1].score, null);
  assert.equal(view.categoryScores[2].score, null);
  assert.equal(view.speechDelivery, null);
  assert.equal(view.visualPresence, null);
});

test("all unavailable metrics produce no score and never fabricate zeroes", () => {
  const report = canonicalReport("video");
  report.overallScore = null;
  report.breakdown = {};
  report.scoreBreakdown.overallScore = null;
  report.scoreBreakdown.answerQualityScore = null;
  report.scoreBreakdown.speechDeliveryScore = null;
  report.scoreBreakdown.visualPresentationScore = null;
  report.scoreBreakdown.contributions = [
    contribution("answerQuality", null, 0.65),
    contribution("speechDelivery", null, 0.2),
    contribution("visualPresentation", null, 0.15),
  ];
  for (const category of [
    report.canonicalMetrics.answerQuality,
    report.canonicalMetrics.speechDelivery,
    report.canonicalMetrics.visualPresentation,
  ]) {
    for (const key of Object.keys(category)) category[key] = metric(null);
  }
  delete report.speechMetrics;
  delete report.visualMetrics;

  const view = buildInterviewReportViewModel(source("video", { report }));
  assert.equal(view.overallScore, null);
  assert.ok(view.categoryScores.every((category) => category.score === null));
  assert.ok(view.categoryScores.every((category) => category.available === false));
  assert.ok(view.unavailableMetrics.length > 0);
});

test("pending, failed, empty, and skipped answers retain distinct statuses", () => {
  const input = source("text", {
    answers: [
      {
        id: "pending",
        questionId: 1,
        questionText: "Tell me about a project.",
        answerText: "Saved response",
        evaluationStatus: "pending",
      },
      {
        id: "empty",
        questionId: 2,
        questionText: "How do you debug an API?",
        answerText: "",
        evaluationStatus: "completed",
        feedback: feedback(0, { answerValidity: "blank" }),
      },
      {
        id: "failed",
        questionId: 3,
        questionText: "Explain a trade-off.",
        answerText: "A preserved answer",
        evaluationStatus: "failed",
      },
    ],
    questions: [
      { id: 1, text: "Tell me about a project." },
      { id: 2, text: "How do you debug an API?" },
      { id: 3, text: "Explain a trade-off." },
      { id: 4, text: "Why this role?" },
    ],
  });
  const view = buildInterviewReportViewModel(input);
  assert.deepEqual(
    view.answers.map((answer) => answer.status),
    ["evaluation_pending", "empty", "evaluation_failed", "skipped"],
  );
  assert.equal(view.overallScore, null);
  assert.equal(view.status, "processing");
});

test("malformed legacy score fields never create NaN", () => {
  const malformed = canonicalReport("text");
  delete malformed.scoreBreakdown;
  delete malformed.canonicalMetrics;
  delete malformed.scoringVersion;
  malformed.overallScore = "not-a-score";
  malformed.breakdown.relevance = Number.NaN;
  const view = buildInterviewReportViewModel(source("text", { report: malformed }));
  assert.equal(view.overallScore, null);
  assert.ok(view.categoryScores.every((category) => !Number.isNaN(category.score)));
});

test("answer-quality evaluation failure prevents an overall score", () => {
  const input = source("video");
  input.report.scoreBreakdown.overallScore = null;
  input.report.scoreBreakdown.answerQualityScore = null;
  input.answers = input.answers.map((answer) => ({
    ...answer,
    feedback: null,
    evaluationStatus: "failed",
  }));
  const view = buildInterviewReportViewModel(input);
  assert.equal(view.overallScore, null);
  assert.equal(view.status, "empty");
});

test("priority ranking keeps repeated answer specificity above visual coaching", () => {
  const input = source("video");
  input.answers = input.answers.map((answer) => ({
    ...answer,
    feedback: feedback(72, {
      weaknesses: ["Add a specific example and measurable result."],
    }),
  }));
  input.report.canonicalMetrics.visualPresentation.cameraEngagement = metric(45);
  const view = buildInterviewReportViewModel(input);
  assert.equal(view.priorities[0].id, "specific-outcomes");
  assert.deepEqual(view.priorities[0].relatedQuestionNumbers, [1, 2]);
});

test("practice plan responds to priorities, skipped questions, mode, and role", () => {
  const input = source("text", {
    questions: [
      { id: 1, text: "Tell me about a project." },
      { id: 2, text: "How do you debug an API?" },
      { id: 3, text: "Why this role?" },
    ],
    answers: [source("text").answers[0]],
  });
  const view = buildInterviewReportViewModel(input);
  assert.ok(view.practicePlan.some((step) => step.id === "complete-skipped"));
  assert.ok(view.practicePlan.some((step) => step.id === "speak-one-answer"));
  assert.match(view.practicePlan.at(-1).title, /Junior Software Developer/);
});

test("methodology exposes versions and the availability rule", () => {
  const view = buildInterviewReportViewModel(source("video"));
  assert.equal(view.methodology.metricsVersion, "interview-metrics-v3");
  assert.equal(view.methodology.scoringVersion, "interview-score-v3");
  assert.match(view.methodology.scoringSummary, /Unavailable|unavailable/);
  assert.ok(view.methodology.limitations.length >= 5);
});

test("date and duration formatting are deterministic and defensive", () => {
  assert.equal(formatReportDate("2026-07-17T10:00:00.000Z"), "17 July 2026");
  assert.equal(formatReportDate("invalid"), "Date unavailable");
  assert.equal(formatReportDuration(24 * 60_000), "24 min");
  assert.equal(formatReportDuration(90 * 60_000), "1 hr 30 min");
  assert.equal(formatReportDuration(null), null);
});
