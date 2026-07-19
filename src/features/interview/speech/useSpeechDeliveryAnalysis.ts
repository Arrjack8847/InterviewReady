import { useCallback, useEffect, useRef, useState } from "react";

import { calculatePeak, calculateRms } from "./audio/audioAnalysis";
import { createAudioMetricsController } from "./audio/audioMetrics";
import { SPEECH_DELIVERY_THRESHOLDS as T } from "./audio/audioThresholds";
import type { SpeechDeliverySnapshot } from "./audio/audioTypes";
import {
  mapInterviewMediaError,
  requestInterviewMicrophoneStream,
} from "../mediaErrors";

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const EMPTY: SpeechDeliverySnapshot = {
  microphoneLevel: "unavailable",
  backgroundNoiseState: "unavailable",
  speechLikely: false,
  silenceDurationMs: 0,
  activeSpeechMs: 0,
  guidance: "Audio analysis unavailable",
  rms: 0,
  peak: 0,
  noiseFloor: 0,
};

const MICROPHONE_INTERRUPTED_MESSAGE =
  "Microphone access was interrupted. Your typed answer is still available.";

const MICROPHONE_MUTED_MESSAGE =
  "Microphone audio is temporarily interrupted. It should recover when the device becomes available.";

export function useSpeechDeliveryAnalysis(enabled: boolean) {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const intervalRef = useRef<number | null>(null);
  const readyPromiseRef = useRef<Promise<boolean> | null>(null);

  const controllerRef = useRef(createAudioMetricsController());

  const lastPublishRef = useRef(0);
  const microphoneRequestedRef = useRef(false);
  const mountedRef = useRef(false);
  const generationRef = useRef(0);

  const [snapshot, setSnapshot] = useState<SpeechDeliverySnapshot>(EMPTY);
  const [error, setError] = useState("");

  /**
   * Releases only resources owned by this hook.
   *
   * Increasing the generation prevents an older asynchronous microphone
   * request from attaching itself after the hook has been disabled,
   * restarted, or unmounted.
   */
  const releaseMicrophoneResources = useCallback(() => {
    generationRef.current += 1;
    controllerRef.current.setActive(false);

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const source = sourceRef.current;
    const analyser = analyserRef.current;
    const context = contextRef.current;
    const stream = streamRef.current;

    sourceRef.current = null;
    analyserRef.current = null;
    contextRef.current = null;
    streamRef.current = null;
    samplesRef.current = null;
    readyPromiseRef.current = null;

    microphoneRequestedRef.current = false;
    lastPublishRef.current = 0;

    try {
      source?.disconnect();
    } catch (disconnectError) {
      console.debug(
        "[Interview audio] Source was already disconnected.",
        disconnectError,
      );
    }

    try {
      analyser?.disconnect();
    } catch (disconnectError) {
      console.debug(
        "[Interview audio] Analyser was already disconnected.",
        disconnectError,
      );
    }

    if (context && context.state !== "closed") {
      void context.close().catch((closeError: unknown) => {
        console.debug(
          "[Interview audio] AudioContext could not close cleanly.",
          closeError,
        );
      });
    }

    stream?.getTracks().forEach((track) => {
      if (track.readyState !== "ended") {
        track.stop();
      }
    });
  }, []);

  const ensureReady = useCallback(async () => {
    if (!enabled || !mountedRef.current) {
      return false;
    }

    /**
     * Discard an existing stream if its audio track is no longer usable.
     */
    if (streamRef.current) {
      const existingTrack = streamRef.current.getAudioTracks()[0];

      const existingStreamIsInvalid =
        !streamRef.current.active ||
        !existingTrack ||
        existingTrack.readyState !== "live";

      if (existingStreamIsInvalid) {
        releaseMicrophoneResources();
      }
    }

    if (readyPromiseRef.current) {
      return readyPromiseRef.current;
    }

    const readyPromise = (async (): Promise<boolean> => {
      const generation = generationRef.current;

      try {
        if (!streamRef.current) {
          if (microphoneRequestedRef.current) {
            throw new Error(
              "A microphone request is already active for this interview.",
            );
          }

          microphoneRequestedRef.current = true;

          const requestedStream =
            await requestInterviewMicrophoneStream();

          const microphoneTrack =
            requestedStream.getAudioTracks()[0];

          if (
            !microphoneTrack ||
            microphoneTrack.readyState !== "live"
          ) {
            requestedStream
              .getTracks()
              .forEach((track) => track.stop());

            throw new DOMException(
              "No active microphone track was returned.",
              "NotFoundError",
            );
          }

          /**
           * The hook might have been disabled or unmounted while the browser
           * permission dialog was open.
           */
          if (
            !mountedRef.current ||
            generationRef.current !== generation ||
            !enabled
          ) {
            requestedStream
              .getTracks()
              .forEach((track) => track.stop());

            microphoneRequestedRef.current = false;

            return false;
          }

          streamRef.current = requestedStream;
          microphoneRequestedRef.current = false;

          microphoneTrack.addEventListener(
            "ended",
            () => {
              if (
                !mountedRef.current ||
                streamRef.current !== requestedStream
              ) {
                return;
              }

              releaseMicrophoneResources();

              setError(MICROPHONE_INTERRUPTED_MESSAGE);
              setSnapshot(EMPTY);
            },
            { once: true },
          );

          microphoneTrack.addEventListener("mute", () => {
            if (
              !mountedRef.current ||
              streamRef.current !== requestedStream
            ) {
              return;
            }

            setError(MICROPHONE_MUTED_MESSAGE);
          });

          microphoneTrack.addEventListener("unmute", () => {
            if (
              !mountedRef.current ||
              streamRef.current !== requestedStream
            ) {
              return;
            }

            setError((currentError) =>
              currentError === MICROPHONE_MUTED_MESSAGE
                ? ""
                : currentError,
            );
          });
        }

        if (
          !mountedRef.current ||
          generationRef.current !== generation ||
          !enabled
        ) {
          return false;
        }

        if (!contextRef.current) {
          const audioWindow = window as AudioContextWindow;

          const AudioContextConstructor =
            audioWindow.AudioContext ??
            audioWindow.webkitAudioContext;

          if (!AudioContextConstructor) {
            throw new DOMException(
              "Audio analysis is unsupported in this browser.",
              "NotSupportedError",
            );
          }

          const stream = streamRef.current;

          if (!stream || !stream.active) {
            throw new DOMException(
              "The microphone stream is no longer active.",
              "NotReadableError",
            );
          }

          const context = new AudioContextConstructor();
          const analyser = context.createAnalyser();
          const source =
            context.createMediaStreamSource(stream);

          analyser.fftSize = T.analyserFftSize;
          analyser.smoothingTimeConstant =
            T.analyserSmoothing;

          source.connect(analyser);

          contextRef.current = context;
          sourceRef.current = source;
          analyserRef.current = analyser;
          samplesRef.current = new Float32Array(
            analyser.fftSize,
          );

          lastPublishRef.current = 0;
        }

        const context = contextRef.current;

        if (!context) {
          throw new DOMException(
            "The audio analysis context could not be created.",
            "InvalidStateError",
          );
        }

        if (context.state === "suspended") {
          await context.resume();
        }

        if (
          !mountedRef.current ||
          generationRef.current !== generation ||
          !enabled
        ) {
          return false;
        }

        if (context.state !== "running") {
          throw new DOMException(
            "The browser did not allow audio analysis to start.",
            "NotAllowedError",
          );
        }

        if (intervalRef.current === null) {
          intervalRef.current = window.setInterval(() => {
            if (!mountedRef.current) {
              return;
            }

            const analyser = analyserRef.current;
            const samples = samplesRef.current;

            if (!analyser || !samples) {
              return;
            }

            try {
              analyser.getFloatTimeDomainData(samples);

              const now = performance.now();
              const rms = calculateRms(samples);
              const peak = calculatePeak(samples);

              const nextSnapshot =
                controllerRef.current.process(
                  rms,
                  peak,
                  now,
                );

              if (
                now - lastPublishRef.current >=
                T.liveGuidancePublishIntervalMs
              ) {
                lastPublishRef.current = now;
                setSnapshot(nextSnapshot);
              }
            } catch (analysisError) {
              console.warn(
                "[Interview audio] Live microphone analysis failed.",
                analysisError,
              );
            }
          }, T.sampleIntervalMs);
        }

        setError("");

        return true;
      } catch (caught) {
        if (
          !mountedRef.current ||
          generationRef.current !== generation
        ) {
          return false;
        }

        /**
         * Clean up partial resources, such as a microphone stream acquired
         * before AudioContext construction failed.
         */
        releaseMicrophoneResources();

        if (!mountedRef.current) {
          return false;
        }

        setError(
          mapInterviewMediaError(
            "microphone",
            caught,
          ).message,
        );

        setSnapshot(EMPTY);

        return false;
      }
    })();

    readyPromiseRef.current = readyPromise;

    const ready = await readyPromise;

    if (readyPromiseRef.current === readyPromise) {
      readyPromiseRef.current = null;
    }

    return ready;
  }, [
    enabled,
    releaseMicrophoneResources,
  ]);

  const start = useCallback(async () => {
    const ready = await ensureReady();

    if (
      ready &&
      enabled &&
      mountedRef.current
    ) {
      controllerRef.current.setActive(true);
    }

    return ready;
  }, [enabled, ensureReady]);

  const pause = useCallback(() => {
    controllerRef.current.setActive(false);

    setSnapshot((currentSnapshot) => ({
      ...currentSnapshot,
      speechLikely: false,
      silenceDurationMs: 0,
      guidance: "Audio scoring paused",
    }));
  }, []);

  const resetSnapshot = useCallback(
    (guidance: string) => {
      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        speechLikely: false,
        silenceDurationMs: 0,
        activeSpeechMs: 0,
        guidance,
      }));
    },
    [],
  );

  const finishAnswer = useCallback(() => {
    controllerRef.current.finishAnswer();
    resetSnapshot("Audio analysis ready");
  }, [resetSnapshot]);

  const resetAnswer = useCallback(() => {
    controllerRef.current.resetAnswer();
    resetSnapshot("Audio analysis ready");
  }, [resetSnapshot]);

  const reset = useCallback(() => {
    controllerRef.current.resetSession();
    resetSnapshot("Audio analysis ready");
  }, [resetSnapshot]);

  const getAnswerMetrics = useCallback(() => {
    return controllerRef.current.getAnswerMetrics();
  }, []);

  const getMetrics = useCallback(() => {
    return controllerRef.current.getMetrics();
  }, []);

  /**
   * React development Strict Mode can execute effect setup, cleanup, and
   * setup again. The mounted flag must therefore be restored to true inside
   * the effect setup.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      releaseMicrophoneResources();
    };
  }, [releaseMicrophoneResources]);

  /**
   * Text interviews and disabled interview states must not keep the
   * microphone, analyzer interval, or AudioContext running.
   */
  useEffect(() => {
    if (enabled) {
      return;
    }

    releaseMicrophoneResources();

    if (mountedRef.current) {
      setSnapshot(EMPTY);
      setError("");
    }
  }, [
    enabled,
    releaseMicrophoneResources,
  ]);

  return {
    snapshot,
    error,
    start,
    pause,
    finishAnswer,
    resetAnswer,
    reset,
    getAnswerMetrics,
    getMetrics,
  };
}