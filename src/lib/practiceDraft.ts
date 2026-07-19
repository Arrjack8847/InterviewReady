import {
  normalizeExperienceLevel,
  normalizeInterviewType,
} from "@/lib/types";
import type { Difficulty, InterviewMode, InterviewType, JobRole } from "@/lib/types";

export const PRACTICE_DRAFT_KEY = "ir.practiceDraft";

export type PracticePath = "personalized" | "quick";
export type PracticeStage = "choice" | "profile" | "setup";

export interface PracticeDraft {
  version: 1;
  path?: PracticePath;
  stage: PracticeStage;
  role?: JobRole;
  targetRole?: string;
  targetCompany?: string;
  companyType?: string;
  interviewType?: InterviewType;
  difficulty?: Difficulty;
  questionCount?: number;
  mode?: InterviewMode;
  jobDescription?: string;
  updatedAt: string;
}

export function createPracticeDraft(
  values: Partial<Omit<PracticeDraft, "version" | "updatedAt">> = {},
): PracticeDraft {
  return {
    version: 1,
    stage: "choice",
    ...values,
    updatedAt: new Date().toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizePracticeDraft(value: unknown): PracticeDraft | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const stage: PracticeStage =
    value.stage === "profile" || value.stage === "setup" ? value.stage : "choice";
  const path: PracticePath | undefined =
    value.path === "personalized" || value.path === "quick" ? value.path : undefined;
  const mode: InterviewMode | undefined =
    value.mode === "Text" || value.mode === "Voice" || value.mode === "Video"
      ? value.mode
      : undefined;
  const questionCount = Number(value.questionCount);

  return createPracticeDraft({
    stage,
    path,
    role: optionalText(value.role),
    targetRole: optionalText(value.targetRole),
    targetCompany: optionalText(value.targetCompany),
    companyType: optionalText(value.companyType),
    interviewType:
      value.interviewType === undefined
        ? undefined
        : normalizeInterviewType(value.interviewType),
    difficulty:
      value.difficulty === undefined
        ? undefined
        : normalizeExperienceLevel(value.difficulty),
    questionCount:
      Number.isInteger(questionCount) && questionCount > 0 ? questionCount : undefined,
    mode,
    jobDescription: optionalText(value.jobDescription),
  });
}

export function readPracticeDraft(): PracticeDraft {
  if (typeof window === "undefined") return createPracticeDraft();
  const raw = localStorage.getItem(PRACTICE_DRAFT_KEY);
  if (!raw) return createPracticeDraft();

  try {
    return normalizePracticeDraft(JSON.parse(raw)) || createPracticeDraft();
  } catch {
    localStorage.removeItem(PRACTICE_DRAFT_KEY);
    return createPracticeDraft();
  }
}

export function savePracticeDraft(values: Partial<PracticeDraft>): PracticeDraft {
  const next = createPracticeDraft({ ...readPracticeDraft(), ...values });
  localStorage.setItem(PRACTICE_DRAFT_KEY, JSON.stringify(next));
  return next;
}

export function clearPracticeDraft() {
  if (typeof window !== "undefined") localStorage.removeItem(PRACTICE_DRAFT_KEY);
}
