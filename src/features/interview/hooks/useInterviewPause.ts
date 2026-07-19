import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Dispatch } from "react";

import type {
  InterviewMachineEvent,
  InterviewMachineState,
} from "../state/interviewMachine";
import {
  canResume,
  isPaused,
} from "../state/interviewSelectors";

interface UseInterviewPauseOptions {
  faceState: string;
  stopSpeech: () => void | Promise<void>;
  restartSpeech: () => void | Promise<void>;
  state: InterviewMachineState;
  dispatch: Dispatch<InterviewMachineEvent>;
  pageVisible: boolean;

  /**
   * A manually stopped video answer is complete and may not
   * be resumed. Automatic monitoring pauses remain resumable.
   */
  attemptComplete?: boolean;
}

type IntegrityEvent = {
  type: string;
  startedAt?: string;
  durationMs?: number;
};

const RECOVERY_DURATION_MS = 3_000;
const RESTART_DELAY_MS = 50;

export function useInterviewPause({
  faceState,
  stopSpeech,
  restartSpeech,
  state,
  dispatch,
  pageVisible,
  attemptComplete = false,
}: UseInterviewPauseOptions) {
  const recoveryStartedAtRef =
    useRef<number | null>(null);

  const restartTimerRef =
    useRef<number | null>(null);

  const mountedRef = useRef(true);

  const pauseStartedAtRef =
    useRef<number | null>(null);

  const pausedDurationMsRef = useRef(0);

  const integrityEventsRef =
    useRef<IntegrityEvent[]>([]);

  const paused = isPaused(state);

  const resumeReady =
    canResume(state) &&
    !attemptComplete &&
    faceState === "one_face" &&
    pageVisible;

  const clearRestartTimer =
    useCallback(() => {
      if (
        restartTimerRef.current !== null
      ) {
        window.clearTimeout(
          restartTimerRef.current,
        );

        restartTimerRef.current = null;
      }
    }, []);

  const stopSpeechSafely =
    useCallback(() => {
      try {
        void Promise.resolve(
          stopSpeech(),
        ).catch((error) => {
          console.error(
            "Failed to pause speech recognition:",
            error,
          );
        });
      } catch (error) {
        console.error(
          "Failed to pause speech recognition:",
          error,
        );
      }
    }, [stopSpeech]);

  const restartSpeechSafely =
    useCallback(() => {
      try {
        void Promise.resolve(
          restartSpeech(),
        ).catch((error) => {
          console.error(
            "Failed to resume speech recognition:",
            error,
          );
        });
      } catch (error) {
        console.error(
          "Failed to resume speech recognition:",
          error,
        );
      }
    }, [restartSpeech]);

  const reset = useCallback(() => {
    clearRestartTimer();

    recoveryStartedAtRef.current = null;
    pauseStartedAtRef.current = null;
    pausedDurationMsRef.current = 0;
    integrityEventsRef.current = [];

    dispatch({
      type: "RESET_FOR_NEXT_QUESTION",
    });
  }, [clearRestartTimer, dispatch]);

  const requestPause = useCallback(
    (pauseMessage: string) => {
      if (paused || attemptComplete) {
        return;
      }

      clearRestartTimer();
      stopSpeechSafely();

      recoveryStartedAtRef.current = null;

      dispatch({
        type: "INTERVIEW_PAUSED",
        reason: pauseMessage,
        source: "manual",
      });
    },
    [
      attemptComplete,
      clearRestartTimer,
      dispatch,
      paused,
      stopSpeechSafely,
    ],
  );

  /**
   * Automatic camera pauses become resumable only after
   * exactly one face remains visible for three seconds.
   *
   * A manually completed video attempt never enters recovery.
   */
  useEffect(() => {
    const automaticPause =
      paused &&
      state.pauseSource === "automatic";

    const recoveryAllowed =
      automaticPause &&
      !attemptComplete &&
      pageVisible &&
      faceState === "one_face";

    if (!recoveryAllowed) {
      recoveryStartedAtRef.current = null;

      if (state.phase === "recovering") {
        dispatch({
          type: "RECOVERY_INTERRUPTED",
        });
      }

      return;
    }

    if (state.phase === "paused") {
      dispatch({
        type: "RECOVERY_STARTED",
      });
    }

    if (
      state.phase !== "paused" &&
      state.phase !== "recovering"
    ) {
      return;
    }

    recoveryStartedAtRef.current ??=
      performance.now();

    const updateRecovery = () => {
      if (
        recoveryStartedAtRef.current === null
      ) {
        return;
      }

      const elapsedMs =
        performance.now() -
        recoveryStartedAtRef.current;

      const remainingMs = Math.max(
        RECOVERY_DURATION_MS - elapsedMs,
        0,
      );

      dispatch({
        type: "RECOVERY_TICKED",
        seconds: Math.ceil(
          remainingMs / 1_000,
        ),
      });

      if (remainingMs <= 0) {
        dispatch({
          type: "RECOVERY_COMPLETED",
        });
      }
    };

    updateRecovery();

    const intervalId =
      window.setInterval(
        updateRecovery,
        150,
      );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    attemptComplete,
    dispatch,
    faceState,
    pageVisible,
    paused,
    state.pauseSource,
    state.phase,
  ]);

  /**
   * Track paused duration and integrity events separately
   * from content and delivery scores.
   */
  useEffect(() => {
    if (
      paused &&
      pauseStartedAtRef.current === null
    ) {
      pauseStartedAtRef.current =
        performance.now();

      const eventType =
        state.pauseSource === "automatic" &&
        state.warningType
          ? `automatic_${state.warningType}_pause`
          : "manual_pause";

      integrityEventsRef.current.push({
        type: eventType,
        startedAt:
          new Date().toISOString(),
      });

      return;
    }

    if (
      !paused &&
      pauseStartedAtRef.current !== null
    ) {
      const durationMs = Math.max(
        0,
        performance.now() -
          pauseStartedAtRef.current,
      );

      pausedDurationMsRef.current +=
        durationMs;

      const currentEvent =
        integrityEventsRef.current.at(-1);

      if (
        currentEvent &&
        currentEvent.durationMs === undefined
      ) {
        currentEvent.durationMs =
          durationMs;
      }

      pauseStartedAtRef.current = null;
    }
  }, [
    paused,
    state.pauseSource,
    state.warningType,
  ]);

  /**
   * Prevent the page behind the pause dialog from scrolling.
   */
  useEffect(() => {
    if (!paused) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [paused]);

  /**
   * Resume only an automatically paused, incomplete attempt.
   * Manual Stop Answering is handled outside this hook and
   * permanently completes the current video attempt.
   */
  const resume = useCallback(() => {
    if (
      !resumeReady ||
      attemptComplete ||
      faceState !== "one_face" ||
      !pageVisible
    ) {
      return;
    }

    recoveryStartedAtRef.current = null;

    dispatch({
      type: "ANSWER_RESUMED",
    });

    clearRestartTimer();

    restartTimerRef.current =
      window.setTimeout(() => {
        restartTimerRef.current = null;

        if (
          !mountedRef.current ||
          document.visibilityState ===
            "hidden" ||
          attemptComplete
        ) {
          return;
        }

        restartSpeechSafely();
      }, RESTART_DELAY_MS);
  }, [
    attemptComplete,
    clearRestartTimer,
    dispatch,
    faceState,
    pageVisible,
    restartSpeechSafely,
    resumeReady,
  ]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      clearRestartTimer();
    },
    [clearRestartTimer],
  );

  const getPausedDurationMs =
    useCallback(
      () =>
        pausedDurationMsRef.current +
        (pauseStartedAtRef.current === null
          ? 0
          : Math.max(
              0,
              performance.now() -
                pauseStartedAtRef.current,
            )),
      [],
    );

  const getIntegrityEvents =
    useCallback(() => {
      const currentDuration =
        getPausedDurationMs();

      let completedDuration =
        pausedDurationMsRef.current;

      return integrityEventsRef.current.map(
        (
          event,
          eventIndex,
          events,
        ) => {
          if (
            event.durationMs !== undefined ||
            eventIndex !== events.length - 1
          ) {
            return {
              ...event,
            };
          }

          const durationMs = Math.max(
            0,
            currentDuration -
              completedDuration,
          );

          completedDuration += durationMs;

          return {
            ...event,
            durationMs,
          };
        },
      );
    }, [getPausedDurationMs]);

  return {
    isPaused: paused,
    message: state.pauseReason || "",
    recoverySeconds:
      state.recoverySeconds,
    resumeReady,
    showCancelConfirmation:
      state.pauseCancelConfirmation,

    requestPause,
    resume,

    requestCancelConfirmation: () =>
      dispatch({
        type:
          "PAUSE_CANCEL_CONFIRMATION_OPENED",
      }),

    closeCancelConfirmation: () =>
      dispatch({
        type:
          "PAUSE_CANCEL_CONFIRMATION_CLOSED",
      }),

    getPausedDurationMs,
    getIntegrityEvents,
    reset,
  };
}