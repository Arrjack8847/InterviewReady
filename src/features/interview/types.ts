import type { CompanyContext, InterviewSetup } from "@/lib/types";
import type { getInterviewSession, getSessionAnswers } from "@/lib/supabaseService";

export type InterviewModeLabel = "Text" | "Voice" | "Video" | "text" | "voice" | "video";

export type ExtendedInterviewSetup = Omit<InterviewSetup, "mode"> & {
  targetCompany?: string;
  targetRole?: string;
  jobDescription?: string;
  mode?: InterviewModeLabel;
  resumeId?: string;
  resume?: { fileName?: string; fileUrl?: string };
  resumeSummary?: string;
  resumeSkills?: string[];
  resumeProjects?: string[];
  resumeEducation?: string;
  companyContext?: CompanyContext;
};

export type SavedInterviewSession = Awaited<ReturnType<typeof getInterviewSession>>;
export type SavedInterviewAnswer = Awaited<ReturnType<typeof getSessionAnswers>>[number];

export interface SpeechRecognitionResultLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      [index: number]: { transcript: string };
    };
  };
}

export interface SpeechRecognitionErrorLike {
  error?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onnomatch?: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
export type WindowWithSpeechRecognition = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
