import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { FeedbackCard } from "@/components/FeedbackCard";
import { LoadingState } from "@/components/app/LoadingState";
import { VideoReadinessCalibration } from "@/components/VideoReadinessCalibration";
import { useAuth } from "@/context/AuthContext";
import { useInterviewMonitor } from "@/features/interview/monitoring/useInterviewMonitor";
import { buildFallbackFinalReport } from "./utils/interviewFallbacks";
import { getModeLabel } from "./utils/interviewSetup";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechDeliveryAnalysis } from "./speech/useSpeechDeliveryAnalysis";
import {
  calculateActiveSpeechPace,
  countWords as countTranscriptWords,
} from "./speech/transcript/transcriptAnalysis";
import { useInterviewCamera } from "./hooks/useInterviewCamera";
import { useInterviewSession } from "./hooks/useInterviewSession";
import { useInterviewSubmission } from "./hooks/useInterviewSubmission";
import { useInterviewPause } from "./hooks/useInterviewPause";
import { usePageVisibility } from "./hooks/usePageVisibility";
import {
  clearInterviewAnswerLocalDraft,
  readInterviewAnswerDraft,
  saveInterviewAnswerLocalDraft,
} from "./answerDraft";
import { retryTransient } from "./resilience";
import { createPersistedAnswerMetrics } from "./scoring/answerMetrics";
import type { PersistedAnswerMetrics } from "./scoring/scoringTypes";
import { initialInterviewMachineState, interviewMachineReducer } from "./state/interviewMachine";
import {
  canResume,
  isAnswering as selectIsAnswering,
  isPaused as selectIsPaused,
  isShowingFeedback,
  isSubmitting,
} from "./state/interviewSelectors";
import { InterviewActions } from "./components/InterviewActions";
import { InterviewAnswerBox } from "./components/InterviewAnswerBox";
import { InterviewErrorNotices } from "./components/InterviewErrorNotices";
import { InterviewHeader } from "./components/InterviewHeader";
import { InterviewPauseCountdown } from "./components/InterviewPauseCountdown";
import { InterviewSidebar } from "./components/InterviewSidebar";
import { InterviewQuestionCard } from "./components/InterviewQuestionCard";
import { TextAnswerTools } from "./components/modes/TextAnswerTools";
import { VoiceAnswerTools } from "./components/modes/VoiceAnswerTools";
import { VideoAnswerTools } from "./components/modes/VideoAnswerTools";
import { ExitInterviewDialog } from "./components/dialogs/ExitInterviewDialog";
import { InterviewPausedDialog } from "./components/dialogs/InterviewPausedDialog";
import { generateFinalReport } from "@/lib/api";
import {
  applyCameraEngagementMetrics,
  calculateSpeechMetrics,
  debugScoring,
  enrichFinalReport,
  mergeSpeechDeliveryMetrics,
} from "@/lib/metrics";
import {
  cancelInterviewSession,
  completeInterviewSession,
  saveSpeechMetrics,
  saveInterviewAnswer,
  saveInterviewAnswerDraft,
  saveVisualMetrics,
} from "@/lib/supabaseService";
import { normalizeInterviewModeValue } from "@/lib/types";
import type { AnswerWithFeedback, Feedback, FinalReport } from "@/lib/types";

