import {
  selectAnswerQualityScore,
  selectOverallScore,
  selectScoreBreakdown,
  selectSpeechDeliveryScore,
  selectUnavailableMetrics,
  selectVisualPresentationScore,
} from "../interview/scoring/scoreSelectors";
import { INTERVIEW_SCORING_CONFIG } from "../interview/scoring/scoringConfig";
import type { MetricValue } from "../interview/scoring/scoringTypes";
import { getQuestionIdentityKey } from "../../lib/types";
import type { Feedback, FinalReport, Question } from "@/lib/types";
import { readPersistedAnswerMetrics } from "../interview/scoring/answerMetricCompatibility";
import {
  getAnswerScoreLabel,
  getPerformanceLabel,
  REPORT_LIMITATIONS,
  REPORT_PRIORITY_ORDER,
} from "./reportConfig";
import type {
  InterviewReportSource,
  InterviewReportViewModel,
  ReportAnswerReview,
  ReportAnswerSource,
  ReportAnswerStatus,
  ReportCategoryScore,
  ReportDeliverySection,
  ReportMetricRow,
  ReportPracticeStep,
  ReportPriority,
} from "./reportTypes";

type PriorityCandidate = ReportPriority & {
  evidenceCount: number;
};

const ANSWER_METRIC_LABELS = {
  relevance: "Relevance",
  completeness: "Completeness",
  structure: "Structure",
  specificity: "Specificity",
  technicalAccuracy: "Role-specific knowledge",
} as const;

const SPEECH_METRIC_LABELS = {
  speakingPace: "Speaking pace",
  answerFlow: "Answer flow",
  fillerControl: "Filler control",
  volumeConsistency: "Volume consistency",
  audioClarity: "Audio clarity",
} as const;

const VISUAL_METRIC_LABELS = {
  cameraEngagement: "Camera engagement",
  professionalFraming: "Professional framing",
  centeredPresence: "Centered presence",
  postureStability: "Posture stability",
  clearFaceFromHands: "Clear face from hands",
  gestureStability: "Gesture stability",
} as const;

const clampScore = (value: number) => Math.round(Math.min(Math.max(value, 0), 100));

function finiteNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "") ||
    (typeof value !== "number" && typeof value !== "string")
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeStoredScore(value: unknown, scale?: unknown): number | null {
  const score = finiteNumber(value);

  if (score === null) {
    return null;
  }

  const normalizedScale = scale === "hundred" || Number(scale) === 100 ? "hundred" : "ten";

  return clampScore(normalizedScale === "hundred" || score > 10 ? score : score * 10);
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : []))
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeMode(value?: string): "text" | "voice" | "video" {
  const mode = String(value || "text").toLowerCase();

  return mode === "voice" || mode === "video" ? mode : "text";
}

