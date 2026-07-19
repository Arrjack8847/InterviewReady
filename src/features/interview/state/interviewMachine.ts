export type InterviewPhase =
  | "preparing"
  | "ready"
  | "answering"
  | "warning"
  | "pause_countdown"
  | "paused"
  | "recovering"
  | "resume_ready"
  | "submitting"
  | "feedback"
  | "completed"
  | "cancelled"
  | "error";

export type SpeechState = "idle" | "starting" | "listening" | "stopping" | "error";
export type CameraState = "inactive" | "ready" | "monitoring" | "warning" | "paused" | "error";

export interface InterviewMachineState {
  phase: InterviewPhase;
  pauseReason: string | null;
  warningType: string | null;
  recoverySeconds: number;
  pauseCancelConfirmation: boolean;
  errorMessage: string | null;
  pauseSource: "automatic" | "manual" | null;
}

export type InterviewMachineEvent =
  | { type: "PREPARATION_COMPLETED" }
  | { type: "CALIBRATION_COMPLETED" }
  | { type: "ANSWER_STARTED" }
  | { type: "ANSWER_STOPPED" }
  | { type: "MONITOR_WARNING"; warningType: string }
  | { type: "PAUSE_COUNTDOWN_STARTED"; warningType: string }
  | {
      type: "INTERVIEW_PAUSED";
      reason: string;
      source?: "automatic" | "manual";
      warningType?: string;
    }
  | { type: "RECOVERY_STARTED" }
  | { type: "RECOVERY_TICKED"; seconds: number }
  | { type: "RECOVERY_INTERRUPTED" }
  | { type: "RECOVERY_COMPLETED" }
  | { type: "ANSWER_RESUMED" }
  | { type: "SUBMISSION_STARTED" }
  | { type: "SUBMISSION_COMPLETED" }
  | { type: "SUBMISSION_FAILED" }
  | { type: "FEEDBACK_CLOSED" }
  | { type: "PAUSE_CANCEL_CONFIRMATION_OPENED" }
  | { type: "PAUSE_CANCEL_CONFIRMATION_CLOSED" }
  | { type: "SESSION_COMPLETED" }
  | { type: "SESSION_CANCELLED" }
  | { type: "FAILED"; message: string }
  | { type: "RESET_FOR_NEXT_QUESTION" }
  | { type: "RESET_FOR_SESSION" };

export const initialInterviewMachineState: InterviewMachineState = {
  phase: "preparing",
  pauseReason: null,
  warningType: null,
  recoverySeconds: 3,
  pauseCancelConfirmation: false,
  errorMessage: null,
  pauseSource: null,
};

const resetQuestionState = (phase: InterviewPhase): InterviewMachineState => ({
  ...initialInterviewMachineState,
  phase,
});

export function interviewMachineReducer(
  state: InterviewMachineState,
  event: InterviewMachineEvent,
): InterviewMachineState {
  switch (event.type) {
    case "PREPARATION_COMPLETED":
    case "CALIBRATION_COMPLETED":
      return state.phase === "preparing" ? resetQuestionState("ready") : state;
    case "ANSWER_STARTED":
      return state.phase === "ready" ? { ...state, phase: "answering", errorMessage: null } : state;
    case "ANSWER_STOPPED":
      return state.phase === "answering" ||
        state.phase === "warning" ||
        state.phase === "pause_countdown"
        ? { ...state, phase: "ready", warningType: null }
        : state;
    case "MONITOR_WARNING":
      return state.phase === "answering"
        ? { ...state, phase: "warning", warningType: event.warningType }
        : state;
    case "PAUSE_COUNTDOWN_STARTED":
      return state.phase === "answering" || state.phase === "warning"
        ? { ...state, phase: "pause_countdown", warningType: event.warningType }
        : state;
    case "INTERVIEW_PAUSED":
      return state.phase === "answering" ||
        state.phase === "warning" ||
        state.phase === "pause_countdown"
        ? {
            ...state,
            phase: "paused",
            pauseReason: event.reason,
            pauseSource: event.source ?? "manual",
            warningType: event.warningType ?? null,
            recoverySeconds: 3,
            pauseCancelConfirmation: false,
          }
        : state;
    case "RECOVERY_STARTED":
      return state.phase === "paused" && state.pauseSource === "automatic"
        ? { ...state, phase: "recovering", recoverySeconds: 3 }
        : state;
    case "RECOVERY_TICKED":
      return state.phase === "recovering"
        ? { ...state, recoverySeconds: Math.max(0, Math.min(3, event.seconds)) }
        : state;
    case "RECOVERY_INTERRUPTED":
      return state.phase === "recovering" || state.phase === "resume_ready"
        ? { ...state, phase: "paused", recoverySeconds: 3 }
        : state;
    case "RECOVERY_COMPLETED":
      return state.phase === "recovering"
        ? { ...state, phase: "resume_ready", recoverySeconds: 0 }
        : state;
    case "ANSWER_RESUMED":
      return state.phase === "resume_ready" ? resetQuestionState("answering") : state;
    case "SUBMISSION_STARTED":
      return state.phase === "ready" || state.phase === "feedback"
        ? { ...state, phase: "submitting", errorMessage: null }
        : state;
    case "SUBMISSION_COMPLETED":
      return state.phase === "submitting" ? { ...state, phase: "feedback" } : state;
    case "SUBMISSION_FAILED":
      return state.phase === "submitting"
        ? { ...state, phase: "ready", errorMessage: null }
        : state;
    case "FEEDBACK_CLOSED":
      return state.phase === "feedback" ? resetQuestionState("ready") : state;
    case "PAUSE_CANCEL_CONFIRMATION_OPENED":
      return state.phase === "paused" ||
        state.phase === "recovering" ||
        state.phase === "resume_ready"
        ? { ...state, pauseCancelConfirmation: true }
        : state;
    case "PAUSE_CANCEL_CONFIRMATION_CLOSED":
      return { ...state, pauseCancelConfirmation: false };
    case "SESSION_COMPLETED":
      return { ...state, phase: "completed", pauseCancelConfirmation: false };
    case "SESSION_CANCELLED":
      return { ...state, phase: "cancelled", pauseCancelConfirmation: false };
    case "FAILED":
      return { ...state, phase: "error", errorMessage: event.message };
    case "RESET_FOR_NEXT_QUESTION":
      return resetQuestionState("ready");
    case "RESET_FOR_SESSION":
      return initialInterviewMachineState;
  }
}