export function InterviewRoom() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const submissionLockRef = useRef(false);
  const finishLockRef = useRef(false);
  const navigationLockRef = useRef(false);
  const draftRecoveryAttemptRef = useRef("");
  const activeQuestionInitializedRef = useRef("");
  const navigateToStart = useCallback(() => {
    if (navigationLockRef.current) return;
    navigationLockRef.current = true;
    void navigate({ to: "/start" });
  }, [navigate]);
  const navigateToDashboard = useCallback(() => {
    if (navigationLockRef.current) return;
    navigationLockRef.current = true;
    void navigate({ to: "/dashboard" });
  }, [navigate]);
  const session = useInterviewSession({
    userId: user?.uid,
    onMissing: navigateToStart,
    onClosed: navigateToDashboard,
  });

  const camera = useInterviewCamera();

  const {
    sessionId,
    status: sessionStatus,
    setStatus: setSessionStatus,
    setup,
    questions,
    index,
    setIndex,
    answer,
    setAnswer,
    feedback,
    setFeedback,
    history,
    setHistory,
    questionError,
    saveError,
    setSaveError,
    getActiveSessionId,
    persistProgress,
  } = session;
  const submission = useInterviewSubmission();
  const [machine, dispatch] = useReducer(interviewMachineReducer, initialInterviewMachineState);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [videoAttemptComplete, setVideoAttemptComplete] = useState(false);
  const answerRef = useRef(answer);
  const speech = useSpeechRecognition({
    language: "en-US",
    onFinalTranscript: (transcript) => {
      setAnswer((previousAnswer) => {
        const nextAnswer = `${previousAnswer} ${transcript}`.trim();
        answerRef.current = nextAnswer;
        return nextAnswer;
      });
    },
  });
  const {
    isListening,
    isFinalizing: isSpeechFinalizing,
    interimTranscript,
    error: voiceError,
    reset: resetSpeech,
    stop: stopSpeech,
    stopAndFinalize,
    start: startSpeech,
  } = speech;
  const loading = isSubmitting(machine);
  const feedbackError = submission.error;
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitLoading, setExitLoading] = useState(false);
  const pageVisible = usePageVisibility();

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const cameraStream = camera.stream;
  const liveVideoElement = camera.liveVideoElement;
  const liveVideoSignals = camera.signals;
  const videoCalibrationComplete = camera.calibrationComplete;
  const handleLiveVideoRef = camera.liveVideoRef;
  const handleSuspendedVideoRef = camera.suspendedVideoRef;
  const resetCamera = camera.reset;

  const modeLabel = getModeLabel(setup.mode);
  const speechDelivery = useSpeechDeliveryAnalysis(modeLabel !== "Text");
  const pauseSpeechDelivery = speechDelivery.pause;
  const startSpeechDelivery = speechDelivery.start;
  const resetSpeechDeliverySession = speechDelivery.reset;
  const monitoringPaused = selectIsPaused(machine);
  const answering = selectIsAnswering(machine);
  const current = questions[index];
  const submittedHistoryItem = current
    ? history.find((item) => item.question.id === current.id)
    : undefined;
  const isSubmittedQuestion = Boolean(submittedHistoryItem);
  const isReviewingSubmittedQuestion = isSubmittedQuestion && index < activeQuestionIndex;
  const feedbackVisible = Boolean(feedback) && (isSubmittedQuestion || isShowingFeedback(machine));
  const allQuestionsSubmitted =
    questions.length > 0 &&
    questions.every((question) => history.some((item) => item.question.id === question.id));

  useEffect(() => {
    if (!answering || monitoringPaused || modeLabel === "Text") {
      pauseSpeechDelivery();
    }
  }, [answering, modeLabel, monitoringPaused, pauseSpeechDelivery]);

  const interviewMonitor = useInterviewMonitor({
    stream: cameraStream,
    videoElement: liveVideoElement,
    enabled: modeLabel === "Video" && videoCalibrationComplete,
    engagementActive:
      answering &&
      !monitoringPaused &&
      pageVisible &&
      !isSubmittedQuestion &&
      !videoAttemptComplete,
    securityActive:
      (answering || monitoringPaused) && !isSubmittedQuestion && !videoAttemptComplete,
    pauseEnabled: true,
    onPauseRequested: (warning) => {
      void speech.stopAndFinalize();
      speechDelivery.pause();
      dispatch({
        type: "INTERVIEW_PAUSED",
        reason: warning.message,
        source: "automatic",
        warningType: warning.type,
      });
    },
  });
  const resetScoredVisualMetrics = interviewMonitor.resetScoredMetrics;

  const pause = useInterviewPause({
    faceState: interviewMonitor.faceState,
    stopSpeech: () => {
      void speech.stopAndFinalize();
      speechDelivery.pause();
    },
    restartSpeech: () => {
      speech.start({ force: true });
      void speechDelivery.start();
    },
    state: machine,
    dispatch,
    pageVisible,
  });

  const pauseCountdownSeconds =
    interviewMonitor.warning &&
    interviewMonitor.warning.severity === "warning" &&
    answering &&
    !monitoringPaused
      ? Math.max(
          1,
          Math.ceil(
            ((interviewMonitor.warning.type === "no_face" ? 5_000 : 4_000) -
              interviewMonitor.warning.durationMs) /
              1_000,
          ),
        )
      : null;

  useEffect(() => {
    const warning = interviewMonitor.warning;
    if (!warning || !answering || monitoringPaused) return;
    dispatch({
      type: warning.severity === "warning" ? "PAUSE_COUNTDOWN_STARTED" : "MONITOR_WARNING",
      warningType: warning.type,
    });
  }, [answering, interviewMonitor.warning, monitoringPaused]);

  useEffect(() => {
    resetCamera();
    resetSpeech();
    resetSpeechDeliverySession();
    resetScoredVisualMetrics();
    setVideoAttemptComplete(false);
    dispatch({ type: "RESET_FOR_SESSION" });
  }, [
    resetCamera,
    resetScoredVisualMetrics,
    resetSpeech,
    resetSpeechDeliverySession,
    sessionId,
    setup.mode,
  ]);

  useEffect(() => {
    if (questions.length > 0 && (modeLabel !== "Video" || videoCalibrationComplete)) {
      dispatch({
        type: modeLabel === "Video" ? "CALIBRATION_COMPLETED" : "PREPARATION_COMPLETED",
      });
    }
  }, [modeLabel, questions.length, videoCalibrationComplete]);

  useEffect(() => {
    return () => {
      stopSpeech();

      if (typeof window !== "undefined") {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopSpeech]);

  useEffect(() => {
    if (pageVisible || !answering || modeLabel === "Text") return;
    stopSpeech();
    pauseSpeechDelivery();
  }, [answering, modeLabel, pageVisible, pauseSpeechDelivery, stopSpeech]);

  useEffect(() => {
    if (!pageVisible || !answering || monitoringPaused || modeLabel === "Text") return;
    startSpeech();
    void startSpeechDelivery();
  }, [answering, modeLabel, monitoringPaused, pageVisible, startSpeech, startSpeechDelivery]);

  useEffect(() => {
    if (!sessionId || sessionStatus !== "in-progress") return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionId, sessionStatus]);

  useEffect(() => {
    if (!questions.length) return;

    const initializationKey = `${sessionId || "local"}:${questions
      .map((question) => question.id)
      .join(",")}`;

    if (activeQuestionInitializedRef.current === initializationKey) return;

    activeQuestionInitializedRef.current = initializationKey;
    setActiveQuestionIndex(Math.min(index, questions.length - 1));
  }, [index, questions, sessionId]);

  useEffect(() => {
    if (!current) return;

    setVideoAttemptComplete(false);

    const savedAnswer = history.find((item) => item.question.id === current.id);

    if (savedAnswer) {
      setAnswer(savedAnswer.answer);
      setFeedback(savedAnswer.feedback);
      return;
    }

    setFeedback(null);

    if (!sessionId) {
      setAnswer("");
      return;
    }

    const draft = readInterviewAnswerDraft(sessionId, current.id);
    setAnswer(draft?.answer || "");
  }, [current, history, sessionId, setAnswer, setFeedback]);

  useEffect(() => {
    if (!sessionId || !current || feedback || !user) return;

    const draft = readInterviewAnswerDraft(sessionId, current.id);

    if (draft?.persistenceStatus !== "failed" || !draft.feedback || !draft.metrics) {
      return;
    }

    const attemptKey = `${sessionId}:${current.id}:${draft.updatedAt}`;

    if (draftRecoveryAttemptRef.current === attemptKey) {
      return;
    }

    draftRecoveryAttemptRef.current = attemptKey;

    void retryTransient(() =>
      saveInterviewAnswer({
        sessionId,
        userId: user.uid,
        question: current,
        answer: draft.answer,
        feedback: draft.feedback!,
        answerMetrics: draft.metrics,
      }),
    )
      .then(async () => {
        clearInterviewAnswerLocalDraft(sessionId, current.id);

        setHistory((items) => {
          const restored: AnswerWithFeedback = {
            question: current,
            answer: draft.answer,
            feedback: draft.feedback!,
          };

          return items.some((item) => item.question.id === current.id)
            ? items.map((item) => (item.question.id === current.id ? restored : item))
            : [...items, restored];
        });

        setAnswer(draft.answer);
        setFeedback(draft.feedback!);
        dispatch({ type: "SUBMISSION_STARTED" });
        dispatch({ type: "SUBMISSION_COMPLETED" });
        const nextQuestionIndex = Math.min(index + 1, questions.length - 1);
        setActiveQuestionIndex((currentActiveIndex) =>
          Math.max(currentActiveIndex, nextQuestionIndex),
        );
        await persistProgress(Math.min(index + 1, questions.length));
        setSaveError("");
      })
      .catch((error) => {
        console.error("Failed to retry the locally preserved answer:", error);
        setSaveError("Your locally preserved answer is still waiting to sync.");
      });
  }, [
    current,
    feedback,
    index,
    persistProgress,
    questions.length,
    sessionId,
    setAnswer,
    setFeedback,
    setHistory,
    setSaveError,
    user,
  ]);

  useEffect(() => {
    if (
      !sessionId ||
      !current ||
      isSubmittedQuestion ||
      machine.phase === "submitting" ||
      machine.phase === "feedback"
    )
      return undefined;
    const timeoutId = window.setTimeout(() => {
      const existing = readInterviewAnswerDraft(sessionId, current.id);

      if (!answer.trim()) {
        if (existing?.persistenceStatus !== "failed") {
          clearInterviewAnswerLocalDraft(sessionId, current.id);
        }
        return;
      }

      if (existing?.persistenceStatus === "failed" && existing.answer === answer) return;

      saveInterviewAnswerLocalDraft(sessionId, current.id, answer, {
        finalizedTranscript: answer,
        mode: modeLabel.toLowerCase(),
        persistenceStatus: "editing",
      });
    }, 500);
    return () => window.clearTimeout(timeoutId);
  }, [answer, current, isSubmittedQuestion, machine.phase, modeLabel, sessionId]);

  if (questions.length === 0) {
    return <LoadingState fullPage title="Preparing your interview…" />;
  }

  const isLastDisplayedQuestion = index === questions.length - 1;
  const canGoNext = index < activeQuestionIndex;
  const canFinish = allQuestionsSubmitted && isLastDisplayedQuestion;
  const progress = allQuestionsSubmitted
    ? 100
    : Math.round(((activeQuestionIndex + 1) / questions.length) * 100);
  const liveSpeechMetrics = calculateSpeechMetrics(answer, speech.getDurationMs());
  const currentFinalTranscript = answer;
  const currentTranscriptWordCount = countTranscriptWords(currentFinalTranscript);
  const currentSpeakingPace = calculateActiveSpeechPace(
    currentTranscriptWordCount,
    speechDelivery.snapshot.activeSpeechMs,
  );

  const saveHistoryItem = (savedAnswer: AnswerWithFeedback) => {
    setHistory((previousHistory) => {
      const existingIndex = previousHistory.findIndex(
        (item) => item.question.id === savedAnswer.question.id,
      );

      if (existingIndex < 0) {
        return [...previousHistory, savedAnswer];
      }

      return previousHistory.map((item, itemIndex) =>
        itemIndex === existingIndex ? savedAnswer : item,
      );
    });
  };

  const persistSubmittedAnswer = async ({
    fb,
    metrics,
    submittedAnswer,
  }: {
    fb: Feedback;
    metrics: PersistedAnswerMetrics;
    submittedAnswer: string;
  }) => {
    const savedAnswer: AnswerWithFeedback = {
      question: current,
      answer: submittedAnswer,
      feedback: fb,
    };

    saveHistoryItem(savedAnswer);
    const nextQuestionIndex = Math.min(index + 1, questions.length - 1);
    setActiveQuestionIndex((currentActiveIndex) => Math.max(currentActiveIndex, nextQuestionIndex));

    const activeSessionId = getActiveSessionId();

    if (!user || !activeSessionId) return false;

    try {
      await retryTransient(() =>
        saveInterviewAnswer({
          sessionId: activeSessionId,
          userId: user.uid,
          question: current,
          answer: submittedAnswer,
          feedback: fb,
          answerMetrics: metrics,
        }),
      );

      await persistProgress(Math.min(index + 1, questions.length));
      clearInterviewAnswerLocalDraft(activeSessionId, current.id);
      return true;
    } catch (error) {
      console.error("Failed to save answer to Supabase:", error);
      saveInterviewAnswerLocalDraft(activeSessionId, current.id, submittedAnswer, {
        finalizedTranscript: submittedAnswer,
        mode: modeLabel.toLowerCase(),
        submittedAt: new Date().toISOString(),
        metrics,
        feedback: fb,
        persistenceStatus: "failed",
      });
      setSaveError(
        "Your answer was analyzed but could not be synced yet. A complete local draft is available for retry.",
      );
      return false;
    }
  };

  const handleSubmit = async () => {
    if (
      submissionLockRef.current ||
      isSubmittedQuestion ||
      index !== activeQuestionIndex ||
      machine.phase !== "ready" ||
      isListening ||
      isSpeechFinalizing ||
      (modeLabel === "Video" && !videoAttemptComplete)
    ) {
      return;
    }

    submissionLockRef.current = true;

    try {
      let finalizedVoiceTranscript = "";

      if (modeLabel !== "Text") {
        finalizedVoiceTranscript = (await stopAndFinalize()).trim();
      }

      const submittedAnswer =
        modeLabel === "Text"
          ? answerRef.current.trim()
          : answerRef.current.trim() || finalizedVoiceTranscript;

      if (!submittedAnswer) {
        return;
      }

      if (submittedAnswer !== answerRef.current) {
        answerRef.current = submittedAnswer;
        setAnswer(submittedAnswer);
      }

      speechDelivery.pause();
      dispatch({ type: "SUBMISSION_STARTED" });
      submission.clearError();
      setSaveError("");

      const activeSessionId = getActiveSessionId();
      const submittedAt = new Date().toISOString();

      if (activeSessionId) {
        saveInterviewAnswerLocalDraft(activeSessionId, current.id, submittedAnswer, {
          finalizedTranscript: modeLabel === "Text" ? "" : submittedAnswer,
          mode: modeLabel.toLowerCase(),
          submittedAt,
          persistenceStatus: "pending",
        });
      }

      if (user && activeSessionId) {
        try {
          await retryTransient(() =>
            saveInterviewAnswerDraft({
              sessionId: activeSessionId,
              userId: user.uid,
              question: current,
              answer: submittedAnswer,
            }),
          );
        } catch (error) {
          console.error("Failed to save answer before evaluation:", error);
          setSaveError(
            "Your answer could not be synced yet. A local copy is preserved while evaluation continues.",
          );
        }
      }

      let evaluatedFeedback: Feedback;

      try {
        evaluatedFeedback = await submission.evaluateAnswer({
          question: current,
          answer: submittedAnswer,
          setup,
        });
      } catch (error) {
        dispatch({ type: "SUBMISSION_FAILED" });
        return;
      }

      debugScoring("answer feedback received", {
        sessionId: getActiveSessionId(),
        questionId: current.id,
        answerWordCount: submittedAnswer.trim().split(/\s+/).filter(Boolean).length,
        scores: {
          overall: evaluatedFeedback.overall,
          clarity: evaluatedFeedback.clarity,
          relevance: evaluatedFeedback.relevance,
          structure: evaluatedFeedback.structure,
          technicalAccuracy: evaluatedFeedback.technicalAccuracy,
        },
        source: evaluatedFeedback.source || "ai",
      });

      const answerTranscript = modeLabel === "Text" ? "" : submittedAnswer;
      const answerDurationMs = modeLabel === "Text" ? 0 : speech.getDurationMs();
      const audioMetrics = modeLabel === "Text" ? undefined : speechDelivery.getAnswerMetrics();
      const answerSpeechMetrics =
        modeLabel === "Text"
          ? undefined
          : mergeSpeechDeliveryMetrics(
              calculateSpeechMetrics(answerTranscript, answerDurationMs),
              audioMetrics!,
              answerTranscript,
            );
      const answerVisualSummary =
        modeLabel === "Video" ? interviewMonitor.finishAnswerMetrics(current.id) : undefined;
      const answerMetrics = createPersistedAnswerMetrics({
        mode: modeLabel,
        feedback: evaluatedFeedback,
        speechMetrics: answerSpeechMetrics,
        audioMetrics,
        visualSummary: answerVisualSummary,
        answerDurationMs,
        pausedDurationMs: pause.getPausedDurationMs(),
        integrityEvents: pause.getIntegrityEvents(),
      });
      const feedbackWithMetrics: Feedback = {
        ...evaluatedFeedback,
        answerMetrics,
      };

      await persistSubmittedAnswer({
        fb: feedbackWithMetrics,
        metrics: answerMetrics,
        submittedAnswer,
      });

      if (modeLabel !== "Text") {
        await speech.finalizeAnswer();
      }

      speechDelivery.finishAnswer();
      setFeedback(feedbackWithMetrics);
      dispatch({ type: "SUBMISSION_COMPLETED" });
    } finally {
      submissionLockRef.current = false;
    }
  };

  const preserveCurrentDraft = () => {
    const activeSessionId = getActiveSessionId();
    const latestAnswer = answerRef.current.trim();

    if (!activeSessionId || !current || isSubmittedQuestion) return;

    if (!latestAnswer) {
      const existing = readInterviewAnswerDraft(activeSessionId, current.id);
      if (existing?.persistenceStatus !== "failed") {
        clearInterviewAnswerLocalDraft(activeSessionId, current.id);
      }
      return;
    }

    saveInterviewAnswerLocalDraft(activeSessionId, current.id, latestAnswer, {
      finalizedTranscript: modeLabel === "Text" ? "" : latestAnswer,
      mode: modeLabel.toLowerCase(),
      persistenceStatus: "editing",
    });
  };

  const resetQuestionInteraction = () => {
    interviewMonitor.discardAnswerMetrics();
    speech.resetAnswer();
    speechDelivery.resetAnswer();
    pause.reset();

    if (typeof window !== "undefined") {
      window.speechSynthesis.cancel();
    }

    setFeedback(null);
    submission.clearError();
    setSaveError("");
    answerRef.current = "";
    setAnswer("");
    setVideoAttemptComplete(false);
    dispatch({ type: "RESET_FOR_NEXT_QUESTION" });
  };

  const navigateToQuestion = (targetIndex: number) => {
    if (
      submissionLockRef.current ||
      finishLockRef.current ||
      loading ||
      isListening ||
      isSpeechFinalizing
    ) {
      return;
    }

    const boundedTargetIndex = Math.min(
      Math.max(targetIndex, 0),
      Math.min(activeQuestionIndex, questions.length - 1),
    );

    if (boundedTargetIndex === index) return;

    preserveCurrentDraft();
    resetQuestionInteraction();
    setIndex(boundedTargetIndex);
  };

  const handleNext = () => {
    if (!isSubmittedQuestion || !canGoNext) return;
    navigateToQuestion(index + 1);
  };

  const handleBackQuestion = () => {
    if (
      submissionLockRef.current ||
      finishLockRef.current ||
      loading ||
      isListening ||
      isSpeechFinalizing
    ) {
      return;
    }

    if (index > 0) {
      navigateToQuestion(index - 1);
      return;
    }

    preserveCurrentDraft();
    setShowExitDialog(true);
  };

  const handlePrevious = () => {
    if (index === 0) return;
    navigateToQuestion(index - 1);
  };

  const handleFinish = async () => {
    if (
      !canFinish ||
      !isSubmittedQuestion ||
      finishLockRef.current ||
      submissionLockRef.current ||
      isListening ||
      isSpeechFinalizing
    )
      return;
    finishLockRef.current = true;
    let terminalNavigationStarted = false;
    try {
      dispatch({ type: "SUBMISSION_STARTED" });
      setSaveError("");
      await speech.stopAndFinalize();
      camera.finishSegment();

      const alreadySaved = history.some(
        (item) => item.question.id === current.id && item.answer === answer,
      );

      const finalHistory =
        feedback && !alreadySaved
          ? [
              ...history,
              {
                question: current,
                answer,
                feedback,
              },
            ]
          : history;

      const activeSessionId =
        sessionId ||
        (typeof window !== "undefined" ? localStorage.getItem("ir.sessionId") || "" : "");

      let report: FinalReport;
      const speechMetrics =
        modeLabel === "Text"
          ? undefined
          : mergeSpeechDeliveryMetrics(
              speech.getFinalMetrics(),
              speechDelivery.getMetrics(),
              speech.getTranscript(),
            );
      const scoredVisualSummary = interviewMonitor.getScoredSummary();
      const visualMetrics =
        modeLabel === "Video"
          ? applyCameraEngagementMetrics(
              camera.getFinalMetrics(),
              scoredVisualSummary.engagement,
              scoredVisualSummary.posture,
              scoredVisualSummary.hands,
            )
          : undefined;
      const integrityMetrics =
        modeLabel === "Video"
          ? {
              noFaceDurationMs: interviewMonitor.summary.noFaceDurationMs,
              multipleFaceDurationMs: interviewMonitor.summary.multipleFaceDurationMs,
              analysisErrorCount: interviewMonitor.summary.analysisErrors,
            }
          : undefined;

      debugScoring("final scoring inputs", {
        sessionId: activeSessionId,
        mode: modeLabel,
        answeredQuestions: finalHistory.length,
        answerScores: finalHistory.map((item) => ({
          questionId: item.question.id,
          overall: item.feedback.overall,
          source: item.feedback.source || "ai",
        })),
        speechMetrics: speechMetrics || null,
        videoMetrics: visualMetrics || null,
      });

      try {
        const baseReport = await generateFinalReport({
          answers: finalHistory,
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
          mode: normalizeInterviewModeValue(modeLabel),
          speechMetrics,
          visualMetrics,
        });

        report = enrichFinalReport({
          baseReport,
          setup,
          history: finalHistory,
          speechMetrics,
          visualMetrics,
          questions,
          integrityMetrics,
        });
      } catch (error) {
        console.error("AI final report failed:", error);

        report = enrichFinalReport({
          baseReport: buildFallbackFinalReport(finalHistory),
          setup,
          history: finalHistory,
          speechMetrics,
          visualMetrics,
          questions,
          integrityMetrics,
        });
        setSaveError(
          "We had trouble generating the enhanced report, so your report was created from the saved interview results.",
        );
      }

      localStorage.setItem("ir.report", JSON.stringify(report));
      localStorage.setItem(
        "ir.session",
        JSON.stringify({
          setup,
          sessionId: activeSessionId,
          history: finalHistory,
          questions,
        }),
      );

      if (user && activeSessionId) {
        try {
          try {
            await Promise.all([
              report.speechMetrics
                ? saveSpeechMetrics({
                    sessionId: activeSessionId,
                    userId: user.uid,
                    metrics: report.speechMetrics,
                  })
                : Promise.resolve(""),
              report.visualMetrics
                ? saveVisualMetrics({
                    sessionId: activeSessionId,
                    userId: user.uid,
                    metrics: report.visualMetrics,
                  })
                : Promise.resolve(""),
            ]);
          } catch (metricsError) {
            console.error("Failed to save multimodal metrics:", metricsError);
            setSaveError("Final report was created, but some multimodal metrics were not saved.");
          }

          await completeInterviewSession({
            sessionId: activeSessionId,
            userId: user.uid,
            overallScore: report.overallScore,
            finalReport: report,
          });
          setSessionStatus("completed");
          dispatch({ type: "SESSION_COMPLETED" });
        } catch (error) {
          console.error("Failed to complete Supabase session:", error);
          setSaveError(
            "Final report was created, but the Supabase session was not marked as completed.",
          );
        }
      }

      localStorage.removeItem("ir.sessionId");
      localStorage.removeItem("ir.activeAttemptId");

      if (!navigationLockRef.current) {
        navigationLockRef.current = true;
        terminalNavigationStarted = true;
        await navigate({ to: "/result" });
      }
    } finally {
      if (!terminalNavigationStarted) finishLockRef.current = false;
    }
  };

  const handleContinueLater = async () => {
    if (navigationLockRef.current || finishLockRef.current || submissionLockRef.current) {
      return;
    }

    navigationLockRef.current = true;
    const activeSessionId = getActiveSessionId();

    interviewMonitor.discardAnswerMetrics();
    setExitLoading(true);
    setSaveError("");

    try {
      let draftAnswer = answerRef.current.trim();

      if (current && !isSubmittedQuestion && modeLabel !== "Text") {
        const finalizedTranscript = (await stopAndFinalize()).trim();
        draftAnswer = answerRef.current.trim() || finalizedTranscript;
        speechDelivery.pause();
        dispatch({ type: "ANSWER_STOPPED" });

        if (draftAnswer && draftAnswer !== answerRef.current) {
          answerRef.current = draftAnswer;
          setAnswer(draftAnswer);
        }
      }

      if (activeSessionId) {
        localStorage.setItem("ir.sessionId", activeSessionId);

        if (current && !isSubmittedQuestion && draftAnswer) {
          saveInterviewAnswerLocalDraft(activeSessionId, current.id, draftAnswer, {
            finalizedTranscript: modeLabel === "Text" ? "" : draftAnswer,
            mode: modeLabel.toLowerCase(),
            persistenceStatus: "editing",
          });
        }
      }

      await persistProgress(activeQuestionIndex);
      await navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Failed to leave the interview safely:", error);
      setSaveError("Could not leave the interview safely. Your local draft is still preserved.");
      navigationLockRef.current = false;
    } finally {
      setExitLoading(false);
    }
  };

  const handleCancelSession = async () => {
    if (navigationLockRef.current || finishLockRef.current || submissionLockRef.current) return;
    navigationLockRef.current = true;
    const activeSessionId = getActiveSessionId();

    interviewMonitor.discardAnswerMetrics();
    resetSpeech();
    camera.finishSegment();
    setExitLoading(true);
    setSaveError("");

    try {
      if (user && activeSessionId) {
        await cancelInterviewSession({
          sessionId: activeSessionId,
          userId: user.uid,
        });
      }

      setSessionStatus("cancelled");
      dispatch({ type: "SESSION_CANCELLED" });
      localStorage.removeItem("ir.sessionId");
      localStorage.removeItem("ir.activeAttemptId");
      clearInterviewAnswerLocalDraft();
      await navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("Failed to cancel Supabase session:", error);
      setSaveError("Could not cancel the session. Please try again.");
      setExitLoading(false);
      navigationLockRef.current = false;
    }
  };

  const startVoiceInput = () => {
    if (
      isSubmittedQuestion ||
      index !== activeQuestionIndex ||
      isSpeechFinalizing ||
      loading ||
      (modeLabel === "Video" &&
        (videoAttemptComplete || !cameraStream || interviewMonitor.faceState !== "one_face"))
    ) {
      return;
    }

    if (modeLabel === "Video") {
      interviewMonitor.beginAnswerMetrics(current.id);
    }

    dispatch({ type: "ANSWER_STARTED" });
    speech.start();
    void speechDelivery.start();
  };

  const stopVoiceInput = async () => {
    if (isSpeechFinalizing || !isListening) return;

    speechDelivery.pause();

    const finalizedTranscript = (await stopAndFinalize()).trim();
    const latestAnswer = answerRef.current.trim() || finalizedTranscript;

    if (latestAnswer && latestAnswer !== answerRef.current) {
      answerRef.current = latestAnswer;
      setAnswer(latestAnswer);
    }

    if (modeLabel === "Video") {
      setVideoAttemptComplete(true);
    }

    dispatch({ type: "ANSWER_STOPPED" });
  };

  const restartSpokenAnswer = () => {
    if (
      isListening ||
      isSpeechFinalizing ||
      loading ||
      isSubmittedQuestion ||
      index !== activeQuestionIndex
    ) {
      return;
    }

    speech.resetAnswer();
    speechDelivery.resetAnswer();
    pause.reset();
    interviewMonitor.discardAnswerMetrics();

    const activeSessionId = getActiveSessionId();

    if (activeSessionId && current) {
      clearInterviewAnswerLocalDraft(activeSessionId, current.id);
    }

    answerRef.current = "";
    setAnswer("");
    setFeedback(null);
    setVideoAttemptComplete(false);
    submission.clearError();
    setSaveError("");

    dispatch({ type: "RESET_FOR_NEXT_QUESTION" });
  };

  const resumePausedVideoAnswer = pause.resume;
  const requestPauseSessionCancel = pause.requestCancelConfirmation;
  const closePauseSessionCancel = pause.closeCancelConfirmation;

  const speakCurrentQuestion = () => {
    if (!current?.text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(current.text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  };

  const handleCalibrationStreamReady = (stream: MediaStream | null) => {
    camera.handleStreamReady(stream, setSaveError);
  };

  return (
    <div className="app-container interview-room py-4">
      {modeLabel === "Video" && !videoCalibrationComplete && (
        <VideoReadinessCalibration
          interviewStarted={false}
          onComplete={() => camera.setCalibrationComplete(true)}
          onBack={navigateToStart}
          onStreamReady={handleCalibrationStreamReady}
          onMetricsUpdate={camera.setSignals}
        />
      )}

      <InterviewErrorNotices
        questionError={questionError}
        feedbackError={feedbackError}
        saveError={saveError}
      />
      <InterviewPauseCountdown
        seconds={pauseCountdownSeconds}
        warningType={interviewMonitor.warning?.type}
      />

      <InterviewPausedDialog
        open={monitoringPaused}
        questionNumber={index + 1}
        message={pause.message}
        faceState={interviewMonitor.faceState}
        faceCount={interviewMonitor.faceCount}
        recoverySeconds={pause.recoverySeconds}
        resumeReady={canResume(machine)}
        suspendedVideoRef={handleSuspendedVideoRef}
        exitLoading={exitLoading}
        cancelConfirmation={pause.showCancelConfirmation}
        onResume={resumePausedVideoAnswer}
        onRequestCancel={requestPauseSessionCancel}
        onCloseConfirmation={closePauseSessionCancel}
        onCancelSession={handleCancelSession}
      />
      <ExitInterviewDialog
        open={showExitDialog}
        loading={exitLoading}
        onContinueLater={handleContinueLater}
        onCancel={handleCancelSession}
        onClose={() => setShowExitDialog(false)}
      />
      <InterviewHeader
        setup={setup}
        modeLabel={modeLabel}
        hasSession={Boolean(sessionId)}
        onExit={() => setShowExitDialog(true)}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_380px]">
        <main className="space-y-6">
          <section className="app-panel p-5 sm:p-6">
            <InterviewQuestionCard
              index={index}
              total={questions.length}
              progress={progress}
              question={current.text}
              onBack={handleBackQuestion}
            >
              {!isSubmittedQuestion && modeLabel === "Text" && (
                <TextAnswerTools onReadQuestion={speakCurrentQuestion} />
              )}

              {!isSubmittedQuestion && modeLabel === "Voice" && (
                <VoiceAnswerTools
                  isListening={isListening}
                  isFinalizing={isSpeechFinalizing}
                  hasTranscript={Boolean(answer.trim())}
                  disabled={loading || isSubmittedQuestion || index !== activeQuestionIndex}
                  error={voiceError}
                  delivery={speechDelivery.snapshot}
                  deliveryError={speechDelivery.error}
                  onReadQuestion={speakCurrentQuestion}
                  onStart={startVoiceInput}
                  onStop={() => void stopVoiceInput()}
                  onRestart={restartSpokenAnswer}
                />
              )}

              {!isSubmittedQuestion && modeLabel === "Video" && (
                <VideoAnswerTools
                  videoRef={handleLiveVideoRef}
                  cameraActive={Boolean(cameraStream)}
                  cameraReconnecting={camera.state === "requesting"}
                  faceState={interviewMonitor.faceState}
                  faceLabel={interviewMonitor.faceLabel}
                  faceCount={interviewMonitor.faceCount}
                  running={interviewMonitor.running}
                  loading={interviewMonitor.loading}
                  monitoringPaused={monitoringPaused}
                  isListening={isListening}
                  isFinalizing={isSpeechFinalizing}
                  attemptComplete={videoAttemptComplete}
                  hasTranscript={Boolean(answer.trim())}
                  disabled={loading || isSubmittedQuestion || index !== activeQuestionIndex}
                  answerDurationMs={speech.getDurationMs()}
                  validPresenceRatio={interviewMonitor.summary.oneFaceRatio}
                  monitoringDurationMs={interviewMonitor.summary.totalMonitoringMs}
                  warning={interviewMonitor.warning || undefined}
                  monitorError={camera.error || interviewMonitor.error}
                  engagementActive={
                    answering && !monitoringPaused && pageVisible && !videoAttemptComplete
                  }
                  engagementGuidance={interviewMonitor.engagementGuidance}
                  debugHeadPose={interviewMonitor.smoothedHeadPose}
                  postureGuidance={interviewMonitor.postureGuidance}
                  postureFrame={interviewMonitor.postureFrame}
                  postureError={interviewMonitor.postureError}
                  handGuidance={interviewMonitor.handGuidance}
                  handFrame={interviewMonitor.handFrame}
                  handError={interviewMonitor.handError}
                  interimTranscript={interimTranscript}
                  voiceError={voiceError}
                  speechDelivery={speechDelivery.snapshot}
                  speechDeliveryError={speechDelivery.error}
                  onReadQuestion={speakCurrentQuestion}
                  onStart={startVoiceInput}
                  onStop={() => void stopVoiceInput()}
                  onRestart={restartSpokenAnswer}
                  onReconnectCamera={() => void camera.reconnect()}
                />
              )}
            </InterviewQuestionCard>
            <InterviewAnswerBox
              answer={answer}
              submitted={isSubmittedQuestion}
              editable={modeLabel === "Text" && !isSubmittedQuestion}
              modeLabel={modeLabel}
              onChange={(value) => {
                if (modeLabel !== "Text" || isSubmittedQuestion) {
                  return;
                }

                answerRef.current = value;
                setAnswer(value);
              }}
            />

            <InterviewActions
              index={index}
              submitted={isSubmittedQuestion}
              reviewing={isReviewingSubmittedQuestion}
              canGoNext={canGoNext}
              canFinish={canFinish}
              loading={loading}
              finalizing={loading || isListening || isSpeechFinalizing}
              hasAnswer={Boolean(answer.trim()) && !isListening && !isSpeechFinalizing}
              answerReady={modeLabel !== "Video" || videoAttemptComplete}
              onPrevious={handlePrevious}
              onSubmit={handleSubmit}
              onNext={handleNext}
              onFinish={handleFinish}
            />
          </section>

          {feedbackVisible && feedback && (
            <section>
              <FeedbackCard feedback={feedback} />
            </section>
          )}
        </main>

        <InterviewSidebar
          questions={questions}
          index={index}
          activeQuestionIndex={activeQuestionIndex}
          submittedQuestionIds={history.map((item) => item.question.id)}
          setup={setup}
          modeLabel={modeLabel}
          speechClarity={liveSpeechMetrics.speechClarityScore}
          wordsPerMinute={currentSpeakingPace.wpm}
          cameraStatus={
            isSubmittedQuestion
              ? "Review mode"
              : modeLabel !== "Video"
                ? "Not required"
                : !cameraStream
                  ? "Camera unavailable"
                  : monitoringPaused
                    ? `Paused — ${interviewMonitor.faceLabel}`
                    : videoAttemptComplete
                      ? "Answer complete — submit or restart"
                      : !isListening
                        ? "Ready — starts with answer"
                        : interviewMonitor.faceLabel
          }
        />
      </div>
    </div>
  );
}
