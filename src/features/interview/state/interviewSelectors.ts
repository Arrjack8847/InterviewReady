import type { InterviewMachineState } from "./interviewMachine";

export const isAnswering = (state: InterviewMachineState) =>
  state.phase === "answering" || state.phase === "warning" || state.phase === "pause_countdown";

export const isPaused = (state: InterviewMachineState) =>
  state.phase === "paused" || state.phase === "recovering" || state.phase === "resume_ready";

export const canResume = (state: InterviewMachineState) => state.phase === "resume_ready";
export const isSubmitting = (state: InterviewMachineState) => state.phase === "submitting";
export const isShowingFeedback = (state: InterviewMachineState) => state.phase === "feedback";
