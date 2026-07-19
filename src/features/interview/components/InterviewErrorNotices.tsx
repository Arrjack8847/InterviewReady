interface InterviewErrorNoticesProps {
  questionError: string;
  feedbackError: string;
  saveError: string;
}

export function InterviewErrorNotices({
  questionError,
  feedbackError,
  saveError,
}: InterviewErrorNoticesProps) {
  return (
    <>
      {[questionError, feedbackError, saveError].filter(Boolean).map((message) => (
        <div
          key={message}
          className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground"
        >
          {message}
        </div>
      ))}
    </>
  );
}
