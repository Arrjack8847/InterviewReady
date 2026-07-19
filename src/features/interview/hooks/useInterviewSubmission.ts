import { useCallback, useState } from "react";
import { analyzeInterviewAnswer } from "@/lib/api";
import type { Feedback, Question } from "@/lib/types";
import type { ExtendedInterviewSetup } from "../types";

interface EvaluateAnswerOptions {
  question: Question;
  answer: string;
  setup: ExtendedInterviewSetup;
}

export function useInterviewSubmission() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const evaluateAnswer = useCallback(
    async ({ question, answer, setup }: EvaluateAnswerOptions): Promise<Feedback> => {
      setLoading(true);
      setError("");
      try {
        return await analyzeInterviewAnswer({
          question: question.text,
          answer,
          role: setup.role,
          targetRole: setup.targetRole || "",
          type: setup.type,
          difficulty: setup.difficulty,
          targetCompany: setup.targetCompany || "",
          jobDescription: setup.jobDescription || "",
          resumeSummary: setup.resumeSummary || "",
          resumeSkills: setup.resumeSkills || [],
          resumeProjects: setup.resumeProjects || [],
          resumeEducation: setup.resumeEducation || "",
        });
      } catch (submissionError) {
        console.error("AI answer feedback failed:", submissionError);
        setError("Answer evaluation failed. Your draft is preserved; please try again.");
        throw submissionError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { loading, error, clearError: () => setError(""), evaluateAnswer };
}
