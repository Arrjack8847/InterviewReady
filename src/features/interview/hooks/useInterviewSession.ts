import { useCallback, useEffect, useState } from "react";
import { generateInterviewQuestions } from "@/lib/api";
import {
  getInterviewSession,
  getSessionAnswers,
  updateInterviewSessionProgress,
  updateInterviewSessionQuestions,
} from "@/lib/supabaseService";
import type { AnswerWithFeedback, Feedback, Question } from "@/lib/types";
import { DEFAULT_SETUP } from "../constants";
import type { ExtendedInterviewSetup } from "../types";
import {
  getResumeIndex,
  mapSavedAnswerToHistoryItem,
  normalizeStoredQuestions,
} from "../utils/interviewMappers";
import { buildSetupFromSession, readStoredSetup } from "../utils/interviewSetup";

interface UseInterviewSessionOptions {
  userId?: string;
  onMissing: () => void;
  onClosed: () => void;
}

export function useInterviewSession({ userId, onMissing, onClosed }: UseInterviewSessionOptions) {
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState<"in-progress" | "completed" | "cancelled">("in-progress");
  const [setup, setSetup] = useState<ExtendedInterviewSetup>(DEFAULT_SETUP);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [history, setHistory] = useState<AnswerWithFeedback[]>([]);
  const [questionError, setQuestionError] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const initialize = async () => {
      const activeSessionId = localStorage.getItem("ir.sessionId") || "";
      if (!activeSessionId) {
        onMissing();
        return;
      }
      try {
        const savedSession = await getInterviewSession(activeSessionId, userId);
        if (!active) return;
        if (!savedSession) {
          localStorage.removeItem("ir.sessionId");
          localStorage.removeItem("ir.activeAttemptId");
          onMissing();
          return;
        }
        if (savedSession.status === "completed" || savedSession.status === "cancelled") {
          localStorage.removeItem("ir.sessionId");
          localStorage.removeItem("ir.activeAttemptId");
          onClosed();
          return;
        }
        const selectedSetup = buildSetupFromSession(savedSession, readStoredSetup());
        setSessionId(activeSessionId);
        setStatus("in-progress");
        setSetup(selectedSetup);
        localStorage.setItem("ir.setup", JSON.stringify(selectedSetup));
        if (savedSession.attemptId)
          localStorage.setItem("ir.activeAttemptId", savedSession.attemptId);
        const savedAnswers = await getSessionAnswers({ sessionId: activeSessionId, userId });
        if (!active) return;
        const completedAnswers = savedAnswers.filter((item) => item.evaluationStatus !== "pending");
        const restoredHistory = completedAnswers.map(mapSavedAnswerToHistoryItem);
        setHistory(restoredHistory);
        let interviewQuestions = normalizeStoredQuestions(savedSession.generatedQuestions);
        if (interviewQuestions.length === 0) {
          try {
            const result = await generateInterviewQuestions({
              role: selectedSetup.role,
              targetRole: selectedSetup.targetRole || "",
              type: selectedSetup.type,
              difficulty: selectedSetup.difficulty,
              questionCount: selectedSetup.questionCount,
              targetCompany: selectedSetup.targetCompany || "",
              jobDescription: selectedSetup.jobDescription || "",
              resumeSummary: selectedSetup.resumeSummary || "",
              resumeSkills: selectedSetup.resumeSkills || [],
              resumeProjects: selectedSetup.resumeProjects || [],
              resumeEducation: selectedSetup.resumeEducation || "",
              companyContext: selectedSetup.companyContext,
            });
            interviewQuestions = result.questions.map((question, questionIndex) => ({
              id: questionIndex + 1,
              text: question.text,
            }));
          } catch (error) {
            console.error("AI question generation failed:", error);
            setQuestionError("AI question generation failed, so fallback questions were loaded.");
            interviewQuestions = [
              {
                id: 1,
                text: `Tell me about yourself and why you are interested in the ${selectedSetup.targetRole || selectedSetup.role} role.`,
              },
              {
                id: 2,
                text: `What skills make you suitable for this ${selectedSetup.targetRole || selectedSetup.role} position?`,
              },
              {
                id: 3,
                text: "Describe one project or experience that shows your problem-solving ability.",
              },
            ];
          }
          try {
            await updateInterviewSessionQuestions({
              sessionId: activeSessionId,
              userId,
              questions: interviewQuestions,
            });
          } catch (error) {
            console.error("Failed to save generated questions:", error);
            setSaveError("Interview questions loaded, but they were not saved to Supabase.");
          }
        }
        if (!active) return;
        const resumeIndex = getResumeIndex(
          interviewQuestions,
          completedAnswers,
          savedSession.currentQuestionIndex,
        );
        const restoredAnswer = restoredHistory.find(
          (item) => item.question.id === interviewQuestions[resumeIndex]?.id,
        );
        const pendingAnswer = savedAnswers.find(
          (item) =>
            item.evaluationStatus === "pending" &&
            item.questionId === interviewQuestions[resumeIndex]?.id,
        );
        setQuestions(interviewQuestions);
        setIndex(resumeIndex);
        if (pendingAnswer) {
          setAnswer(pendingAnswer.answerText);
          setFeedback(null);
        }
        if (
          !pendingAnswer &&
          restoredAnswer &&
          completedAnswers.length >= interviewQuestions.length
        ) {
          setAnswer(restoredAnswer.answer);
          setFeedback(restoredAnswer.feedback);
        }
      } catch (error) {
        if (!active) return;
        console.error("Failed to load interview session:", error);
        setQuestionError("Could not load your saved interview session. Please try again.");
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [onClosed, onMissing, userId]);

  const getActiveSessionId = useCallback(
    () => sessionId || localStorage.getItem("ir.sessionId") || "",
    [sessionId],
  );
  const persistProgress = useCallback(
    async (currentQuestionIndex: number) => {
      const activeId = getActiveSessionId();
      if (!userId || !activeId) return;
      try {
        await updateInterviewSessionProgress({ sessionId: activeId, userId, currentQuestionIndex });
      } catch (error) {
        console.error("Failed to save interview progress:", error);
        setSaveError("Your progress could not be saved to Supabase.");
      }
    },
    [getActiveSessionId, userId],
  );

  return {
    sessionId,
    setSessionId,
    status,
    setStatus,
    setup,
    setSetup,
    questions,
    setQuestions,
    index,
    setIndex,
    answer,
    setAnswer,
    feedback,
    setFeedback,
    history,
    setHistory,
    questionError,
    feedbackError,
    setFeedbackError,
    saveError,
    setSaveError,
    getActiveSessionId,
    persistProgress,
  };
}
