import {
  AlertTriangle,
  Camera,
  Loader2,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import {
  useEffect,
  useRef,
  type RefCallback,
} from "react";

import { Button } from "@/components/ui/button";
import { PauseCancelConfirmation } from "./PauseCancelConfirmation";

interface InterviewPausedDialogProps {
  open: boolean;
  questionNumber: number;
  message: string;
  faceState: string;
  faceCount: number;
  recoverySeconds: number;
  resumeReady: boolean;
  suspendedVideoRef: RefCallback<HTMLVideoElement>;
  exitLoading: boolean;
  cancelConfirmation: boolean;
  onResume: () => void;
  onRequestCancel: () => void;
  onCloseConfirmation: () => void;
  onCancelSession: () => void;
}

export function InterviewPausedDialog({
  open,
  questionNumber,
  message,
  faceState,
  faceCount,
  recoverySeconds,
  resumeReady,
  suspendedVideoRef,
  exitLoading,
  cancelConfirmation,
  onResume,
  onRequestCancel,
  onCloseConfirmation,
  onCancelSession,
}: InterviewPausedDialogProps) {
  const dialogRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement =
      document.activeElement as HTMLElement | null;

    dialogRef.current?.focus();

    return () => {
      previousActiveElement?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const status = getPauseStatus({
    faceState,
    faceCount,
    recoverySeconds,
    resumeReady,
  });

  const StatusIcon = status.Icon;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-hidden="true"
      />

      <div className="relative grid min-h-full place-items-center px-4 py-6 sm:px-6">
        <div
          ref={dialogRef}
          className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] text-white shadow-2xl outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspended-interview-title"
          aria-describedby="suspended-interview-description"
          tabIndex={-1}
        >
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="font-display text-sm font-semibold">
              InterviewReady
            </div>

            <div className="flex items-center gap-2 text-xs text-white/55">
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-amber-300"
                aria-hidden="true"
              />
              AI Interview Monitor
            </div>
          </header>

          {cancelConfirmation ? (
            <PauseCancelConfirmation
              loading={exitLoading}
              onClose={onCloseConfirmation}
              onCancel={onCancelSession}
            />
          ) : (
            <div className="p-5 sm:p-6">
              <div className="text-center">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/40">
                  Question {questionNumber} · Interview paused
                </p>

                <h2
                  id="suspended-interview-title"
                  className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
                >
                  {status.title}
                </h2>

                <p
                  id="suspended-interview-description"
                  className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60"
                >
                  {message || status.description}
                </p>
              </div>

              <div className="mx-auto mt-6 max-w-2xl">
                <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black">
                  <video
                    ref={suspendedVideoRef}
                    className="aspect-video w-full -scale-x-100 object-cover"
                    muted
                    playsInline
                    autoPlay
                  />

                  <div
                    className={[
                      "pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[34%]",
                      "-translate-x-1/2 -translate-y-1/2 rounded-[48%] border-2",
                      "transition-colors duration-300",
                      status.frameClassName,
                    ].join(" ")}
                    aria-hidden="true"
                  />

                  <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-2 text-xs font-medium backdrop-blur-xl">
                    <span
                      className={[
                        "h-2 w-2 rounded-full",
                        status.dotClassName,
                      ].join(" ")}
                      aria-hidden="true"
                    />

                    {status.faceStatus}
                  </div>

                  {faceState === "one_face" && !resumeReady && (
                    <div className="absolute inset-0 grid place-items-center bg-black/25">
                      <div className="rounded-3xl border border-white/10 bg-black/65 px-8 py-6 text-center backdrop-blur-xl">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                          Hold your position
                        </p>

                        <p
                          className="mt-2 font-display text-6xl font-semibold"
                          aria-live="polite"
                        >
                          {Math.max(recoverySeconds, 1)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mx-auto mt-6 max-w-2xl">
                <div
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center"
                  aria-live="polite"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                    <StatusIcon className="h-5 w-5 text-white/80" />
                  </div>

                  <h3 className="mt-3 font-display text-lg font-semibold">
                    {status.heading}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {status.guidance}
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    onClick={onResume}
                    disabled={!resumeReady || exitLoading}
                    className="min-h-12 rounded-full bg-white text-black hover:bg-white/90 disabled:bg-white/15 disabled:text-white/40"
                  >
                    {exitLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Please wait…
                      </>
                    ) : resumeReady ? (
                      "Resume Video Interview"
                    ) : faceState === "one_face" ? (
                      `Hold still · ${Math.max(recoverySeconds, 1)}`
                    ) : faceState === "multiple_faces" ? (
                      "Waiting for one person"
                    ) : (
                      "Waiting for one face"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={onRequestCancel}
                    disabled={exitLoading}
                    className="min-h-12 rounded-full border-red-400/45 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    Cancel Session
                  </Button>
                </div>

                <p className="mt-4 text-center text-xs leading-relaxed text-white/35">
                  Your transcript, answer duration, and completed speech and
                  presentation measurements remain preserved while paused.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getPauseStatus({
  faceState,
  faceCount,
  recoverySeconds,
  resumeReady,
}: {
  faceState: string;
  faceCount: number;
  recoverySeconds: number;
  resumeReady: boolean;
}) {
  if (faceState === "multiple_faces") {
    return {
      Icon: Users,
      title: "Multiple people detected",
      description:
        "Only one person may remain visible during the video interview.",
      heading: "More than one person is visible",
      guidance:
        "Ask everyone else to leave the camera frame. Recovery begins automatically when only the candidate remains visible.",
      faceStatus: `${Math.max(faceCount, 2)} faces detected`,
      frameClassName: "border-red-400",
      dotClassName: "bg-red-400",
    };
  }

  if (faceState === "no_face") {
    return {
      Icon: Camera,
      title: "Face not detected",
      description:
        "Return to the camera before continuing your current answer.",
      heading: "We cannot currently see you",
      guidance:
        "Move back into the camera frame and keep your face clearly visible. Your current answer remains preserved.",
      faceStatus: "Face not detected",
      frameClassName: "border-white/35",
      dotClassName: "bg-white/45",
    };
  }

  if (faceState === "error") {
    return {
      Icon: ShieldAlert,
      title: "Camera monitoring unavailable",
      description:
        "The interview cannot continue until camera monitoring recovers.",
      heading: "Monitoring connection interrupted",
      guidance:
        "Check the camera connection and browser permission. Keep this window visible while InterviewReady reconnects.",
      faceStatus: "Monitoring unavailable",
      frameClassName: "border-red-400",
      dotClassName: "bg-red-400",
    };
  }

  if (resumeReady) {
    return {
      Icon: UserCheck,
      title: "Ready to continue",
      description:
        "Your camera position is stable and the same answer attempt can resume.",
      heading: "Camera position confirmed",
      guidance:
        "Resume when ready. Your transcript and measurements will continue from where the interview paused.",
      faceStatus: "Ready to continue",
      frameClassName: "border-emerald-400",
      dotClassName: "bg-emerald-400",
    };
  }

  if (faceState === "one_face") {
    return {
      Icon: UserCheck,
      title: "Confirming camera position",
      description:
        "Remain in position while InterviewReady confirms one stable face.",
      heading: "Face detected — hold still",
      guidance: `Keep your face visible for ${Math.max(
        recoverySeconds,
        1,
      )} more second${Math.max(recoverySeconds, 1) === 1 ? "" : "s"}.`,
      faceStatus: "Face detected",
      frameClassName: "border-amber-300",
      dotClassName: "bg-amber-300",
    };
  }

  return {
    Icon: AlertTriangle,
    title: "Video interview paused",
    description:
      "Camera monitoring needs a clear view before the interview can continue.",
    heading: "Waiting for camera recovery",
    guidance:
      "Keep the interview tab visible and position yourself clearly in front of the camera.",
    faceStatus: "Checking camera",
    frameClassName: "border-white/35",
    dotClassName: "bg-white/45",
  };
}