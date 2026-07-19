interface InterviewAnswerBoxProps {
  answer: string;
  submitted: boolean;
  editable: boolean;
  modeLabel: string;
  onChange: (value: string) => void;
}

export function InterviewAnswerBox({
  answer,
  submitted,
  editable,
  modeLabel,
  onChange,
}: InterviewAnswerBoxProps) {
  const isTextMode = modeLabel === "Text";
  const isVoiceMode = modeLabel === "Voice";
  const isVideoMode = modeLabel === "Video";
  const readOnly = submitted || !editable;

  const title = submitted
    ? "Submitted answer"
    : isTextMode
      ? "Your answer"
      : isVoiceMode
        ? "Voice transcript"
        : isVideoMode
          ? "Video answer transcript"
          : "Answer";

  const helperText = submitted
    ? "This answer has been submitted and can no longer be changed."
    : isTextMode
      ? "Write and edit your answer before submitting."
      : isVoiceMode
        ? "This transcript is read-only. Continue speaking to add more, or restart the whole answer."
        : isVideoMode
          ? "This transcript is read-only and can only be created through your spoken video response."
          : "Review your answer before submitting.";

  const placeholder = isTextMode
    ? "Write your answer here…"
    : isVoiceMode
      ? "Your spoken answer will appear here…"
      : isVideoMode
        ? "Your spoken video answer will appear here…"
        : "Your answer will appear here…";

  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <label
            htmlFor="interview-answer"
            className="text-sm font-semibold text-foreground"
          >
            {title}
          </label>

          <p className="mt-1 text-xs text-muted-foreground">
            {helperText}
          </p>
        </div>

        {readOnly && (
          <span className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Read only
          </span>
        )}
      </div>

      <textarea
        id="interview-answer"
        value={answer}
        readOnly={readOnly}
        aria-readonly={readOnly}
        placeholder={placeholder}
        rows={8}
        onChange={(event) => {
          if (!readOnly) {
            onChange(event.target.value);
          }
        }}
        onPaste={(event) => {
          if (readOnly) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          if (readOnly) {
            event.preventDefault();
          }
        }}
        className={[
          "min-h-48 w-full resize-y rounded-2xl border border-input px-4 py-3",
          "text-sm leading-6 text-foreground outline-none transition",
          "placeholder:text-muted-foreground",
          readOnly
            ? "cursor-default resize-none bg-muted/40 focus:border-input focus:ring-0"
            : "bg-background focus:border-primary focus:ring-2 focus:ring-primary/20",
        ].join(" ")}
      />
    </div>
  );
}