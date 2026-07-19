import { ArrowRight, Send, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";

interface InterviewActionsProps {
  index: number;
  submitted: boolean;
  reviewing: boolean;
  canGoNext: boolean;
  canFinish: boolean;
  loading: boolean;
  finalizing: boolean;
  hasAnswer: boolean;
  answerReady: boolean;
  onPrevious: () => void;
  onSubmit: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export function InterviewActions({
  index,
  submitted,
  reviewing,
  canGoNext,
  canFinish,
  loading,
  finalizing,
  hasAnswer,
  answerReady,
  onPrevious,
  onSubmit,
  onNext,
  onFinish,
}: InterviewActionsProps) {
  const interactionLocked = loading || finalizing;

  const submitDisabled =
    interactionLocked ||
    submitted ||
    !hasAnswer ||
    !answerReady;

  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={onPrevious}
        disabled={index === 0 || interactionLocked}
      >
        Previous Question
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row">
        {!submitted && (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
          >
            <Send className="mr-2 h-4 w-4" />

            {loading
              ? "Evaluating your answer…"
              : finalizing
                ? "Finalising your answer…"
                : "Submit Answer"}
          </Button>
        )}

        {submitted && canFinish && (
          <Button
            type="button"
            onClick={onFinish}
            disabled={interactionLocked}
          >
            <Trophy className="mr-2 h-4 w-4" />

            {interactionLocked
              ? "Preparing your final report…"
              : "View Final Report"}
          </Button>
        )}

        {submitted && !canFinish && canGoNext && (
          <Button
            type="button"
            onClick={onNext}
            disabled={interactionLocked}
          >
            {reviewing ? "Next Question" : "Continue"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}