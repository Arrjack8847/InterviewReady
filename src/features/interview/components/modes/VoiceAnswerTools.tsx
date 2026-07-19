import {
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SpeechDeliverySnapshot } from "../../speech/audio/audioTypes";

interface VoiceAnswerToolsProps {
  isListening: boolean;
  isFinalizing: boolean;
  hasTranscript: boolean;
  disabled?: boolean;
  error: string;
  delivery: SpeechDeliverySnapshot;
  deliveryError: string;
  onReadQuestion: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

export function VoiceAnswerTools({
  isListening,
  isFinalizing,
  hasTranscript,
  disabled = false,
  error,
  delivery,
  deliveryError,
  onReadQuestion,
  onStart,
  onStop,
  onRestart,
}: VoiceAnswerToolsProps) {
  const startButtonLabel = hasTranscript
    ? "Continue Answering"
    : "Start Answering";

  const handleRestart = () => {
    if (disabled || isListening || isFinalizing) {
      return;
    }

    const confirmed = window.confirm(
      "Restart this answer? Your current transcript and voice measurements for this question will be cleared.",
    );

    if (confirmed) {
      onRestart();
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-border bg-primary/5 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Mic className="h-4 w-4" />
          Voice mode
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Answer using your microphone. Your transcript will appear below,
          but manual typing and editing are disabled.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          onClick={onReadQuestion}
          disabled={disabled || isListening || isFinalizing}
        >
          <Volume2 className="mr-2 h-4 w-4" />
          Read Question
        </Button>

        {isFinalizing ? (
          <Button type="button" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Finalising Transcript
          </Button>
        ) : isListening ? (
          <Button
            type="button"
            variant="destructive"
            onClick={onStop}
            disabled={disabled}
          >
            <MicOff className="mr-2 h-4 w-4" />
            Stop Answering
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onStart}
            disabled={disabled}
          >
            <Mic className="mr-2 h-4 w-4" />
            {startButtonLabel}
          </Button>
        )}
      </div>

      {hasTranscript && !isListening && !isFinalizing && (
        <Button
          type="button"
          variant="ghost"
          className="mt-3 w-full sm:w-auto"
          onClick={handleRestart}
          disabled={disabled}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Restart Answer
        </Button>
      )}

      <div
        className="mt-4 rounded-xl border border-border bg-background p-4"
        aria-live="polite"
      >
        {isFinalizing ? (
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />

            <div>
              <p className="text-sm font-medium text-foreground">
                Finalising your transcript…
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Please wait while the final spoken words are added.
              </p>
            </div>
          </div>
        ) : isListening ? (
          <div className="flex items-start gap-3">
            <span className="relative mt-1 flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
            </span>

            <div>
              <p className="text-sm font-medium text-foreground">
                Listening…
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Speak naturally. Your transcript will appear in the
                read-only answer box below.
              </p>
            </div>
          </div>
        ) : hasTranscript ? (
          <div>
            <p className="text-sm font-medium text-foreground">
              Voice draft ready
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Continue speaking to add more, restart the answer, or submit it
              using the button below.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground">
              Ready to answer
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Select Start Answering when you are ready.
            </p>
          </div>
        )}
      </div>

      {isListening && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SignalBox
              label="Microphone"
              value={delivery.microphoneLevel || "Checking"}
            />

            <SignalBox
              label="Answer flow"
              value={
                delivery.silenceDurationMs >= 3_000
                  ? "Long pause"
                  : "Active"
              }
            />

            <SignalBox
              label="Background noise"
              value={delivery.backgroundNoiseState || "Checking"}
            />
          </div>

          {delivery.guidance && (
            <p className="mt-3 text-sm text-muted-foreground">
              {delivery.guidance}
            </p>
          )}
        </>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {deliveryError && (
        <p className="mt-3 text-sm text-muted-foreground">
          Audio analysis is temporarily unavailable: {deliveryError}
        </p>
      )}
    </div>
  );
}

function SignalBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>

      <p className="mt-1 font-display text-base font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}