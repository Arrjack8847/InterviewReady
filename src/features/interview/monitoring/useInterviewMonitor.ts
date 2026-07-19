import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createFaceMonitor,
  type FaceMonitoringSummary,
  type FacePresenceState,
} from "./face/faceMonitor";
import { createEmptyCameraEngagementSummary } from "./engagement/cameraEngagement";
import type { CameraEngagementGuidance, HeadPoseEstimate } from "./face/faceTypes";
import type { PostureFrameAnalysis, PostureGuidance } from "./posture/postureTypes";
import { createEmptyPostureSummary } from "./posture/postureMetrics";
import type { HandFrameAnalysis, HandGuidance } from "./hands/handTypes";
import { createEmptyHandSummary } from "./hands/handMetrics";
import {
  combineScoredVisualSummaries,
  copyScoredVisualSummary,
  createEmptyScoredVisualSummary,
  subtractScoredVisualSummary,
  type ScoredVisualSummary,
} from "./session/visualAnswerMetrics";

import {
  createFaceWarningController,
  getFaceWarningLabel,
  type FaceWarning,
} from "./face/faceWarnings";

type UseInterviewMonitorOptions = {
  stream: MediaStream | null;
  videoElement: HTMLVideoElement | null;
  enabled: boolean;
  engagementActive: boolean;
  securityActive: boolean;

  pauseEnabled?: boolean;

  onPauseRequested?: (warning: FaceWarning) => void;
};

export type InterviewMonitorState = {
  faceState: FacePresenceState;
  faceCount: number;

  faceLabel: string;
  warning: FaceWarning | null;

  loading: boolean;
  running: boolean;
  error: string;

  summary: FaceMonitoringSummary;
  engagementGuidance: CameraEngagementGuidance;
  smoothedHeadPose: HeadPoseEstimate | null;
  postureGuidance: PostureGuidance;
  postureFrame: PostureFrameAnalysis | null;
  postureError: string;
  handGuidance: HandGuidance;
  handFrame: HandFrameAnalysis | null;
  handError: string;
  beginAnswerMetrics: (answerId: string | number) => void;
  finishAnswerMetrics: (answerId: string | number) => ScoredVisualSummary | null;
  discardAnswerMetrics: () => void;
  getScoredSummary: () => ScoredVisualSummary;
  resetScoredMetrics: () => void;
};

const EMPTY_SUMMARY: FaceMonitoringSummary = {
  startedAtMs: null,
  endedAtMs: null,

  totalMonitoringMs: 0,
  oneFaceDurationMs: 0,
  noFaceDurationMs: 0,
  multipleFaceDurationMs: 0,
  unknownDurationMs: 0,

  oneFaceRatio: 0,
  noFaceRatio: 0,
  multipleFaceRatio: 0,

  measurementCount: 0,
  analysisErrors: 0,
  engagement: createEmptyCameraEngagementSummary(),
  posture: createEmptyPostureSummary(),
  hands: createEmptyHandSummary(),
};

const EMPTY_GUIDANCE: CameraEngagementGuidance = {
  engagementState: "not_measurable",
  engagementLabel: "Waiting for a clear face",
  headPositionLabel: "Not measurable",
  movementLabel: "Natural movement",
  activeDurationMs: 0,
};

