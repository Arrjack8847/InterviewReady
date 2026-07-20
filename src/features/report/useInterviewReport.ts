import { useCallback, useEffect, useState } from "react";
import {
  getInterviewSession,
  getSessionAnswers,
  getSessionSpeechMetrics,
  getSessionVisualMetrics,
} from "@/lib/supabaseService";
import { normalizeExperienceLevel, normalizeInterviewType } from "@/lib/types";
import type { AnswerWithFeedback, FinalReport, InterviewSetup } from "@/lib/types";
import { buildInterviewReportViewModel } from "./buildReportViewModel";
import type {
  InterviewReportLoadState,
  ReportAnswerSource,
  ReportSessionSource,
} from "./reportTypes";

type UseInterviewReportOptions = {
  source: "current" | "saved";
  sessionId?: string;
  userId?: string;
};

type CachedSession = {
  sessionId?: string;
  setup?: InterviewSetup;
  history?: AnswerWithFeedback[];
};

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function cachedAnswers(history: AnswerWithFeedback[] = []): ReportAnswerSource[] {
  return history.map((answer) => ({
    id: `cached-${answer.question.id}`,
    questionId: answer.question.id,
    questionText: answer.question.text,
    answerText: answer.answer,
    feedback: answer.feedback,
    evaluationStatus: "completed",
    strengths: answer.feedback.strengths,
    weaknesses: answer.feedback.weaknesses,
    improvedAnswer: answer.feedback.improvedAnswer,
    summary: answer.feedback.summary,
    interviewTip: answer.feedback.interviewTip,
  }));
}

function normalizeCachedSetup(setup: InterviewSetup | null | undefined): InterviewSetup | null {
  if (!setup) return null;

  const targetRole = String(setup.targetRole || setup.role || "").trim();

  return {
    ...setup,
    role: targetRole,
    targetRole,
    type: normalizeInterviewType(setup.type),
    difficulty: normalizeExperienceLevel(setup.difficulty),
  };
}

function cachedSessionSource(cached: CachedSession | null): ReportSessionSource | null {
  const setup = normalizeCachedSetup(cached?.setup);
  if (!setup) return null;

  return {
    id: cached?.sessionId,
    role: setup.role,
    targetRole: setup.targetRole,
    targetCompany: setup.targetCompany,
    type: setup.type,
    interviewType: setup.type,
    difficulty: setup.difficulty,
    mode: setup.mode,
    status: "completed",
    questionCount: setup.questionCount,
  };
}

export function useInterviewReport({ source, sessionId, userId }: UseInterviewReportOptions) {
  const [state, setState] = useState<InterviewReportLoadState>({
    status: "loading",
    viewModel: null,
    error: null,
  });
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const load = async () => {
      setState({ status: "loading", viewModel: null, error: null });

      const cachedReport =
        source === "current" ? parseJson<FinalReport>(localStorage.getItem("ir.report")) : null;
      const cachedSession =
        source === "current" ? parseJson<CachedSession>(localStorage.getItem("ir.session")) : null;
      const cachedSetup = normalizeCachedSetup(
        cachedSession?.setup ||
          (source === "current"
            ? parseJson<InterviewSetup>(localStorage.getItem("ir.setup"))
            : null),
      );
      const resolvedSessionId =
        sessionId ||
        cachedSession?.sessionId ||
        (source === "current" ? localStorage.getItem("ir.sessionId") || "" : "");
      let report = cachedReport;
      let session = cachedSessionSource(cachedSession);
      let answers = cachedAnswers(cachedSession?.history);
      let questions = cachedSession?.history?.map((answer) => answer.question) || [];
      let dataWarning = "";

      if (resolvedSessionId) {
        try {
          const [savedSession, savedAnswers, savedSpeech, savedVisual] = await Promise.all([
            getInterviewSession(resolvedSessionId, userId),
            getSessionAnswers({ sessionId: resolvedSessionId, userId }),
            getSessionSpeechMetrics({ sessionId: resolvedSessionId, userId }).catch(() => null),
            getSessionVisualMetrics({ sessionId: resolvedSessionId, userId }).catch(() => null),
          ]);

          if (!savedSession && source === "saved") {
            if (active) {
              setState({
                status: "error",
                viewModel: null,
                error: "This report could not be found or you do not have permission to view it.",
              });
            }
            return;
          }

          if (savedSession) {
            session = savedSession;
            questions = savedSession.generatedQuestions;
            answers = savedAnswers;
            const savedReport = savedSession.finalReport;
            report = savedReport
              ? {
                  ...savedReport,
                  speechMetrics: savedReport.speechMetrics || savedSpeech?.metrics,
                  visualMetrics: savedReport.visualMetrics || savedVisual?.metrics,
                  overallScore:
                    typeof savedSession.overallScore === "number"
                      ? savedSession.overallScore
                      : savedReport.overallScore,
                }
              : report;
          }
        } catch (error) {
          console.error("Failed to load interview report:", error);
          if (source === "saved" || (!cachedReport && answers.length === 0)) {
            if (active) {
              setState({
                status: "error",
                viewModel: null,
                error: "The report could not be loaded. Check your connection and try again.",
              });
            }
            return;
          }
          dataWarning =
            "Saved data could not be refreshed, so this view uses the local report copy.";
        }
      }

      if (!report && !session && answers.length === 0) {
        if (active) setState({ status: "empty", viewModel: null, error: null });
        return;
      }

      const viewModel = buildInterviewReportViewModel({
        sessionId: resolvedSessionId,
        session,
        report,
        answers,
        questions,
        cachedSetup,
        dataWarning,
      });
      if (active) setState({ status: "ready", viewModel, error: null });
    };

    void load();
    return () => {
      active = false;
    };
  }, [reloadToken, sessionId, source, userId]);

  return { ...state, retry };
}
