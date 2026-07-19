import type {
  AnswerScoreBreakdown,
  InterviewIntegrityMetrics,
  PersistedAnswerMetrics,
  SessionInterviewMetrics,
} from "@/features/interview/scoring/scoringTypes";

/**
 * A job role can be any valid job title entered by the user.
 *
 * Examples:
 * - Software Developer Intern
 * - Medical Officer
 * - Junior Architect
 * - Civil Engineer
 * - Accountant
 */
export type JobRole = string;

export const INTERVIEW_TYPES = [
  "Mixed Interview",
  "Screening Interview",
  "Behavioral Interview",
  "Role-Specific Interview",
  "Situational Interview",
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const EXPERIENCE_LEVELS = [
  "Internship",
  "Graduate",
  "Entry Level",
  "Junior",
  "Mid Level",
  "Senior",
  "Management",
] as const;

/**
 * This type now represents the experience level of the
 * position rather than a generic question difficulty.
 *
 * The name `Difficulty` is temporarily preserved to avoid
 * breaking existing drafts, database records, API functions,
 * and interview session logic.
 */
export type Difficulty = (typeof EXPERIENCE_LEVELS)[number];

const INTERVIEW_TYPE_ALIASES: Readonly<Record<string, InterviewType>> = {
  mixed: "Mixed Interview",
  "mixed interview": "Mixed Interview",
  hr: "Screening Interview",
  "hr interview": "Screening Interview",
  screening: "Screening Interview",
  "screening interview": "Screening Interview",
  behavioral: "Behavioral Interview",
  behavioural: "Behavioral Interview",
  "behavioral interview": "Behavioral Interview",
  "behavioural interview": "Behavioral Interview",
  technical: "Role-Specific Interview",
  "technical interview": "Role-Specific Interview",
  "role-specific": "Role-Specific Interview",
  "role specific": "Role-Specific Interview",
  "role-specific interview": "Role-Specific Interview",
  "role specific interview": "Role-Specific Interview",
  situational: "Situational Interview",
  "situational interview": "Situational Interview",
};

const EXPERIENCE_LEVEL_ALIASES: Readonly<Record<string, Difficulty>> = {
  internship: "Internship",
  intern: "Internship",
  beginner: "Internship",
  graduate: "Graduate",
  "entry level": "Entry Level",
  "entry-level": "Entry Level",
  entrylevel: "Entry Level",
  intermediate: "Entry Level",
  junior: "Junior",
  "mid level": "Mid Level",
  "mid-level": "Mid Level",
  midlevel: "Mid Level",
  senior: "Senior",
  advanced: "Senior",
  management: "Management",
  manager: "Management",
};

export function normalizeInterviewType(
  value: unknown,
  fallback: InterviewType = "Mixed Interview",
): InterviewType {
  if (typeof value !== "string") return fallback;

  return INTERVIEW_TYPE_ALIASES[value.trim().toLowerCase()] || fallback;
}

export function normalizeExperienceLevel(
  value: unknown,
  fallback: Difficulty = "Internship",
): Difficulty {
  if (typeof value !== "string") return fallback;

  return EXPERIENCE_LEVEL_ALIASES[value.trim().toLowerCase()] || fallback;
}

export type InterviewMode =
  | "Text"
  | "Voice"
  | "Video";

export type InterviewModeValue =
  | "text"
  | "voice"
  | "video";

export interface ResumePreview {
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
  uploadedAt?: string;

  skills: string[];
  projects: string[];
  targetRoles?: string[];

  summary?: string;
  education?: string;
}

export interface CompanyContext {
  companyName: string;
  targetRole: string;
  industry: string;
  companyOverview: string;
  roleExpectations: string[];
  companyChallenges: string[];
  scenarioQuestionAngles: string[];
  interviewFocusAreas: string[];
  sourceUrls: string[];

  source:
    | "web-ai"
    | "web-fallback"
    | "fallback"
    | string;

  provider?: string;
  model?: string;
  warning?: string;
}

export interface InterviewSetup {
  /**
   * Kept for compatibility with existing database records,
   * APIs, and interview-generation logic.
   *
   * This stores the user's exact target job role.
   */
  role: JobRole;

  targetCompany: string;
  targetRole: string;
  jobDescription?: string;

  resumeId?: string;
  resume?: ResumePreview;

  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: string[];
  resumeEducation?: string;

  companyContext?: CompanyContext;

  mode: InterviewMode;
  type: InterviewType;

  /**
   * Although the property is named `difficulty`, its value now
   * represents the position's experience level.
   *
   * Examples:
   * - Internship
   * - Graduate
   * - Entry Level
   * - Senior
   */
  difficulty: Difficulty;

  questionCount: number;
}

export interface Question {
  id: number;
  text: string;
}

export interface Feedback {
  scoreScale?: "hundred" | "ten";

  overall: number;
  clarity: number;
  relevance: number;
  structure: number;
  technicalAccuracy: number;

  contentScore?: number;
  professionalismScore?: number;

  answerValidity?:
    | "meaningful"
    | "partially_meaningful"
    | "unrelated"
    | "nonsense"
    | "blank";

  questionType?:
    | "technical"
    | "behavioural"
    | "situational"
    | "motivational"
    | "general";

  relevanceClassification?:
    | "directly_relevant"
    | "partially_relevant"
    | "unrelated";

  scoreLabel?: string;
  requiresReview?: boolean;
  reviewReasons?: string[];
  evaluationVersion?: string;
  confidence?: number;
  wordCount?: number;

  strengths: string[];
  weaknesses: string[];

  improvedAnswer: string;
  summary: string;
  interviewTip: string;

  source?:
    | "ai"
    | "fallback"
    | "local-fallback";

  warning?: string;
  provider?: string;
  model?: string;
  primaryProvider?: string | null;
  reviewProvider?: string | null;
  wasReviewed?: boolean;
  fallbackUsed?: boolean;

  /**
   * Optional speech, video-presentation, duration,
   * and integrity measurements attached to this answer.
   */
  answerMetrics?: PersistedAnswerMetrics;
}

export interface AnswerWithFeedback {
  question: Question;
  answer: string;
  feedback: Feedback;
}

export interface SpeechMetrics {
  metricsVersion?: string;

  spokenWordCount: number;
  fillerWordCount: number;
  pauseCount: number;
  wordsPerMinute: number;
  speakingPace: number;
  transcriptDurationSeconds: number;
  speechClarityScore: number;

  speakingPaceWpm?: number;

  speakingPaceState?:
    | "slow"
    | "balanced"
    | "fast"
    | "not_measurable";

  totalWordCount?: number;
  activeSpeechMs?: number;
  totalSilenceMs?: number;
  longestPauseMs?: number;
  longPauseCount?: number;
  extendedSilenceCount?: number;
  fillerWordsPer100Words?: number;
  mostFrequentFillers?: string[];
  averageSpeechLevel?: number;
  speechLevelVariability?: number;
  lowVolumeMs?: number;
  highVolumeMs?: number;
  clippingEventCount?: number;

  backgroundNoiseState?:
    | "quiet"
    | "moderate"
    | "noisy"
    | "unavailable";

  highNoiseMs?: number;
  possibleOverlappingSpeechEventCount?: number;

  answerFlowState?:
    | "continuous"
    | "some_pauses"
    | "frequent_pauses"
    | "not_measurable";

  volumeConsistency?:
    | "consistent"
    | "slightly_variable"
    | "highly_variable"
    | "not_measurable";

  speechDeliverySummary?: string;
}

export interface VisualMetrics {
  metricsVersion?: string;

  cameraEnabledSeconds: number;
  faceVisiblePercentage: number;
  lookingAwayCount: number;
  headMovementScore: number;
  cameraPresenceScore: number;

  faceVisibilityScore?: number;
  faceCenteringScore?: number;
  handVisibilityScore?: number;
  movementStabilityScore?: number;
  overallPresentationScore?: number;
  eyeContactScore?: number;

  analysisDurationMs?: number;
  frameCount?: number;
  faceDetectedFrames?: number;
  faceCenteredFrames?: number;
  handDetectedFrames?: number;
  stableFrames?: number;
  eyeContactFrames?: number;
  screenFacingFrames?: number;
  lookingAwayFrames?: number;
  validFaceFrames?: number;

  cameraEngagementRatio?: number;
  centeredPresenceRatio?: number;
  lookingAwayEventCount?: number;
  extendedLookingAwayMs?: number;
  offCenterEventCount?: number;
  excessiveMovementEventCount?: number;
  averageHeadYaw?: number;
  averageHeadPitch?: number;
  averageHeadRoll?: number;
  cameraEngagementMeasurableMs?: number;

  postureMeasurableRatio?: number;
  professionalFramingRatio?: number;
  centeredPostureRatio?: number;
  levelShoulderRatio?: number;
  stableUpperBodyRatio?: number;
  prolongedLeanEventCount?: number;
  prolongedShoulderTiltEventCount?: number;
  framingIssueEventCount?: number;
  excessiveBodyMovementEventCount?: number;
  averageShoulderAngleDegrees?: number;
  averageTorsoLeanRatio?: number;
  postureMeasurableMs?: number;
  postureCoachingSummary?: string;

  handAnalysisMeasurableRatio?: number;
  naturalGestureRatio?: number;
  excessiveGestureRatio?: number;
  clearFaceFromHandsRatio?: number;
  extendedHandsNearFaceEventCount?: number;
  faceObstructionEventCount?: number;
  cameraObstructionEventCount?: number;
  excessiveHandMovementEventCount?: number;
  totalHandsNearFaceMs?: number;
  totalFaceObstructionMs?: number;
  totalCameraObstructionMs?: number;
  totalExcessiveGestureMs?: number;
  handMeasurableMs?: number;
  handVisibleDurationMs?: number;
  handGestureCoachingSummary?: string;

  visualSummary?: string[];
}

export interface FinalReport {
  overallScore: number;

  breakdown: {
    clarity: number;
    relevance: number;
    structure: number;
    confidence: number;
    technicalAccuracy: number;

    communication?: number;
    resumeMatch?: number;
    companyReadiness?: number;
    speechConfidence?: number;
    cameraPresence?: number;
  };

  strengths: string[];
  improvements: string[];
  nextSteps: string[];

  improvedSampleAnswer: string;
  summary?: string;
  improvementPlan?: string[];

  communicationScore?: number;
  resumeMatchScore?: number;
  companyReadinessScore?: number;
  speechConfidenceScore?: number;
  cameraPresenceScore?: number;
  overallPresentationScore?: number;

  speechMetrics?: SpeechMetrics;
  visualMetrics?: VisualMetrics;

  metricsVersion?: string;
  scoringVersion?: string;

  scoreBreakdown?: AnswerScoreBreakdown;
  canonicalMetrics?: SessionInterviewMetrics;
  integrityMetrics?: InterviewIntegrityMetrics;

  answerCount?: number;
  scoredAnswerCount?: number;

  source?:
    | "ai"
    | "fallback"
    | "local-fallback";

  warning?: string;
  provider?: string;
  model?: string;
}

export interface SessionSummary {
  id: string;

  /**
   * The exact target role used for the interview.
   */
  role: JobRole;

  type: InterviewType;
  date: string;
  score: number;

  status?:
    | "in-progress"
    | "completed"
    | "cancelled";

  targetCompany?: string;
  targetRole?: string;

  /**
   * This property currently stores the selected
   * position experience level.
   */
  difficulty?: Difficulty;

  mode?: InterviewMode | InterviewModeValue;
  overallPresentationScore?: number;
}

export interface DashboardStats {
  totalSessions: number;
  averageScore: number;
  latestScore: number;

  bestSkill: string;
  weakestSkill: string;

  resumeMatchScore: number;
  companyReadinessScore: number;
  speechConfidenceScore: number;
  cameraPresenceScore: number;
  overallPresentationScore: number;

  recent: SessionSummary[];
}