export function useInterviewMonitor({
  stream,
  videoElement,
  enabled,
  engagementActive,
  securityActive,
  pauseEnabled = false,
  onPauseRequested,
}: UseInterviewMonitorOptions): InterviewMonitorState {
  const faceMonitorRef = useRef<ReturnType<typeof createFaceMonitor> | null>(null);

  const warningControllerRef = useRef<ReturnType<typeof createFaceWarningController> | null>(null);

  const onPauseRequestedRef = useRef(onPauseRequested);
  const engagementActiveRef = useRef(engagementActive);
  const securityActiveRef = useRef(securityActive);
  const answerBaselineRef = useRef<{
    answerId: string | number;
    summary: ScoredVisualSummary;
  } | null>(null);
  const completedAnswerMetricsRef = useRef(new Map<string | number, ScoredVisualSummary>());

  const [faceState, setFaceState] = useState<FacePresenceState>("inactive");

  const [faceCount, setFaceCount] = useState(0);

  const [warning, setWarning] = useState<FaceWarning | null>(null);

  const [loading, setLoading] = useState(false);

  const [running, setRunning] = useState(false);

  const [error, setError] = useState("");

  const [summary, setSummary] = useState<FaceMonitoringSummary>(EMPTY_SUMMARY);
  const [engagementGuidance, setEngagementGuidance] = useState(EMPTY_GUIDANCE);
  const [smoothedHeadPose, setSmoothedHeadPose] = useState<HeadPoseEstimate | null>(null);
  const [postureGuidance, setPostureGuidance] = useState<PostureGuidance>({
    state: "not_measurable",
    postureLabel: "Posture unavailable",
    framingLabel: "Framing unavailable",
    activeDurationMs: 0,
  });
  const [postureFrame, setPostureFrame] = useState<PostureFrameAnalysis | null>(null);
  const [postureError, setPostureError] = useState("");
  const [handGuidance, setHandGuidance] = useState<HandGuidance>({
    label: "Gesture analysis unavailable",
    activity: "not_measurable",
    activeDurationMs: 0,
  });
  const [handFrame, setHandFrame] = useState<HandFrameAnalysis | null>(null);
  const [handError, setHandError] = useState("");

  const readScoredSummary = useCallback((): ScoredVisualSummary => {
    const current = faceMonitorRef.current?.getSummary() ?? summary;
    return copyScoredVisualSummary({
      engagement: current.engagement,
      posture: current.posture,
      hands: current.hands,
    });
  }, [summary]);

  const beginAnswerMetrics = useCallback(
    (answerId: string | number) => {
      if (answerBaselineRef.current?.answerId === answerId) return;
      answerBaselineRef.current = {
        answerId,
        summary: readScoredSummary(),
      };
    },
    [readScoredSummary],
  );

  const finishAnswerMetrics = useCallback(
    (answerId: string | number) => {
      const baseline = answerBaselineRef.current;
      if (!baseline || baseline.answerId !== answerId) return null;
      const answerMetrics = subtractScoredVisualSummary(readScoredSummary(), baseline.summary);
      completedAnswerMetricsRef.current.set(answerId, answerMetrics);
      answerBaselineRef.current = null;
      return copyScoredVisualSummary(answerMetrics);
    },
    [readScoredSummary],
  );

  const discardAnswerMetrics = useCallback(() => {
    answerBaselineRef.current = null;
  }, []);

  const getScoredSummary = useCallback(() => {
    return [...completedAnswerMetricsRef.current.values()].reduce(
      combineScoredVisualSummaries,
      createEmptyScoredVisualSummary(),
    );
  }, []);

  const resetScoredMetrics = useCallback(() => {
    answerBaselineRef.current = null;
    completedAnswerMetricsRef.current.clear();
  }, []);

  useEffect(() => {
    onPauseRequestedRef.current = onPauseRequested;
  }, [onPauseRequested]);

  useEffect(() => {
    engagementActiveRef.current = engagementActive;
    securityActiveRef.current = securityActive;
    if (!securityActive) {
      warningControllerRef.current?.reset();
      setWarning(null);
    }
    if (!engagementActive) {
      setEngagementGuidance(EMPTY_GUIDANCE);
      setSmoothedHeadPose(null);
      setPostureFrame(null);
      setHandFrame(null);
    }
  }, [engagementActive, securityActive]);

  useEffect(() => {
    warningControllerRef.current = createFaceWarningController({
      pauseEnabled,

      onWarning: (nextWarning) => {
        setWarning(nextWarning);
      },

      onWarningCleared: () => {
        setWarning(null);
      },

      onPauseRequested: (nextWarning) => {
        onPauseRequestedRef.current?.(nextWarning);
      },
    });

    return () => {
      warningControllerRef.current?.reset();
      warningControllerRef.current = null;
    };
  }, [pauseEnabled]);

  useEffect(() => {
    if (!enabled || !stream || !videoElement) {
      const currentMonitor = faceMonitorRef.current;

      if (currentMonitor) {
        const stoppedSummary = currentMonitor.stop();

        setSummary(stoppedSummary);

        currentMonitor.dispose();
        faceMonitorRef.current = null;
      }

      warningControllerRef.current?.reset();

      setFaceState("inactive");
      setFaceCount(0);
      setWarning(null);
      setLoading(false);
      setRunning(false);
      setError("");
      setEngagementGuidance(EMPTY_GUIDANCE);
      setSmoothedHeadPose(null);
      setPostureFrame(null);
      setPostureError("");
      setHandFrame(null);
      setHandError("");

      return;
    }

    let cancelled = false;

    const monitor = createFaceMonitor({
      maxFaces: 2,
      analysisIntervalMs: 180,
      shouldRecordEngagement: () => engagementActiveRef.current,

      onStateChange: (nextState, nextFaceCount, snapshot) => {
        if (cancelled) {
          return;
        }

        setFaceState(nextState);
        setFaceCount(nextFaceCount);
        setLoading(snapshot.loading);
        setRunning(snapshot.running);
        setError(snapshot.error);
        setSummary(snapshot.summary);
        if (engagementActiveRef.current) setEngagementGuidance(snapshot.engagementGuidance);
        if (engagementActiveRef.current) {
          setPostureGuidance(snapshot.postureGuidance);
          setPostureFrame(snapshot.postureFrame);
          setHandGuidance(snapshot.handGuidance);
          setHandFrame(snapshot.handFrame);
        }
        setPostureError(snapshot.postureError);
        setHandError(snapshot.handError);
      },

      onMeasurement: (measurement, snapshot) => {
        if (cancelled) {
          return;
        }

        setFaceState(measurement.state);
        setFaceCount(measurement.faceCount);
        setSummary(snapshot.summary);
        if (engagementActiveRef.current) {
          setEngagementGuidance(snapshot.engagementGuidance);
          setSmoothedHeadPose(measurement.engagementFrame.headPose);
          setPostureGuidance(snapshot.postureGuidance);
          setPostureFrame(snapshot.postureFrame);
          setHandGuidance(snapshot.handGuidance);
          setHandFrame(snapshot.handFrame);
        }
        setPostureError(snapshot.postureError);
        setHandError(snapshot.handError);

        const activeWarning = securityActiveRef.current
          ? (warningControllerRef.current?.processMeasurement(measurement) ?? null)
          : null;

        setWarning(activeWarning);
      },

      onError: (monitorError) => {
        if (cancelled) {
          return;
        }

        setFaceState("error");
        setFaceCount(0);
        setLoading(false);
        setRunning(false);

        setError(
          monitorError.message ||
            "Visual analysis is unavailable, but your interview can continue.",
        );
      },
    });

    faceMonitorRef.current = monitor;

    setLoading(true);
    setRunning(false);
    setError("");
    setWarning(null);

    void monitor
      .start(videoElement)
      .then(() => {
        if (cancelled) {
          return;
        }

        const snapshot = monitor.getSnapshot();

        setFaceState(snapshot.state);
        setFaceCount(snapshot.faceCount);
        setLoading(snapshot.loading);
        setRunning(snapshot.running);
        setError(snapshot.error);
        setSummary(snapshot.summary);
        setEngagementGuidance(snapshot.engagementGuidance);
        setPostureGuidance(snapshot.postureGuidance);
        setPostureFrame(snapshot.postureFrame);
        setPostureError(snapshot.postureError);
        setHandGuidance(snapshot.handGuidance);
        setHandFrame(snapshot.handFrame);
        setHandError(snapshot.handError);
      })
      .catch((monitorError: unknown) => {
        if (cancelled) {
          return;
        }

        const normalizedError =
          monitorError instanceof Error
            ? monitorError
            : new Error("Visual analysis is unavailable.");

        setFaceState("error");
        setFaceCount(0);
        setLoading(false);
        setRunning(false);

        setError(normalizedError.message);
      });

    return () => {
      cancelled = true;

      warningControllerRef.current?.reset();

      const stoppedSummary = monitor.stop();

      setSummary(stoppedSummary);

      monitor.dispose();

      if (faceMonitorRef.current === monitor) {
        faceMonitorRef.current = null;
      }
    };
  }, [enabled, stream, videoElement]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const updateSummary = () => {
      const monitor = faceMonitorRef.current;

      if (!monitor) {
        return;
      }

      setSummary(monitor.getSummary());
    };

    const intervalId = window.setInterval(updateSummary, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  const faceLabel = useMemo(() => {
    if (warning) {
      return warning.message;
    }

    if (error) {
      return error;
    }

    if (faceState === "multiple_faces") {
      return faceCount > 1 ? `${faceCount} faces detected` : "More than one face detected";
    }

    return getFaceWarningLabel(faceState);
  }, [error, faceCount, faceState, warning]);

  return {
    faceState,
    faceCount,

    faceLabel,
    warning,

    loading,
    running,
    error,

    summary,
    engagementGuidance,
    smoothedHeadPose,
    postureGuidance,
    postureFrame,
    postureError,
    handGuidance,
    handFrame,
    handError,
    beginAnswerMetrics,
    finishAnswerMetrics,
    discardAnswerMetrics,
    getScoredSummary,
    resetScoredMetrics,
  };
}
