import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { calculateSpeechMetrics } from "@/lib/metrics";
import {
  decideSpeechRecovery,
  shouldAppendSpeechSegment,
} from "../resilience";
import type { WindowWithSpeechRecognition } from "../types";

interface UseSpeechRecognitionOptions {
  language: string;
  onFinalTranscript: (transcript: string) => void;
}

type RecognitionInstance = InstanceType<
  NonNullable<
    WindowWithSpeechRecognition["SpeechRecognition"]
  >
>;

type ImmediateStopOptions = {
  preserveInterim: boolean;
  updateState?: boolean;
};

type PendingFinalization = {
  promise: Promise<string>;
  resolve: (transcript: string) => void;
  generation: number;
  interimFallback: string;
  finalSegmentCountAtStop: number;
};

const FINALIZATION_TIMEOUT_MS = 1_800;

function friendlySpeechError(error?: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was blocked. Allow microphone access in your browser settings to continue the voice interview.";

    case "audio-capture":
      return "No working microphone was detected. Check your microphone connection and try again.";

    case "network":
      return "Live speech recognition lost its network connection. Your existing transcript is preserved.";

    case "no-speech":
      return "No speech was detected. Select Continue answering and speak clearly into the microphone.";

    case "aborted":
      return "Voice recognition was interrupted. Your existing transcript is preserved.";

    default:
      return "Voice recognition stopped unexpectedly. Your existing transcript is preserved.";
  }
}

