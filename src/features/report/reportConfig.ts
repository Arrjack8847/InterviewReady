export const REPORT_PERFORMANCE_LABELS = [
  { minimum: 90, label: "Excellent readiness" },
  { minimum: 80, label: "Strong readiness" },
  { minimum: 70, label: "Good foundation" },
  { minimum: 60, label: "Developing" },
  { minimum: 0, label: "Needs focused practice" },
] as const;

export const REPORT_ANSWER_LABELS = [
  { minimum: 90, label: "Excellent" },
  { minimum: 80, label: "Strong" },
  { minimum: 70, label: "Good" },
  { minimum: 60, label: "Developing" },
  { minimum: 0, label: "Needs revision" },
] as const;

export const REPORT_PRIORITY_ORDER = {
  repeatedContentSpecificity: 1,
  answerStructure: 2,
  relevanceOrCompleteness: 3,
  speechFlow: 4,
  fillerOrPace: 5,
  visualPresentation: 6,
  audioEnvironment: 7,
} as const;

export const REPORT_LIMITATIONS = [
  "Answer scoring combines AI-assisted evaluation with deterministic score composition.",
  "Speech measurements depend on browser transcription, language support, and microphone conditions.",
  "Browser Speech Recognition may manage microphone capture independently from local audio-level analysis.",
  "Visual measurements use approximate webcam landmarks and can vary with camera angle, lighting, clothing, mobility, and visibility.",
  "Unavailable measurements are excluded and never treated as zero.",
  "Delivery and visual presentation have less influence than answer quality.",
  "This report supports practice and coaching; it is not a hiring decision or proof of employability.",
] as const;

export function getPerformanceLabel(score: number | null) {
  if (score === null || !Number.isFinite(score)) return null;
  return REPORT_PERFORMANCE_LABELS.find((range) => score >= range.minimum)?.label ?? null;
}

export function getAnswerScoreLabel(score: number | null) {
  if (score === null || !Number.isFinite(score)) return null;
  return REPORT_ANSWER_LABELS.find((range) => score >= range.minimum)?.label ?? null;
}
