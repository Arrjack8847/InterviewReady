import { useCallback, useState } from "react";
import { analyzeInterviewAnswer } from "@/lib/api";
import type {
  Feedback,
  InterviewModeValue,
  Question,
} from "@/lib/types";
import type { ExtendedInterviewSetup } from "../types";

interface EvaluateAnswerOptions {
  question: Question;
  answer: string;
  setup: ExtendedInterviewSetup;
}

function normalizeInterviewMode(
  mode: ExtendedInterviewSetup["mode"],
): InterviewModeValue {
  const normalizedMode = String(mode || "")
    .trim()
    .toLowerCase();

  if (normalizedMode === "voice") {
    return "voice";
  }

  if (normalizedMode === "video") {
    return "video";
  }

  return "text";
}

export function useInterviewSubmission() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearError = useCallback(() => {
    setError("");
  }, []);

  const evaluateAnswer = useCallback(
    async ({
      question,
      answer,
      setup,
    }: EvaluateAnswerOptions): Promise<Feedback> => {
      setLoading(true);
      setError("");

      try {
        return await analyzeInterviewAnswer({
          question: question.text,
          answer,

          expectedFocus:
            question.expectedFocus?.trim() ||
            "Give a clear, relevant answer supported by appropriate evidence.",

          questionCategory:
            question.category || setup.type,

          mode: normalizeInterviewMode(setup.mode),

          role: setup.role,
          targetRole:
            setup.targetRole?.trim() ||
            setup.role,

          type: setup.type,
          difficulty: setup.difficulty,

          targetCompany:
            setup.targetCompany?.trim() || "",

          jobDescription:
            setup.jobDescription?.trim() || "",

          resumeSummary:
            setup.resumeSummary?.trim() || "",

          resumeSkills:
            setup.resumeSkills || [],

          resumeProjects:
            setup.resumeProjects || [],

          resumeEducation:
            setup.resumeEducation?.trim() || "",

          companyContext:
            setup.companyContext,
        });
      } catch (submissionError) {
        console.error(
          "AI answer feedback failed:",
          submissionError,
        );

        const message =
          submissionError instanceof Error &&
          submissionError.message.trim()
            ? submissionError.message
            : "Answer evaluation failed. Your draft is preserved; please try again.";

        setError(message);
        throw submissionError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    clearError,
    evaluateAnswer,
  };
}