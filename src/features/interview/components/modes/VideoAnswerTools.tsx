import type { RefCallback } from "react";
import {
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Video,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CameraEngagementGuidance,
  HeadPoseEstimate,
} from "../../monitoring/face/faceTypes";
import type {
  PostureFrameAnalysis,
  PostureGuidance,
} from "../../monitoring/posture/postureTypes";
import type {
  HandFrameAnalysis,
  HandGuidance,
} from "../../monitoring/hands/handTypes";
import type { SpeechDeliverySnapshot } from "../../speech/audio/audioTypes";

interface VideoAnswerToolsProps {
  videoRef: RefCallback<HTMLVideoElement>;

  cameraActive: boolean;
  cameraReconnecting: boolean;

  faceState: string;
  faceLabel: string;
  faceCount: number;

  running: boolean;
  loading: boolean;
  monitoringPaused: boolean;

  isListening: boolean;
  isFinalizing: boolean;
  attemptComplete: boolean;
  hasTranscript: boolean;
  disabled?: boolean;

  answerDurationMs: number;

  validPresenceRatio: number;
  monitoringDurationMs: number;

  warning?: {
    severity: string;
    message: string;
  };

  monitorError: string;

  engagementActive: boolean;
  engagementGuidance: CameraEngagementGuidance;
  debugHeadPose: HeadPoseEstimate | null;

  postureGuidance: PostureGuidance;
  postureFrame: PostureFrameAnalysis | null;
  postureError: string;

  handGuidance: HandGuidance;
  handFrame: HandFrameAnalysis | null;
  handError: string;

  speechDelivery: SpeechDeliverySnapshot;
  speechDeliveryError: string;

  interimTranscript: string;
  voiceError: string;

  onReadQuestion: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onReconnectCamera: () => void;
}

