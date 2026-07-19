interface InterviewPauseCountdownProps {
  seconds: number | null;
  warningType?: string;
}

export function InterviewPauseCountdown({ seconds, warningType }: InterviewPauseCountdownProps) {
  if (seconds === null) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-black/45 px-4 backdrop-blur-[2px]">
      <div className="text-center text-white">
        <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-xs font-medium backdrop-blur-xl">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          AI Interview Monitor
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/65">
          Interview will pause
        </p>
        <p className="mt-3 font-display text-[clamp(5rem,14vw,9rem)] font-semibold leading-none">
          {seconds}
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/75">
          {warningType === "multiple_faces"
            ? "More than one person is visible. Returning to one face cancels the pause."
            : "Your face is outside the camera frame. Returning to the frame cancels the pause."}
        </p>
      </div>
    </div>
  );
}
