import { useCallback, useEffect, useRef, useState } from "react";
import { calculateVisualMetrics, mergeVisualMetrics } from "@/lib/metrics";
import type { VideoPresentationMetrics } from "@/lib/videoPresentationAnalysis";
import { mapInterviewMediaError, requestInterviewCameraStream } from "../mediaErrors";

export type InterviewCameraState =
  | "idle"
  | "requesting"
  | "active"
  | "interrupted"
  | "failed"
  | "stopped";

export function useInterviewCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveVideoElement, setLiveVideoElement] = useState<HTMLVideoElement | null>(null);
  const [suspendedVideoElement, setSuspendedVideoElement] = useState<HTMLVideoElement | null>(null);
  const [signals, setSignals] = useState<VideoPresentationMetrics | null>(null);
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const [state, setState] = useState<InterviewCameraState>("idle");
  const [error, setError] = useState("");
  const startedAtRef = useRef<number | null>(null);
  const durationMsRef = useRef(0);
  const wasStartedRef = useRef(false);
  const reconnectPromiseRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);

  const finishSegment = useCallback(() => {
    if (!startedAtRef.current) return;
    durationMsRef.current += performance.now() - startedAtRef.current;
    startedAtRef.current = null;
  }, []);
  const getDurationMs = useCallback(
    () =>
      durationMsRef.current + (startedAtRef.current ? performance.now() - startedAtRef.current : 0),
    [],
  );

  const assignStream = useCallback(
    (element: HTMLVideoElement | null, currentStream: MediaStream | null) => {
      if (element && element.srcObject !== currentStream) element.srcObject = currentStream;
      return () => {
        if (element?.srcObject === currentStream && (!currentStream || !currentStream.active))
          element.srcObject = null;
      };
    },
    [],
  );
  useEffect(() => assignStream(liveVideoElement, stream), [assignStream, liveVideoElement, stream]);
  useEffect(
    () => assignStream(suspendedVideoElement, stream),
    [assignStream, suspendedVideoElement, stream],
  );

  const handleStreamReady = useCallback(
    (nextStream: MediaStream | null, onError: (message: string) => void) => {
      if (!nextStream) {
        finishSegment();
        streamRef.current = null;
        setStream(null);
        setState("stopped");
        return;
      }
      const liveTrack = nextStream.getVideoTracks().find((track) => track.readyState === "live");
      if (!nextStream.active || !liveTrack) {
        finishSegment();
        streamRef.current = null;
        setStream(null);
        setState("failed");
        setError("The camera stream ended before the interview started.");
        onError(
          "The camera stream ended before the interview started. Please restart video setup.",
        );
        return;
      }
      if (streamRef.current && streamRef.current !== nextStream)
        streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = nextStream;
      setStream(nextStream);
      setState("active");
      setError("");
      wasStartedRef.current = true;
      startedAtRef.current ??= performance.now();
      liveTrack.addEventListener(
        "ended",
        () => {
          if (!mountedRef.current) return;
          finishSegment();
          setState("interrupted");
          setError("Camera access was interrupted. Reconnect the camera to continue.");
          setStream((current) => {
            if (current === nextStream) {
              streamRef.current = null;
              return null;
            }
            return current;
          });
        },
        { once: true },
      );
      liveTrack.addEventListener("mute", () => {
        if (!mountedRef.current) return;
        setState("interrupted");
        setError("Camera video is temporarily interrupted.");
        finishSegment();
      });
      liveTrack.addEventListener("unmute", () => {
        if (!mountedRef.current) return;
        if (liveTrack.readyState !== "live") return;
        setState("active");
        setError("");
        startedAtRef.current ??= performance.now();
      });
    },
    [finishSegment],
  );

  const reconnect = useCallback(async () => {
    if (reconnectPromiseRef.current) return reconnectPromiseRef.current;
    const pending = (async () => {
      setState("requesting");
      setError("");
      try {
        const nextStream = await requestInterviewCameraStream();
        if (!mountedRef.current) {
          nextStream.getTracks().forEach((track) => track.stop());
          return false;
        }
        handleStreamReady(nextStream, (message) => setError(message));
        return true;
      } catch (caught) {
        if (!mountedRef.current) return false;
        const mapped = mapInterviewMediaError("camera", caught);
        setState("failed");
        setError(mapped.message);
        return false;
      }
    })();
    reconnectPromiseRef.current = pending;
    try {
      return await pending;
    } finally {
      if (reconnectPromiseRef.current === pending) reconnectPromiseRef.current = null;
    }
  }, [handleStreamReady]);

  const reset = useCallback(() => {
    setCalibrationComplete(false);
    setSignals(null);
    startedAtRef.current = null;
    durationMsRef.current = 0;
    wasStartedRef.current = false;
    setError("");
    setState(streamRef.current?.active ? "active" : "idle");
  }, []);
  const getFinalMetrics = useCallback(() => {
    if (!signals?.frameCount) return undefined;
    return mergeVisualMetrics(
      calculateVisualMetrics({
        mode: "Video",
        cameraEnabledMs: getDurationMs(),
        cameraWasStarted: wasStartedRef.current || Boolean(stream),
      }),
      signals,
    );
  }, [getDurationMs, signals, stream]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  return {
    stream,
    state,
    error,
    liveVideoElement,
    signals,
    calibrationComplete,
    setCalibrationComplete,
    setSignals,
    liveVideoRef: setLiveVideoElement,
    suspendedVideoRef: setSuspendedVideoElement,
    handleStreamReady,
    reconnect,
    finishSegment,
    getDurationMs,
    getFinalMetrics,
    reset,
  };
}