export function VideoAnswerTools(props: VideoAnswerToolsProps) {
  const showDebug =
    import.meta.env.DEV &&
    import.meta.env.VITE_INTERVIEW_MONITOR_DEBUG === "true";

  const canStart =
    !props.disabled &&
    !props.loading &&
    !props.monitoringPaused &&
    !props.isFinalizing &&
    !props.attemptComplete &&
    props.cameraActive &&
    props.faceState === "one_face";

  const statusLabel = getStatusLabel(props);
  const guidance = getPrimaryGuidance(props);

  const handleRestart = () => {
    if (
      props.disabled ||
      props.isListening ||
      props.isFinalizing ||
      !props.attemptComplete
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Restart this video answer? Your transcript and all speech and visual measurements for this question will be cleared.",
    );

    if (confirmed) {
      props.onRestart();
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-border bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Video className="h-4 w-4" />
            Video interview
          </h3>

          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Answer through your microphone while the camera evaluates your
            presentation. The camera is not recording or uploading a video.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={props.onReadQuestion}
          disabled={
            props.disabled ||
            props.isListening ||
            props.isFinalizing ||
            props.monitoringPaused
          }
        >
          <Volume2 className="mr-2 h-4 w-4" />
          Read Question
        </Button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
          <video
            ref={props.videoRef}
            className="aspect-video w-full -scale-x-100 object-cover"
            muted
            playsInline
            autoPlay
          />

          <div
            className="pointer-events-none absolute inset-[8%] rounded-[1.75rem] border border-white/25"
            aria-hidden="true"
          />

          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">
            <span
              className={[
                "h-2 w-2 rounded-full",
                props.isListening
                  ? "animate-pulse bg-red-400"
                  : props.attemptComplete
                    ? "bg-emerald-400"
                    : props.cameraActive
                      ? "bg-white"
                      : "bg-amber-400",
              ].join(" ")}
              aria-hidden="true"
            />

            {statusLabel}
          </div>

          {props.isListening && (
            <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/65 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">
              {formatDuration(props.answerDurationMs)}
            </div>
          )}

          <div
            className="absolute bottom-3 left-3 right-3 flex min-h-10 items-center gap-2 rounded-2xl border border-white/15 bg-black/70 px-4 py-3 text-xs font-medium text-white backdrop-blur-md"
            role="status"
            aria-live="polite"
          >
            <span
              className={[
                "h-2 w-2 shrink-0 rounded-full",
                props.faceState === "one_face"
                  ? "bg-emerald-400"
                  : props.faceState === "no_face" ||
                      props.faceState === "multiple_faces"
                    ? "bg-amber-400"
                    : props.faceState === "error"
                      ? "bg-red-400"
                      : "bg-white/50",
              ].join(" ")}
              aria-hidden="true"
            />

            <span>{props.faceLabel}</span>
          </div>
        </div>

        <div className="grid content-start gap-3">
          <StatusCard
            title={statusLabel}
            description={guidance}
            active={props.isListening}
            complete={props.attemptComplete}
            finalizing={props.isFinalizing}
          />

          <div className="grid grid-cols-2 gap-3">
            <CompactStatus
              label="Camera"
              value={
                props.cameraActive
                  ? "Ready"
                  : props.cameraReconnecting
                    ? "Reconnecting"
                    : "Unavailable"
              }
            />

            <CompactStatus
              label="Face"
              value={
                props.faceState === "one_face"
                  ? "One detected"
                  : props.faceState === "multiple_faces"
                    ? `${props.faceCount} detected`
                    : props.faceState === "no_face"
                      ? "Not detected"
                      : "Checking"
              }
            />

            <CompactStatus
              label="Microphone"
              value={
                props.isListening
                  ? props.speechDelivery.microphoneLevel || "Active"
                  : props.attemptComplete
                    ? "Stopped"
                    : "Ready"
              }
            />

            <CompactStatus
              label="Answer time"
              value={formatDuration(props.answerDurationMs)}
            />
          </div>

          {props.warning && (
            <div
              className={[
                "rounded-xl border px-4 py-3 text-sm",
                props.warning.severity === "pause"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
              ].join(" ")}
              role="alert"
            >
              {props.warning.message}
            </div>
          )}

          {!props.cameraActive && (
            <Button
              type="button"
              variant="outline"
              onClick={props.onReconnectCamera}
              disabled={props.cameraReconnecting || props.disabled}
              className="w-full"
            >
              {props.cameraReconnecting
                ? "Reconnecting camera…"
                : "Reconnect Camera"}
            </Button>
          )}

          {props.monitorError && (
            <ErrorNotice message={props.monitorError} />
          )}

          {props.voiceError && (
            <ErrorNotice message={props.voiceError} destructive />
          )}

          {props.postureError && (
            <ErrorNotice message={props.postureError} />
          )}

          {props.handError && (
            <ErrorNotice message={props.handError} />
          )}

          {props.speechDeliveryError && (
            <ErrorNotice
              message={`Audio analysis unavailable: ${props.speechDeliveryError}`}
            />
          )}
        </div>
      </div>

      <div className="mt-4">
        {props.isFinalizing ? (
          <Button
            type="button"
            disabled
            className="w-full justify-start rounded-2xl p-6"
          >
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />

            <span className="text-left">
              <span className="block font-semibold">
                Finalising Transcript…
              </span>

              <span className="text-xs">
                Please wait while the final spoken words are added.
              </span>
            </span>
          </Button>
        ) : props.isListening ? (
          <Button
            type="button"
            variant="destructive"
            onClick={props.onStop}
            disabled={props.disabled || props.monitoringPaused}
            className="w-full justify-start rounded-2xl p-6"
          >
            <MicOff className="mr-3 h-5 w-5" />

            <span className="text-left">
              <span className="block font-semibold">
                Stop Video Answer
              </span>

              <span className="text-xs">
                Stopping completes this attempt. You can then submit or restart.
              </span>
            </span>
          </Button>
        ) : props.attemptComplete ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Video answer complete
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Review the read-only transcript below. Submit this attempt or
                  restart the entire answer.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleRestart}
              disabled={props.disabled}
              className="mt-4 w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart Answer
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={props.onStart}
            disabled={!canStart}
            className="w-full justify-start rounded-2xl p-6"
          >
            <Mic className="mr-3 h-5 w-5 text-primary" />

            <span className="text-left">
              <span className="block font-semibold">
                Start Video Answer
              </span>

              <span className="text-xs text-muted-foreground">
                One complete attempt. After stopping, submit or restart.
              </span>
            </span>
          </Button>
        )}
      </div>

      {props.interimTranscript &&
        props.isListening &&
        !props.isFinalizing && (
          <div
            className="mt-3 rounded-xl border border-primary/20 bg-background px-4 py-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <span className="font-medium text-foreground">
              Listening:
            </span>{" "}
            {props.interimTranscript}
          </div>
        )}

      {showDebug && (
        <pre className="mt-4 overflow-auto rounded-xl border border-border bg-background p-3 text-[11px] text-muted-foreground">
          {JSON.stringify(
            {
              state: {
                cameraActive: props.cameraActive,
                monitorRunning: props.running,
                monitorLoading: props.loading,
                monitoringPaused: props.monitoringPaused,
                isListening: props.isListening,
                isFinalizing: props.isFinalizing,
                attemptComplete: props.attemptComplete,
                hasTranscript: props.hasTranscript,
              },
              face: {
                state: props.faceState,
                count: props.faceCount,
                validPresenceRatio: props.validPresenceRatio,
                monitoringDurationMs: props.monitoringDurationMs,
              },
              headPose: props.debugHeadPose
                ? {
                    yaw: props.debugHeadPose.yaw?.toFixed(1),
                    pitch: props.debugHeadPose.pitch?.toFixed(1),
                    roll: props.debugHeadPose.roll?.toFixed(1),
                    engagement:
                      props.engagementGuidance.engagementState,
                    activeMs:
                      props.engagementGuidance.activeDurationMs,
                  }
                : null,
              posture: props.postureFrame
                ? {
                    shoulderAngle:
                      props.postureFrame.shoulderAngleDegrees?.toFixed(1),
                    torsoLean:
                      props.postureFrame.torsoLeanRatio?.toFixed(2),
                    framing: props.postureFrame.framing,
                    midpoint: [
                      props.postureFrame.shoulderMidpointX?.toFixed(2),
                      props.postureFrame.shoulderMidpointY?.toFixed(2),
                    ],
                    activeMs:
                      props.postureGuidance.activeDurationMs,
                  }
                : null,
              hands: props.handFrame
                ? {
                    count: props.handFrame.handCount,
                    activity: props.handGuidance.activity,
                    centers: props.handFrame.hands.map((hand) => [
                      hand.centerX.toFixed(2),
                      hand.centerY.toFixed(2),
                    ]),
                    overlap: props.handFrame.hands.map((hand) =>
                      hand.faceOverlapRatio.toFixed(2),
                    ),
                    cameraObstruction:
                      props.handFrame.cameraObstructionRatio?.toFixed(2),
                    activeMs: props.handGuidance.activeDurationMs,
                  }
                : null,
              audio: {
                rms: props.speechDelivery.rms.toFixed(4),
                peak: props.speechDelivery.peak.toFixed(4),
                noiseFloor:
                  props.speechDelivery.noiseFloor.toFixed(4),
                speechLikely:
                  props.speechDelivery.speechLikely,
                activeSpeechMs:
                  props.speechDelivery.activeSpeechMs,
                silenceMs:
                  props.speechDelivery.silenceDurationMs,
              },
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}

function getStatusLabel(props: VideoAnswerToolsProps): string {
  if (props.monitoringPaused) {
    return "Interview paused";
  }

  if (props.isFinalizing) {
    return "Finalising answer";
  }

  if (props.attemptComplete) {
    return "Answer complete";
  }

  if (props.isListening) {
    return "Answering";
  }

  if (props.cameraReconnecting) {
    return "Reconnecting camera";
  }

  if (!props.cameraActive) {
    return "Camera unavailable";
  }

  if (props.loading) {
    return "Preparing monitoring";
  }

  return "Ready";
}

function getPrimaryGuidance(
  props: VideoAnswerToolsProps,
): string {
  if (props.monitoringPaused) {
    return "Resolve the camera warning, then resume the same answer attempt.";
  }

  if (props.isFinalizing) {
    return "Your final spoken words are being added to the transcript.";
  }

  if (props.attemptComplete) {
    return "This attempt cannot be continued. Submit it or restart the whole answer.";
  }

  if (!props.cameraActive) {
    return "Reconnect your camera before starting the video answer.";
  }

  if (props.faceState === "multiple_faces") {
    return "Only one person is allowed during the interview.";
  }

  if (props.faceState === "no_face") {
    return "Move back into view and keep your face visible.";
  }

  if (props.faceState === "error") {
    return "Camera monitoring is temporarily unavailable.";
  }

  if (!props.isListening) {
    if (props.faceState !== "one_face") {
      return "Wait until exactly one face is detected before starting.";
    }

    return "Camera and microphone are ready. Start when you are prepared.";
  }

  if (
    props.engagementGuidance.movementLabel ===
    "Hold a steadier position"
  ) {
    return "Hold a steadier position when comfortable.";
  }

  if (props.speechDelivery.silenceDurationMs >= 3_000) {
    return "Take a breath, then continue your answer naturally.";
  }

  if (props.speechDelivery.guidance) {
    return props.speechDelivery.guidance;
  }

  return "Camera position looks good. Continue naturally.";
}

function StatusCard({
  title,
  description,
  active,
  complete,
  finalizing,
}: {
  title: string;
  description: string;
  active: boolean;
  complete: boolean;
  finalizing: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        {finalizing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : complete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <span
            className={[
              "h-2.5 w-2.5 rounded-full",
              active
                ? "animate-pulse bg-red-500"
                : "bg-muted-foreground/40",
            ].join(" ")}
            aria-hidden="true"
          />
        )}

        <p className="text-sm font-semibold text-foreground">
          {title}
        </p>
      </div>

      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function CompactStatus({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function ErrorNotice({
  message,
  destructive = false,
}: {
  message: string;
  destructive?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 text-xs leading-relaxed",
        destructive
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-background text-muted-foreground",
      ].join(" ")}
      role={destructive ? "alert" : undefined}
    >
      {message}
    </div>
  );
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(
    0,
    Math.floor(durationMs / 1_000),
  );

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds,
  ).padStart(2, "0")}`;
}