export function formatReportDate(value?: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatReportDuration(durationMs?: number | null) {
  if (!Number.isFinite(durationMs) || Number(durationMs) <= 0) {
    return null;
  }

  const totalMinutes = Math.max(1, Math.round(Number(durationMs) / 60_000));

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function metricInterpretation(score: number | null, label: string) {
  if (score === null) {
    return `${label} was not measured.`;
  }

  if (score >= 85) {
    return `${label} was a consistent strength.`;
  }

  if (score >= 70) {
    return `${label} provided a solid foundation.`;
  }

  return `${label} is a useful area for focused practice.`;
}

function metricRow(
  key: string,
  label: string,
  metric?: MetricValue,
  valueLabel?: string,
): ReportMetricRow {
  const measurable = Boolean(metric?.applicable && metric.measurable && metric.value !== null);

  const score = measurable ? clampScore(metric!.value!) : null;

  return {
    key,
    label,
    score,
    valueLabel: measurable ? valueLabel : undefined,
    interpretation: measurable
      ? metricInterpretation(score, label)
      : metric?.reason || `${label} was not measured.`,
    measurable,
  };
}

function legacyMetricRow(key: string, label: string, value: unknown): ReportMetricRow {
  const score = finiteNumber(value);
  const normalized = score === null ? null : clampScore(score);

  return {
    key,
    label,
    score: normalized,
    measurable: normalized !== null,
    interpretation: metricInterpretation(normalized, label),
  };
}

function getFeedbackRecord(answer: ReportAnswerSource) {
  return (answer.feedback || null) as (Partial<Feedback> & Record<string, unknown>) | null;
}

function answerScore(answer: ReportAnswerSource) {
  const feedback = getFeedbackRecord(answer);
  const scale = feedback?.scoreScale ?? answer.scores?.scoreScale;

  return normalizeStoredScore(
    feedback?.overall ?? feedback?.overallScore ?? answer.scores?.overall,
    scale,
  );
}

function answerMetricScore(answer: ReportAnswerSource, key: string) {
  const feedback = getFeedbackRecord(answer);
  const scale = feedback?.scoreScale ?? answer.scores?.scoreScale;

  return normalizeStoredScore(
    feedback?.[key] ?? feedback?.[`${key}Score`] ?? answer.scores?.[key],
    scale,
  );
}

function answerStatus(answer: ReportAnswerSource, score: number | null): ReportAnswerStatus {
  const feedback = getFeedbackRecord(answer);

  if (!answer.answerText.trim() || feedback?.answerValidity === "blank") {
    return "empty";
  }

  if (answer.evaluationStatus === "pending") {
    return "evaluation_pending";
  }

  if (!feedback && score === null) {
    return "evaluation_failed";
  }

  if (!feedback && score !== null) {
    return "legacy";
  }

  return score === null ? "evaluation_failed" : "completed";
}

type TechnicalQuestionSubtype =
  | "comparison"
  | "troubleshooting"
  | "design"
  | "implementation"
  | "process"
  | "definition"
  | "general";

function classifyTechnicalQuestionSubtype(question: string): TechnicalQuestionSubtype {
  const text = String(question || "").toLowerCase();

  if (
    /\b(difference|differences|compare|comparison|versus|vs\.?|distinguish|between)\b/i.test(text)
  ) {
    return "comparison";
  }

  if (
    /\b(unable|cannot|can't|not working|failed|failure|error|issue|problem|troubleshoot|debug|fix|access|recover)\b/i.test(
      text,
    )
  ) {
    return "troubleshooting";
  }

  if (
    /\b(design|architecture|architect|scalable|scalability|high availability|system design)\b/i.test(
      text,
    )
  ) {
    return "design";
  }

  if (
    /\b(implement|implementation|write code|function|algorithm|complexity|program)\b/i.test(text)
  ) {
    return "implementation";
  }

  if (/\b(how does|how do|process|steps|workflow|lifecycle)\b/i.test(text)) {
    return "process";
  }

  if (/\b(what is|define|definition|meaning|explain)\b/i.test(text)) {
    return "definition";
  }

  return "general";
}

function recommendedStructure(category: string, question = ""): string[] {
  if (category === "Role-Specific") {
    const subtype = classifyTechnicalQuestionSubtype(question);

    switch (subtype) {
      case "comparison":
        return [
          "Define both",
          "Key differences",
          "Strengths",
          "Limitations",
          "Use cases",
          "Conclusion",
        ];

      case "troubleshooting":
        return [
          "Confirm symptoms",
          "Likely causes",
          "Diagnostic checks",
          "Solution",
          "Verification",
          "Escalation",
        ];

      case "design":
        return [
          "Requirements",
          "Constraints",
          "Components",
          "Data flow",
          "Security",
          "Trade-offs",
          "Scaling",
        ];

      case "implementation":
        return ["Inputs", "Approach", "Implementation", "Complexity", "Edge cases", "Testing"];

      case "process":
        return ["Definition", "Main steps", "Purpose", "Important details", "Example", "Result"];

      case "definition":
        return [
          "Direct definition",
          "Key characteristics",
          "Why it matters",
          "Example",
          "Use case",
        ];

      default:
        return [
          "Direct answer",
          "Professional explanation",
          "Supporting detail",
          "Example",
          "Trade-offs",
          "Conclusion",
        ];
    }
  }

  switch (category) {
    case "Behavioral":
      return ["Situation", "Task", "Action", "Result", "Reflection"];

    case "Situational":
      return ["Clarify", "Prioritize", "Action", "Communication", "Verification"];

    case "Motivational":
      return [
        "Motivation",
        "Relevant skills",
        "Role connection",
        "Career direction",
        "Contribution",
      ];

    default:
      return ["Direct opening", "Supporting detail", "Specific example", "Clear conclusion"];
  }
}

function categoryLabel(answer: ReportAnswerSource) {
  const questionType = String(getFeedbackRecord(answer)?.questionType || "general");

  return questionType === "behavioural"
    ? "Behavioral"
    : questionType === "technical"
      ? "Role-Specific"
      : `${questionType.charAt(0).toUpperCase()}${questionType.slice(1)}`;
}

function buildAnswerReview(
  answer: ReportAnswerSource,
  questionNumber: number,
  isLegacyReport: boolean,
): ReportAnswerReview {
  const feedback = getFeedbackRecord(answer);

  const score = answerScore(answer);
  const status = answerStatus(answer, score);

  const category = categoryLabel(answer);

  const strengths = uniqueStrings([answer.strengths, feedback?.strengths]);

  const improvements = uniqueStrings([
    answer.weaknesses,
    feedback?.weaknesses,
    feedback?.improvements,
  ]);

  const summary = String(answer.summary || feedback?.summary || "").trim();

  const statusAssessment: Record<ReportAnswerStatus, string> = {
    completed: summary || `${getAnswerScoreLabel(score) || "This answer"} response overall.`,

    skipped: "This question was skipped and was not included in the score.",

    empty: "There was not enough response to evaluate this answer reliably.",

    evaluation_pending: "Feedback is still being prepared for this saved answer.",

    evaluation_failed: "The answer was preserved, but feedback is temporarily unavailable.",

    legacy: summary || "This answer uses the feedback available in a legacy report.",
  };

  const contentLabel = category === "Role-Specific" ? "Role-specific knowledge" : "Answer content";

  const persistedMetrics = readPersistedAnswerMetrics(
    feedback?.answerMetrics,
    answer.scores?.answerMetrics,
  );

  const persistedRows = [
    ["speechDelivery", "Speech delivery"],
    ["audioQuality", "Audio quality"],
    ["visualPresentation", "Visual presentation"],
  ]
    .map(([key, label]) => {
      const measurementStatus =
        persistedMetrics?.measurementStatus[
          key as "speechDelivery" | "audioQuality" | "visualPresentation"
        ];

      if (!measurementStatus || measurementStatus === "not_applicable") {
        return null;
      }

      const value =
        persistedMetrics?.normalized[
          key as "speechDelivery" | "audioQuality" | "visualPresentation"
        ];

      return legacyMetricRow(key, label, measurementStatus === "measured" ? value : null);
    })
    .filter((metric): metric is ReportMetricRow => Boolean(metric));

  return {
    id: answer.id || `question-${answer.questionId}`,

    questionId: answer.questionId,

    questionNumber,

    question: answer.questionText || `Question ${questionNumber}`,

    category,

    status: isLegacyReport && status === "completed" ? "legacy" : status,

    score,

    scoreLabel: getAnswerScoreLabel(score),

    assessment: statusAssessment[status],

    answerText: answer.answerText,

    strengths,

    improvements,

    recommendedStructure: recommendedStructure(category, answer.questionText || ""),

    improvedAnswer: String(answer.improvedAnswer || feedback?.improvedAnswer || "").trim() || null,

    interviewTip: String(answer.interviewTip || feedback?.interviewTip || "").trim() || null,

    metrics: [
      legacyMetricRow("relevance", "Relevance", answerMetricScore(answer, "relevance")),
      legacyMetricRow("structure", "Structure", answerMetricScore(answer, "structure")),
      legacyMetricRow("clarity", "Clarity", answerMetricScore(answer, "clarity")),
      legacyMetricRow("content", contentLabel, answerMetricScore(answer, "technicalAccuracy")),
      ...persistedRows,
    ].filter((metric) => metric.measurable),
  };
}

function createSkippedReview(question: Question, questionNumber: number): ReportAnswerReview {
  return {
    id: `skipped-${question.id}`,
    questionId: question.id,
    questionNumber,
    question: question.text,
    category: "General",
    status: "skipped",
    score: null,
    scoreLabel: null,
    assessment: "This question was skipped and was not included in the score.",
    answerText: "",
    strengths: [],
    improvements: [],
    recommendedStructure: recommendedStructure("General", question.text),
    improvedAnswer: null,
    interviewTip: null,
    metrics: [],
  };
}

function mergeAnswersAndQuestions(
  answers: ReportAnswerSource[],
  questions: Question[],
  isLegacy: boolean,
) {
  const answerByQuestion = new Map(
    answers.map((answer) => [getQuestionIdentityKey(answer.questionId), answer]),
  );

  const orderedQuestions = questions.length
    ? questions
    : answers.map((answer) => ({
        id: answer.questionId,
        text: answer.questionText,
      }));

  const reviews = orderedQuestions.map((question, index) => {
    const answer = answerByQuestion.get(getQuestionIdentityKey(question.id));

    return answer
      ? buildAnswerReview(answer, index + 1, isLegacy)
      : createSkippedReview(question, index + 1);
  });

  const knownIds = new Set(orderedQuestions.map((question) => question.id));

  for (const answer of answers) {
    if (!knownIds.has(answer.questionId)) {
      reviews.push(buildAnswerReview(answer, reviews.length + 1, isLegacy));
    }
  }

  return reviews;
}

function averageLegacyAnswerScore(report: FinalReport | null) {
  if (!report?.breakdown) {
    return report ? finiteNumber(report.overallScore) : null;
  }

  const values = [
    report.breakdown.relevance,
    report.breakdown.clarity,
    report.breakdown.structure,
    report.breakdown.technicalAccuracy,
  ].filter((value): value is number => Number.isFinite(value));

  return values.length
    ? clampScore(values.reduce((total, value) => total + value, 0) / values.length)
    : finiteNumber(report.overallScore);
}

function canonicalRows(
  values: object | undefined,
  labels: Record<string, string>,
  valueLabels: Record<string, string | undefined> = {},
) {
  const metricValues = values as Record<string, MetricValue | undefined> | undefined;

  return Object.entries(labels).map(([key, label]) =>
    metricRow(key, label, metricValues?.[key], valueLabels[key]),
  );
}

function buildCategories(
  report: FinalReport | null,
  mode: "text" | "voice" | "video",
): ReportCategoryScore[] {
  const canonical = report?.canonicalMetrics;

  const breakdown = selectScoreBreakdown(report);

  const weights = INTERVIEW_SCORING_CONFIG.topLevelWeights[mode];

  const contributionFor = (key: string) =>
    breakdown?.contributions.find((item) => item.key === key);

  const answerScore = selectAnswerQualityScore(report) ?? averageLegacyAnswerScore(report);

  const speechScore = mode === "text" ? null : selectSpeechDeliveryScore(report);

  const visualScore = mode === "video" ? selectVisualPresentationScore(report) : null;

  const speechWpm = finiteNumber(
    report?.speechMetrics?.speakingPaceWpm ?? report?.speechMetrics?.wordsPerMinute,
  );

  const answerRows = canonical?.answerQuality
    ? canonicalRows(canonical.answerQuality, ANSWER_METRIC_LABELS)
    : report
      ? [
          legacyMetricRow("relevance", "Relevance", report.breakdown.relevance),
          legacyMetricRow("clarity", "Clarity", report.breakdown.clarity),
          legacyMetricRow("structure", "Structure", report.breakdown.structure),
          legacyMetricRow(
            "technicalAccuracy",
            "Answer content",
            report.breakdown.technicalAccuracy,
          ),
        ]
      : [];

  const speechRows = canonicalRows(canonical?.speechDelivery, SPEECH_METRIC_LABELS, {
    speakingPace: speechWpm === null ? undefined : `${Math.round(speechWpm)} words per minute`,
  });

  const visualRows = canonicalRows(canonical?.visualPresentation, VISUAL_METRIC_LABELS);

  const definitions = [
    {
      key: "answerQuality" as const,
      label: "Answer quality",
      score: answerScore,
      metrics: answerRows,
    },
    {
      key: "speechDelivery" as const,
      label: "Speech delivery",
      score: speechScore,
      metrics: speechRows,
    },
    {
      key: "visualPresentation" as const,
      label: "Visual presence",
      score: visualScore,
      metrics: visualRows,
    },
  ];

  const availableConfiguredWeight = definitions.reduce(
    (total, category) => total + (category.score === null ? 0 : weights[category.key]),
    0,
  );

  return definitions.map((category) => {
    const contribution = contributionFor(category.key);

    const available = category.score !== null;

    const effectiveWeight =
      contribution?.effectiveWeight ??
      (available && availableConfiguredWeight > 0
        ? weights[category.key] / availableConfiguredWeight
        : 0);

    return {
      ...category,
      available,

      configuredWeight: contribution?.configuredWeight ?? weights[category.key],

      effectiveWeight,

      contribution:
        contribution?.contribution ??
        (category.score === null ? 0 : category.score * effectiveWeight),

      interpretation: available
        ? metricInterpretation(category.score, category.label)
        : `${category.label} was not measured and did not reduce the overall score.`,
    };
  });
}

function containsAny(value: string, terms: string[]) {
  const normalized = value.toLowerCase();

  return terms.some((term) => normalized.includes(term));
}

function relatedQuestions(answers: ReportAnswerReview[], terms: string[]) {
  return answers
    .filter((answer) => answer.improvements.some((item) => containsAny(item, terms)))
    .map((answer) => answer.questionNumber);
}

function buildPriorities(
  answers: ReportAnswerReview[],
  categories: ReportCategoryScore[],
): ReportPriority[] {
  const candidates: PriorityCandidate[] = [];

  const answerCategory = categories.find((category) => category.key === "answerQuality");

  const speechCategory = categories.find((category) => category.key === "speechDelivery");

  const visualCategory = categories.find((category) => category.key === "visualPresentation");

  const answerMetric = (key: string) =>
    answerCategory?.metrics.find((metric) => metric.key === key)?.score ?? null;

  const speechMetric = (key: string) =>
    speechCategory?.metrics.find((metric) => metric.key === key)?.score ?? null;

  const visualMetric = (key: string) =>
    visualCategory?.metrics.find((metric) => metric.key === key)?.score ?? null;

  const add = (candidate: PriorityCandidate, condition: boolean) => {
    if (condition) {
      candidates.push(candidate);
    }
  };

  const specificityTerms = ["specific", "example", "result", "outcome", "detail", "measur"];

  const structureTerms = ["structure", "star", "sequence", "organis", "organization"];

  const relevanceTerms = ["relevance", "direct", "complete", "question", "explain more"];

  const specificityQuestions = relatedQuestions(answers, specificityTerms);

  const structureQuestions = relatedQuestions(answers, structureTerms);

  const relevanceQuestions = relatedQuestions(answers, relevanceTerms);

  add(
    {
      id: "specific-outcomes",

      rank: REPORT_PRIORITY_ORDER.repeatedContentSpecificity,

      evidenceCount: specificityQuestions.length,

      title: "Add specific outcomes",

      whyItMatters:
        "Concrete results make an answer more credible, memorable, and easier to assess.",

      evidence: specificityQuestions.length
        ? `${specificityQuestions.length} answer${
            specificityQuestions.length === 1 ? "" : "s"
          } asked for more specific evidence or outcomes.`
        : "Specificity was one of the lowest measured answer-quality dimensions.",

      nextStep: "End each example with a result, measurable impact, or clear lesson.",

      relatedQuestionNumbers: specificityQuestions,

      source: "answer",
    },

    specificityQuestions.length >= 2 || (answerMetric("specificity") ?? 100) < 70,
  );

  add(
    {
      id: "answer-structure",

      rank: REPORT_PRIORITY_ORDER.answerStructure,

      evidenceCount: structureQuestions.length,

      title: "Make the answer easier to follow",

      whyItMatters: "A clear sequence helps the interviewer understand your decisions and impact.",

      evidence: structureQuestions.length
        ? `${structureQuestions.length} answer${
            structureQuestions.length === 1 ? "" : "s"
          } contained structure-related feedback.`
        : "Structure was below the target coaching range.",

      nextStep: "Plan a one-sentence opening, two or three actions, and a concise result.",

      relatedQuestionNumbers: structureQuestions,

      source: "answer",
    },

    structureQuestions.length > 0 || (answerMetric("structure") ?? 100) < 70,
  );

  add(
    {
      id: "answer-relevance",

      rank: REPORT_PRIORITY_ORDER.relevanceOrCompleteness,

      evidenceCount: relevanceQuestions.length,

      title: "Answer the question more directly",

      whyItMatters: "A direct opening establishes relevance before supporting details are added.",

      evidence: relevanceQuestions.length
        ? `${relevanceQuestions.length} answer${
            relevanceQuestions.length === 1 ? "" : "s"
          } needed a more direct or complete response.`
        : "Relevance or completeness was below the target coaching range.",

      nextStep: "Begin with your main point, then support it with one relevant example.",

      relatedQuestionNumbers: relevanceQuestions,

      source: "answer",
    },

    relevanceQuestions.length > 0 ||
      (answerMetric("relevance") ?? 100) < 70 ||
      (answerMetric("completeness") ?? 100) < 70,
  );

  add(
    {
      id: "speech-flow",

      rank: REPORT_PRIORITY_ORDER.speechFlow,

      evidenceCount: 1,

      title: "Strengthen answer flow",

      whyItMatters: "A planned opening and deliberate pauses make spoken answers easier to follow.",

      evidence: "Answer flow was below the target coaching range for measurable speech.",

      nextStep: "Pause briefly before speaking and state the main point in your first sentence.",

      relatedQuestionNumbers: [],

      source: "speech",
    },

    (speechMetric("answerFlow") ?? 100) < 70,
  );

  const fillerScore = speechMetric("fillerControl");

  const paceScore = speechMetric("speakingPace");

  add(
    {
      id: "speech-pace-fillers",

      rank: REPORT_PRIORITY_ORDER.fillerOrPace,

      evidenceCount: 1,

      title:
        fillerScore !== null && fillerScore < 70
          ? "Replace fillers with a pause"
          : "Use a steadier pace",

      whyItMatters: "Deliberate pacing gives important ideas more space and improves clarity.",

      evidence:
        fillerScore !== null && fillerScore < 70
          ? "Filler control was below the target coaching range."
          : "Speaking pace was outside the target coaching range.",

      nextStep:
        "Rehearse a 60–90 second answer and use a silent pause when planning the next phrase.",

      relatedQuestionNumbers: [],

      source: "speech",
    },

    (fillerScore ?? 100) < 70 || (paceScore ?? 100) < 70,
  );

  const weakestVisual = visualCategory?.metrics
    .filter((metric) => metric.measurable && metric.score !== null)
    .sort((left, right) => left.score! - right.score!)[0];

  add(
    {
      id: "visual-presence",

      rank: REPORT_PRIORITY_ORDER.visualPresentation,

      evidenceCount: 1,

      title: "Refine your camera setup",

      whyItMatters:
        "A stable frame supports clear communication without changing the substance of the answer.",

      evidence: `${
        weakestVisual?.label || "Visual presence"
      } was the clearest visual coaching opportunity.`,

      nextStep:
        "Place the interview window near the camera and check framing before the next video session.",

      relatedQuestionNumbers: [],

      source: "visual",
    },

    Boolean(weakestVisual && weakestVisual.score! < 70),
  );

  add(
    {
      id: "audio-environment",

      rank: REPORT_PRIORITY_ORDER.audioEnvironment,

      evidenceCount: 1,

      title: "Improve the recording environment",

      whyItMatters: "Clear audio helps the system and the listener follow the answer reliably.",

      evidence: "Audio clarity was below the target coaching range.",

      nextStep: "Use a quieter space and keep a consistent distance from the microphone.",

      relatedQuestionNumbers: [],

      source: "audio",
    },

    (speechMetric("audioClarity") ?? 100) < 70,
  );

  if (!candidates.length) {
    candidates.push({
      id: "extend-strengths",
      rank: 8,
      evidenceCount: 0,

      title: "Build on your strongest answers",

      whyItMatters: "Repeating a strong structure makes good performance more consistent.",

      evidence: "No major repeated weakness was detected in the available coaching data.",

      nextStep: "Choose your strongest answer and reuse its structure with a different example.",

      relatedQuestionNumbers: [],

      source: "answer",
    });
  }

  return candidates
    .sort((left, right) => left.rank - right.rank || right.evidenceCount - left.evidenceCount)
    .slice(0, 3)
    .map(({ evidenceCount: _evidenceCount, ...priority }) => priority);
}

function buildPracticePlan(
  priorities: ReportPriority[],
  answers: ReportAnswerReview[],
  mode: "text" | "voice" | "video",
  role: string,
  categories: ReportCategoryScore[],
): ReportPracticeStep[] {
  const steps: ReportPracticeStep[] = priorities.slice(0, 2).map((priority, index) => ({
    id: `priority-${index + 1}`,
    title: priority.title,
    detail: priority.nextStep,
  }));

  const skipped = answers.filter((answer) => answer.status === "skipped");

  if (skipped.length) {
    steps.push({
      id: "complete-skipped",

      title: "Complete the skipped questions",

      detail: `Prepare concise responses for question${skipped.length === 1 ? "" : "s"} ${skipped
        .map((answer) => answer.questionNumber)
        .join(", ")}.`,
    });
  }

  const speech = categories.find((category) => category.key === "speechDelivery");

  const visual = categories.find((category) => category.key === "visualPresentation");

  if (mode !== "text" && !speech?.available) {
    steps.push({
      id: "speech-capture",
      title: "Capture a complete spoken answer",
      detail: "Check microphone access, then record at least one 60–90 second response.",
    });
  } else if (mode === "text") {
    steps.push({
      id: "speak-one-answer",
      title: "Say one answer out loud",
      detail: "Use voice mode next time to practise delivery after refining the content.",
    });
  }

  if (mode === "video" && !visual?.available) {
    steps.push({
      id: "visual-capture",
      title: "Check the camera setup",
      detail: "Allow camera access and keep a clear frame for at least ten measurable seconds.",
    });
  }

  steps.push({
    id: "repeat-role-session",

    title: `Repeat a focused ${role} session`,

    detail:
      "Use new examples while applying the two priorities above; keep the original report for comparison.",
  });

  return Array.from(new Map(steps.map((step) => [step.id, step])).values()).slice(0, 5);
}

function buildDeliverySections(
  report: FinalReport | null,
  categories: ReportCategoryScore[],
  mode: "text" | "voice" | "video",
) {
  const speechCategory = categories.find((category) => category.key === "speechDelivery");

  const visualCategory = categories.find((category) => category.key === "visualPresentation");

  const speechMetrics = report?.speechMetrics;

  const visualMetrics = report?.visualMetrics;

  const speech: ReportDeliverySection | null =
    mode === "text" || (!speechCategory?.available && !speechMetrics)
      ? null
      : {
          score: speechCategory?.score ?? null,

          summary:
            speechMetrics?.speechDeliverySummary ||
            (speechCategory?.available
              ? "Available speech measurements were combined into one delivery score."
              : "Speech delivery was not measured reliably for this session."),

          metrics: speechCategory?.metrics || [],
        };

  const visual: ReportDeliverySection | null =
    mode !== "video" || (!visualCategory?.available && !visualMetrics)
      ? null
      : {
          score: visualCategory?.score ?? null,

          summary: visualCategory?.available
            ? "Visual presence reflects approximate coaching signals during measurable completed answers."
            : "Visual presence was not measured reliably for this session.",

          metrics: visualCategory?.metrics || [],
        };

  return {
    speech,
    visual,
  };
}

function buildIntegrityNotes(report: FinalReport | null) {
  const integrity = report?.integrityMetrics || report?.canonicalMetrics?.integrity;

  if (!integrity) {
    return [];
  }

  const notes = [];

  if (Number(integrity.pauseCount || 0) > 0) {
    notes.push({
      id: "pauses",

      text: `The interview was paused ${integrity.pauseCount} time${
        integrity.pauseCount === 1 ? "" : "s"
      }.`,
    });
  }

  if (Number(integrity.noFaceEventCount || 0) > 0 || Number(integrity.noFaceDurationMs || 0) > 0) {
    notes.push({
      id: "no-face",

      text: "Some camera time was unavailable because no face was measurable. This was kept separate from the coaching score.",
    });
  }

  if (
    Number(integrity.multipleFaceEventCount || 0) > 0 ||
    Number(integrity.multipleFaceDurationMs || 0) > 0
  ) {
    notes.push({
      id: "multiple-face",

      text: "The session paused when more than one face was detected and resumed after camera recovery.",
    });
  }

  if (Number(integrity.analysisErrorCount || 0) > 0) {
    notes.push({
      id: "analysis-errors",

      text: "Some visual analysis samples were unavailable because of browser or landmark-processing errors.",
    });
  }

  return notes;
}

function strongestArea(categories: ReportCategoryScore[]) {
  const measuredMetrics = categories.flatMap((category) =>
    category.metrics.filter((metric) => metric.measurable && metric.score !== null),
  );

  const strongestMetric = measuredMetrics.sort((left, right) => right.score! - left.score!)[0];

  if (strongestMetric) {
    return strongestMetric.label;
  }

  return (
    categories
      .filter((category) => category.available)
      .sort((left, right) => right.score! - left.score!)[0]?.label || "Completed answers"
  );
}

export function buildInterviewReportViewModel(
  source: InterviewReportSource,
): InterviewReportViewModel {
  const session = source.session || null;

  const report = source.report || session?.finalReport || null;

  const setup = source.cachedSetup || null;

  const mode = normalizeMode(session?.mode || setup?.mode);

  const isLegacy = Boolean(report && !report.scoringVersion && !report.scoreBreakdown);

  const questions = source.questions?.length ? source.questions : session?.generatedQuestions || [];

  const answers = mergeAnswersAndQuestions(source.answers || [], questions, isLegacy);

  const completedAnswers = answers.filter(
    (answer) => answer.status === "completed" || answer.status === "legacy",
  );

  const pendingAnswers = answers.filter((answer) => answer.status === "evaluation_pending");

  const failedAnswers = answers.filter((answer) => answer.status === "evaluation_failed");

  const skippedAnswers = answers.filter((answer) => answer.status === "skipped");

  const categories = buildCategories(report, mode);

  const priorities = buildPriorities(answers, categories);

  const role =
    session?.targetRole || setup?.targetRole || session?.role || setup?.role || "Interview";

  const baseRole = session?.role || setup?.role || role;

  const createdAt = session?.createdAt ? new Date(session.createdAt).getTime() : Number.NaN;

  const completedAt = session?.completedAt ? new Date(session.completedAt).getTime() : Number.NaN;

  const durationMs =
    Number.isFinite(createdAt) && Number.isFinite(completedAt) && completedAt >= createdAt
      ? completedAt - createdAt
      : null;

  const overallCandidate = finiteNumber(
    report ? selectOverallScore(report) : session?.overallScore,
  );

  const overallScore = completedAnswers.length ? overallCandidate : null;

  const performanceLabel = getPerformanceLabel(overallScore);

  const strongest = strongestArea(categories);

  const practicePlan = buildPracticePlan(priorities, answers, mode, role, categories);

  const delivery = buildDeliverySections(report, categories, mode);

  const unavailableMetrics = report
    ? selectUnavailableMetrics(report).map((metric) => metric.label)
    : categories.filter((category) => !category.available).map((category) => category.label);

  const status =
    completedAnswers.length === 0 && pendingAnswers.length === 0
      ? "empty"
      : pendingAnswers.length > 0 && completedAnswers.length === 0
        ? "processing"
        : pendingAnswers.length > 0 || failedAnswers.length > 0 || !report
          ? "partially_complete"
          : "complete";

  const primaryImprovement = priorities[0]?.title || "Keep practising consistently";

  const recommendedAction = practicePlan[0]?.detail || "Repeat the session with a new example.";

  const summary =
    overallScore === null
      ? "There is not enough completed evaluation data to produce an overall readiness score yet."
      : `${performanceLabel}. ${strongest} was the strongest available coaching signal. The clearest next opportunity is to ${primaryImprovement.toLowerCase()}.`;

  const scoringVersion =
    report?.scoringVersion || report?.scoreBreakdown?.scoringVersion || "legacy";

  const metricsVersion =
    report?.metricsVersion || report?.canonicalMetrics?.metricsVersion || "legacy";

  return {
    sessionId: source.sessionId || session?.id || "",

    title: `${role} practice interview`,

    role: baseRole,

    targetRole: role,

    targetCompany: session?.targetCompany || setup?.targetCompany || null,

    interviewType: session?.interviewType || session?.type || setup?.type || "Practice interview",

    difficulty: session?.difficulty || setup?.difficulty || "Not specified",

    interviewMode: mode,

    completedAt: session?.completedAt || null,

    completedAtLabel: formatReportDate(session?.completedAt),

    durationMs,

    durationLabel: formatReportDuration(durationMs),

    completedQuestionCount: completedAnswers.length,

    totalQuestionCount:
      questions.length || session?.questionCount || setup?.questionCount || answers.length,

    skippedQuestionCount: skippedAnswers.length,

    status,

    overallScore,

    performanceLabel,

    summary,

    strongestArea: strongest,

    primaryImprovement,

    recommendedAction,

    categoryScores: categories,

    priorities,

    answers,

    speechDelivery: delivery.speech,

    visualPresence: delivery.visual,

    integrityNotes: buildIntegrityNotes(report),

    unavailableMetrics: Array.from(new Set(unavailableMetrics)),

    practicePlan,

    methodology: {
      metricsVersion,
      scoringVersion,
      isLegacy,

      scoringSummary:
        "Answer quality has the greatest influence. Available delivery and visual signals provide secondary coaching, and unavailable measurements are excluded.",

      limitations: [...REPORT_LIMITATIONS],
    },

    isLegacy,

    dataWarning: source.dataWarning || null,

    debugData: {
      scoreBreakdown: selectScoreBreakdown(report),

      categoryScores: categories,

      priorities,

      status,
    },
  };
}