export function useSpeechRecognition({
  language,
  onFinalTranscript,
}: UseSpeechRecognitionOptions) {
  const recognitionRef =
    useRef<RecognitionInstance | null>(null);

  const mountedRef = useRef(false);
  const keepListeningRef = useRef(false);
  const isFinalizingRef = useRef(false);

  const startedAtRef =
    useRef<number | null>(null);

  const durationMsRef = useRef(0);
  const completedDurationMsRef = useRef(0);

  const transcriptRef = useRef("");
  const completedTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const callbackRef =
    useRef(onFinalTranscript);

  const recognitionGenerationRef = useRef(0);
  const retryCountRef = useRef(0);

  const lastRecognitionErrorRef =
    useRef<string | null>(null);

  const restartTimerRef =
    useRef<number | null>(null);

  const finalizationTimerRef =
    useRef<number | null>(null);

  const pendingFinalizationRef =
    useRef<PendingFinalization | null>(null);

  const finalSegmentCountRef = useRef(0);

  const previousFinalSegmentRef = useRef({
    value: "",
    atMs: 0,
  });

  const [isListening, setIsListening] =
    useState(false);

  const [isFinalizing, setIsFinalizing] =
    useState(false);

  const [
    interimTranscript,
    setInterimTranscript,
  ] = useState("");

  const [error, setError] =
    useState("");

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(
      (
        window as WindowWithSpeechRecognition
      ).SpeechRecognition ||
        (
          window as WindowWithSpeechRecognition
        ).webkitSpeechRecognition,
    );

  useEffect(() => {
    callbackRef.current =
      onFinalTranscript;
  }, [onFinalTranscript]);

  const updateInterimTranscript =
    useCallback((value: string) => {
      interimTranscriptRef.current =
        value;

      if (mountedRef.current) {
        setInterimTranscript(value);
      }
    }, []);

  const clearRestartTimer =
    useCallback(() => {
      if (
        restartTimerRef.current !== null
      ) {
        globalThis.clearTimeout(
          restartTimerRef.current,
        );

        restartTimerRef.current = null;
      }
    }, []);

  const clearFinalizationTimer =
    useCallback(() => {
      if (
        finalizationTimerRef.current !==
        null
      ) {
        globalThis.clearTimeout(
          finalizationTimerRef.current,
        );

        finalizationTimerRef.current =
          null;
      }
    }, []);

  const finishSegment =
    useCallback(() => {
      if (
        startedAtRef.current === null
      ) {
        return;
      }

      durationMsRef.current += Math.max(
        0,
        performance.now() -
          startedAtRef.current,
      );

      startedAtRef.current = null;
    }, []);

  const appendFinalSegment = useCallback(
    (rawSegment: string): boolean => {
      const segment =
        rawSegment.trim();

      if (!segment) {
        return false;
      }

      const nowMs =
        performance.now();

      const shouldAppend =
        shouldAppendSpeechSegment({
          segment,
          previousSegment:
            previousFinalSegmentRef
              .current.value,
          previousAtMs:
            previousFinalSegmentRef
              .current.atMs,
          nowMs,
        });

      if (!shouldAppend) {
        return false;
      }

      previousFinalSegmentRef.current = {
        value: segment,
        atMs: nowMs,
      };

      transcriptRef.current =
        `${transcriptRef.current} ${segment}`.trim();

      finalSegmentCountRef.current += 1;

      callbackRef.current(segment);

      return true;
    },
    [],
  );

  const preserveCurrentInterim =
    useCallback(() => {
      const interim =
        interimTranscriptRef.current.trim();

      if (interim) {
        appendFinalSegment(interim);
      }

      updateInterimTranscript("");
    }, [
      appendFinalSegment,
      updateInterimTranscript,
    ]);

  const resolvePendingFinalization =
    useCallback(() => {
      const pending =
        pendingFinalizationRef.current;

      if (!pending) {
        return;
      }

      pendingFinalizationRef.current =
        null;

      clearFinalizationTimer();

      isFinalizingRef.current = false;

      if (mountedRef.current) {
        setIsFinalizing(false);
      }

      pending.resolve(
        transcriptRef.current.trim(),
      );
    }, [clearFinalizationTimer]);

  const completeGracefulStop =
    useCallback(
      (generation: number) => {
        const pending =
          pendingFinalizationRef.current;

        if (
          !pending ||
          pending.generation !== generation
        ) {
          return;
        }

        const receivedFinalResult =
          finalSegmentCountRef.current >
          pending.finalSegmentCountAtStop;

        /*
         * Interim text is used only as a fallback.
         *
         * Normally the browser sends a final result
         * after recognition.stop(). If no final result
         * arrives, preserve the final visible interim
         * phrase rather than losing the user's words.
         */
        if (
          !receivedFinalResult &&
          pending.interimFallback
        ) {
          appendFinalSegment(
            pending.interimFallback,
          );
        }

        updateInterimTranscript("");
        finishSegment();

        keepListeningRef.current = false;

        retryCountRef.current = 0;

        lastRecognitionErrorRef.current =
          null;

        recognitionRef.current = null;

        /*
         * Invalidate any delayed callbacks that arrive
         * after graceful finalization has completed.
         */
        recognitionGenerationRef.current +=
          1;

        if (mountedRef.current) {
          setIsListening(false);
        }

        resolvePendingFinalization();
      },
      [
        appendFinalSegment,
        finishSegment,
        resolvePendingFinalization,
        updateInterimTranscript,
      ],
    );

  /**
   * Immediately stop and discard the active recognizer.
   *
   * Used for:
   * - clearing an answer
   * - restarting an answer
   * - resetting the session
   * - component cleanup
   *
   * This does not wait for a final browser recognition
   * result.
   */
  const stopImmediately = useCallback(
    ({
      preserveInterim,
      updateState = true,
    }: ImmediateStopOptions) => {
      keepListeningRef.current = false;

      clearRestartTimer();
      clearFinalizationTimer();

      if (preserveInterim) {
        preserveCurrentInterim();
      } else {
        updateInterimTranscript("");
      }

      recognitionGenerationRef.current +=
        1;

      const recognition =
        recognitionRef.current;

      recognitionRef.current = null;

      try {
        const abortableRecognition =
          recognition as
            | (RecognitionInstance & {
                abort?: () => void;
              })
            | null;

        if (
          typeof abortableRecognition?.abort ===
          "function"
        ) {
          abortableRecognition.abort();
        } else {
          recognition?.stop();
        }
      } catch {
        // Recognition may already be inactive.
      }

      finishSegment();

      lastRecognitionErrorRef.current =
        null;

      retryCountRef.current = 0;

      isFinalizingRef.current = false;

      if (
        updateState &&
        mountedRef.current
      ) {
        setIsListening(false);
        setIsFinalizing(false);
      }

      /*
       * Resolve any pending graceful-stop promise so
       * callers are never left waiting.
       */
      resolvePendingFinalization();
    },
    [
      clearFinalizationTimer,
      clearRestartTimer,
      finishSegment,
      preserveCurrentInterim,
      resolvePendingFinalization,
      updateInterimTranscript,
    ],
  );

  /**
   * Gracefully stop recognition and wait for the browser's
   * final recognition result.
   *
   * This prevents the final spoken words from being lost.
   */
  const stopAndFinalize =
    useCallback(async (): Promise<string> => {
      const existingPending =
        pendingFinalizationRef.current;

      if (existingPending) {
        return existingPending.promise;
      }

      keepListeningRef.current = false;

      clearRestartTimer();

      const recognition =
        recognitionRef.current;

      if (!recognition) {
        finishSegment();
        updateInterimTranscript("");

        isFinalizingRef.current = false;

        if (mountedRef.current) {
          setIsListening(false);
          setIsFinalizing(false);
        }

        return transcriptRef.current.trim();
      }

      const generation =
        recognitionGenerationRef.current;

      let resolvePromise:
        | ((transcript: string) => void)
        | null = null;

      const promise =
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });

      pendingFinalizationRef.current = {
        promise,
        resolve: (transcript) => {
          resolvePromise?.(transcript);
        },
        generation,
        interimFallback:
          interimTranscriptRef.current.trim(),
        finalSegmentCountAtStop:
          finalSegmentCountRef.current,
      };

      isFinalizingRef.current = true;

      if (mountedRef.current) {
        setIsListening(false);
        setIsFinalizing(true);
      }

      /*
       * Keep recognitionRef and the generation valid here.
       *
       * Calling stop() may produce one final onresult event.
       * Clearing recognitionRef before stop() would cause that
       * final result to be ignored.
       */
      try {
        recognition.stop();
      } catch {
        completeGracefulStop(generation);
        return promise;
      }

      finalizationTimerRef.current =
        globalThis.setTimeout(() => {
          finalizationTimerRef.current =
            null;

          completeGracefulStop(generation);
        }, FINALIZATION_TIMEOUT_MS) as unknown as number;

      return promise;
    },
    [
      clearRestartTimer,
      completeGracefulStop,
      finishSegment,
      updateInterimTranscript,
    ],
  );

  /**
   * Existing public stop method.
   *
   * It begins graceful finalization without requiring
   * every existing caller to await the result.
   */
  const stop = useCallback(() => {
    void stopAndFinalize();
  }, [stopAndFinalize]);

  const start = useCallback(
    (options?: { force?: boolean }) => {
      if (
        typeof window === "undefined" ||
        !mountedRef.current
      ) {
        return;
      }

      /*
       * Do not start a second recognizer while the browser
       * is finalizing the previous one.
       */
      if (
        isFinalizingRef.current &&
        !options?.force
      ) {
        return;
      }

      const speechWindow =
        window as WindowWithSpeechRecognition;

      const Recognition =
        speechWindow.SpeechRecognition ||
        speechWindow.webkitSpeechRecognition;

      if (!Recognition) {
        keepListeningRef.current = false;

        setIsListening(false);

        setError(
          "Live speech recognition is unavailable in this browser. Use a supported browser such as Chrome or switch to text mode before starting the interview.",
        );

        return;
      }

      if (
        keepListeningRef.current &&
        !options?.force
      ) {
        return;
      }

      if (options?.force) {
        stopImmediately({
          preserveInterim: true,
        });
      }

      clearRestartTimer();

      setError("");
      updateInterimTranscript("");

      keepListeningRef.current = true;
      isFinalizingRef.current = false;

      retryCountRef.current = 0;

      lastRecognitionErrorRef.current =
        null;

      recognitionGenerationRef.current +=
        1;

      const recognitionGeneration =
        recognitionGenerationRef.current;

      const recognition =
        new Recognition();

      recognition.lang = language;
      recognition.continuous = true;
      recognition.interimResults = true;

      const isCurrent = () =>
        mountedRef.current &&
        recognitionGenerationRef.current ===
          recognitionGeneration &&
        recognitionRef.current === recognition;

      recognition.onstart = () => {
        if (!isCurrent()) {
          return;
        }

        startedAtRef.current ??=
          performance.now();

        lastRecognitionErrorRef.current =
          null;

        isFinalizingRef.current = false;

        setIsListening(true);
        setIsFinalizing(false);
        setError("");
      };

      recognition.onresult = (event) => {
        if (!isCurrent()) {
          return;
        }

        const finalSegments: string[] = [];
        const interimSegments: string[] = [];

        for (
          let index =
            event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          const result =
            event.results[index];

          const transcript =
            result?.[0]?.transcript?.trim() ??
            "";

          if (!transcript) {
            continue;
          }

          if (result.isFinal) {
            finalSegments.push(transcript);
          } else {
            interimSegments.push(transcript);
          }
        }

        for (const segment of finalSegments) {
          appendFinalSegment(segment);
        }

        if (finalSegments.length > 0) {
          retryCountRef.current = 0;

          lastRecognitionErrorRef.current =
            null;
        }

        updateInterimTranscript(
          interimSegments.join(" ").trim(),
        );
      };

      recognition.onnomatch = () => {
        if (!isCurrent()) {
          return;
        }

        updateInterimTranscript("");
      };

      recognition.onerror = (event) => {
        if (!isCurrent()) {
          return;
        }

        const recognitionError =
          event.error || "unknown";

        lastRecognitionErrorRef.current =
          recognitionError;

        const gracefulStopPending =
          pendingFinalizationRef.current
            ?.generation ===
          recognitionGeneration;

        if (
          recognitionError === "aborted" &&
          !keepListeningRef.current &&
          !gracefulStopPending
        ) {
          return;
        }

        if (
          recognitionError ===
            "not-allowed" ||
          recognitionError ===
            "service-not-allowed" ||
          recognitionError ===
            "audio-capture"
        ) {
          keepListeningRef.current = false;
        }

        finishSegment();

        /*
         * Keep the interim phrase during graceful stop so it
         * can be used if the browser never returns a final
         * result.
         */
        if (!gracefulStopPending) {
          updateInterimTranscript("");
        }

        if (
          recognitionError !== "aborted" &&
          recognitionError !== "no-speech"
        ) {
          setError(
            friendlySpeechError(
              recognitionError,
            ),
          );
        }

        setIsListening(false);
      };

      recognition.onend = () => {
        if (!isCurrent()) {
          return;
        }

        finishSegment();
        setIsListening(false);

        const gracefulStopPending =
          pendingFinalizationRef.current
            ?.generation ===
          recognitionGeneration;

        if (gracefulStopPending) {
          completeGracefulStop(
            recognitionGeneration,
          );

          return;
        }

        const pageVisible =
          typeof document === "undefined" ||
          document.visibilityState !==
            "hidden";

        const decision =
          decideSpeechRecovery({
            error:
              lastRecognitionErrorRef.current,
            shouldListen:
              keepListeningRef.current,
            pageVisible,
            retryCount:
              retryCountRef.current,
          });

        if (decision.restart) {
          retryCountRef.current += 1;

          restartTimerRef.current =
            window.setTimeout(() => {
              restartTimerRef.current =
                null;

              if (
                !isCurrent() ||
                !keepListeningRef.current
              ) {
                return;
              }

              if (
                typeof document !==
                  "undefined" &&
                document.visibilityState ===
                  "hidden"
              ) {
                keepListeningRef.current =
                  false;

                setIsListening(false);

                return;
              }

              try {
                lastRecognitionErrorRef.current =
                  null;

                recognition.start();
              } catch {
                keepListeningRef.current =
                  false;

                recognitionRef.current =
                  null;

                recognitionGenerationRef.current +=
                  1;

                setIsListening(false);

                setError(
                  friendlySpeechError(),
                );
              }
            }, decision.delayMs);

          return;
        }

        recognitionRef.current = null;

        recognitionGenerationRef.current +=
          1;

        if (
          decision.terminal &&
          keepListeningRef.current
        ) {
          setError(
            friendlySpeechError(
              lastRecognitionErrorRef.current ??
                undefined,
            ),
          );
        }

        keepListeningRef.current = false;

        updateInterimTranscript("");
        setIsListening(false);
      };

      recognitionRef.current =
        recognition;

      try {
        recognition.start();
      } catch {
        if (
          recognitionRef.current ===
          recognition
        ) {
          recognitionRef.current = null;
        }

        keepListeningRef.current = false;

        recognitionGenerationRef.current +=
          1;

        setIsListening(false);

        setError(
          "Voice recognition could not start. Check your microphone permission and try again.",
        );
      }
    },
    [
      appendFinalSegment,
      clearRestartTimer,
      completeGracefulStop,
      finishSegment,
      language,
      stopImmediately,
      updateInterimTranscript,
    ],
  );

  /**
   * Reset the complete speech-recognition session.
   */
  const reset = useCallback(() => {
    stopImmediately({
      preserveInterim: false,
    });

    durationMsRef.current = 0;
    completedDurationMsRef.current = 0;

    transcriptRef.current = "";
    completedTranscriptRef.current = "";

    finalSegmentCountRef.current = 0;

    previousFinalSegmentRef.current = {
      value: "",
      atMs: 0,
    };

    setError("");
  }, [stopImmediately]);

  /**
   * Complete the current answer and move its transcript
   * and duration into the completed interview totals.
   */
  const finalizeAnswer =
    useCallback(async () => {
      await stopAndFinalize();

      const transcript =
        transcriptRef.current.trim();

      if (transcript) {
        completedTranscriptRef.current =
          `${completedTranscriptRef.current} ${transcript}`.trim();
      }

      completedDurationMsRef.current +=
        durationMsRef.current;

      durationMsRef.current = 0;
      transcriptRef.current = "";

      finalSegmentCountRef.current = 0;

      previousFinalSegmentRef.current = {
        value: "",
        atMs: 0,
      };

      updateInterimTranscript("");
    }, [
      stopAndFinalize,
      updateInterimTranscript,
    ]);

  /**
   * Clear only the active question's speech answer.
   */
  const resetAnswer = useCallback(() => {
    stopImmediately({
      preserveInterim: false,
    });

    durationMsRef.current = 0;
    transcriptRef.current = "";

    finalSegmentCountRef.current = 0;

    previousFinalSegmentRef.current = {
      value: "",
      atMs: 0,
    };

    updateInterimTranscript("");
    setError("");
  }, [
    stopImmediately,
    updateInterimTranscript,
  ]);

  const getDurationMs =
    useCallback(() => {
      const currentSegmentDuration =
        startedAtRef.current === null
          ? 0
          : Math.max(
              0,
              performance.now() -
                startedAtRef.current,
            );

      return (
        durationMsRef.current +
        currentSegmentDuration
      );
    }, []);

  const getFinalMetrics =
    useCallback(() => {
      const transcript =
        `${completedTranscriptRef.current} ${transcriptRef.current}`.trim();

      const durationMs =
        completedDurationMsRef.current +
        getDurationMs();

      if (
        !transcript ||
        durationMs <= 0
      ) {
        return undefined;
      }

      return calculateSpeechMetrics(
        transcript,
        durationMs,
      );
    }, [getDurationMs]);

  const getTranscript =
    useCallback(
      () =>
        `${completedTranscriptRef.current} ${transcriptRef.current}`.trim(),
      [],
    );

  const getAnswerTranscript =
    useCallback(
      () =>
        transcriptRef.current.trim(),
      [],
    );

  /**
   * Restart the active recognizer when language changes.
   */
  useEffect(() => {
    if (!keepListeningRef.current) {
      return;
    }

    start({
      force: true,
    });
  }, [language, start]);

  /**
   * Strict Mode-safe lifecycle handling.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      keepListeningRef.current = false;
      isFinalizingRef.current = false;

      clearRestartTimer();
      clearFinalizationTimer();

      recognitionGenerationRef.current +=
        1;

      const recognition =
        recognitionRef.current;

      recognitionRef.current = null;

      try {
        const abortableRecognition =
          recognition as
            | (RecognitionInstance & {
                abort?: () => void;
              })
            | null;

        if (
          typeof abortableRecognition?.abort ===
          "function"
        ) {
          abortableRecognition.abort();
        } else {
          recognition?.stop();
        }
      } catch {
        // Recognition may already have stopped.
      }

      finishSegment();

      interimTranscriptRef.current = "";

      const pending =
        pendingFinalizationRef.current;

      pendingFinalizationRef.current =
        null;

      pending?.resolve(
        transcriptRef.current.trim(),
      );
    };
  }, [
    clearFinalizationTimer,
    clearRestartTimer,
    finishSegment,
  ]);

  return {
    isSupported,
    isListening,
    isFinalizing,
    interimTranscript,
    error,

    start,
    stop,
    stopAndFinalize,

    reset,
    finalizeAnswer,
    resetAnswer,
    finishSegment,

    getDurationMs,
    getFinalMetrics,
    getTranscript,
    getAnswerTranscript,
  };
}