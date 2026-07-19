import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { createCameraEngagementController } from "../engagement/cameraEngagement";
import {
  createInterviewPoseLandmarker,
  releaseInterviewPoseLandmarker,
} from "../posture/createPoseLandmarker";
import { analyzePostureFrame } from "../posture/postureAnalysis";
import {
  createEmptyPostureSummary,
  createPostureMetricsController,
} from "../posture/postureMetrics";
import { POSTURE_THRESHOLDS } from "../posture/postureThresholds";
import type {
  PostureFrameAnalysis,
  PostureGuidance,
  PostureMetricsSummary,
} from "../posture/postureTypes";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createHandAnalyzer, type HandAnalyzerController } from "@/lib/handAnalysis";
import { analyzeHandFrame } from "../hands/handAnalysis";
import { createEmptyHandSummary, createHandMetricsController } from "../hands/handMetrics";
import { HAND_THRESHOLDS } from "../hands/handThresholds";
import type { HandFrameAnalysis, HandGuidance, HandMetricsSummary } from "../hands/handTypes";
import { calculateFaceBounds, estimateCameraEngagementFrame, smoothHeadPose } from "./faceAnalysis";
import type {
  CameraEngagementFrame,
  CameraEngagementGuidance,
  CameraEngagementSummary,
  HeadPoseEstimate,
} from "./faceTypes";

import { createInterviewFaceLandmarker, readFaceDetectionResult } from "./createFaceLandmarker";

export type FacePresenceState =
  | "inactive"
  | "loading"
  | "one_face"
  | "no_face"
  | "multiple_faces"
  | "error";

export type FaceMeasurement = {
  timestampMs: number;
  faceCount: number;
  state: FacePresenceState;
  engagementFrame: CameraEngagementFrame;
};

export type FaceMonitoringSummary = {
  startedAtMs: number | null;
  endedAtMs: number | null;

  totalMonitoringMs: number;
  oneFaceDurationMs: number;
  noFaceDurationMs: number;
  multipleFaceDurationMs: number;
  unknownDurationMs: number;

  oneFaceRatio: number;
  noFaceRatio: number;
  multipleFaceRatio: number;

  measurementCount: number;
  analysisErrors: number;
  engagement: CameraEngagementSummary;
  posture: PostureMetricsSummary;
  hands: HandMetricsSummary;
};

export type FaceMonitorSnapshot = {
  state: FacePresenceState;
  faceCount: number;
  running: boolean;
  loading: boolean;
  error: string;
  latestMeasurement: FaceMeasurement | null;
  engagementGuidance: CameraEngagementGuidance;
  postureGuidance: PostureGuidance;
  postureFrame: PostureFrameAnalysis | null;
  postureError: string;
  handGuidance: HandGuidance;
  handFrame: HandFrameAnalysis | null;
  handError: string;
  summary: FaceMonitoringSummary;
};

export type FaceMonitorOptions = {
  analysisIntervalMs?: number;
  maxFaces?: number;
  shouldRecordEngagement?: () => boolean;

  onMeasurement?: (measurement: FaceMeasurement, snapshot: FaceMonitorSnapshot) => void;

  onStateChange?: (
    state: FacePresenceState,
    faceCount: number,
    snapshot: FaceMonitorSnapshot,
  ) => void;

  onError?: (error: Error) => void;
};

export type FaceMonitorController = {
  start: (videoElement: HTMLVideoElement) => Promise<void>;
  stop: () => FaceMonitoringSummary;
  reset: () => void;
  dispose: () => void;

  getSnapshot: () => FaceMonitorSnapshot;
  getSummary: () => FaceMonitoringSummary;

  isRunning: () => boolean;
};

const DEFAULT_ANALYSIS_INTERVAL_MS = 180;
const DEFAULT_MAX_FACES = 2;
const MAX_CONTINUOUS_FRAME_GAP_MS = 1_500;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getPresenceState(faceCount: number): FacePresenceState {
  if (faceCount <= 0) {
    return "no_face";
  }

  if (faceCount === 1) {
    return "one_face";
  }

  return "multiple_faces";
}

function createEmptySummary(): FaceMonitoringSummary {
  return {
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
    engagement: createCameraEngagementController().getSummary(),
    posture: createEmptyPostureSummary(),
    hands: createEmptyHandSummary(),
  };
}

function withRatios(summary: FaceMonitoringSummary): FaceMonitoringSummary {
  const totalDuration = Math.max(summary.totalMonitoringMs, 1);

  return {
    ...summary,

    oneFaceRatio: clamp(summary.oneFaceDurationMs / totalDuration, 0, 1),

    noFaceRatio: clamp(summary.noFaceDurationMs / totalDuration, 0, 1),

    multipleFaceRatio: clamp(summary.multipleFaceDurationMs / totalDuration, 0, 1),
  };
}

export function createFaceMonitor(options: FaceMonitorOptions = {}): FaceMonitorController {
  const analysisIntervalMs = options.analysisIntervalMs ?? DEFAULT_ANALYSIS_INTERVAL_MS;

  const maxFaces = options.maxFaces ?? DEFAULT_MAX_FACES;

  let landmarker: FaceLandmarker | null = null;
  let poseLandmarker: PoseLandmarker | null = null;
  let handAnalyzer: HandAnalyzerController | null = null;
  let videoElement: HTMLVideoElement | null = null;

  let animationFrameId: number | null = null;

  let running = false;
  let loading = false;
  let disposed = false;

  let state: FacePresenceState = "inactive";
  let faceCount = 0;
  let error = "";

  let lastAnalysisTimestampMs = 0;
  let lastPoseTimestampMs = 0;
  let lastHandTimestampMs = 0;
  let lastMeasurementTimestampMs: number | null = null;

  let latestMeasurement: FaceMeasurement | null = null;
  let summary = createEmptySummary();
  const engagementController = createCameraEngagementController();
  const postureController = createPostureMetricsController();
  const handController = createHandMetricsController();
  let smoothedHeadPose: HeadPoseEstimate | null = null;
  let postureFrame: PostureFrameAnalysis | null = null;
  let postureError = "";
  let handFrame: HandFrameAnalysis | null = null;
  let handError = "";

  function buildSnapshot(): FaceMonitorSnapshot {
    return {
      state,
      faceCount,
      running,
      loading,
      error,
      latestMeasurement,
      engagementGuidance: engagementController.getGuidance(
        latestMeasurement?.engagementFrame ?? null,
      ),
      postureGuidance: postureController.getGuidance(),
      postureFrame,
      postureError,
      handGuidance: handController.getGuidance(),
      handFrame,
      handError,
      summary: withRatios(summary),
    };
  }

  function reportState(nextState: FacePresenceState, nextFaceCount: number) {
    const changed = nextState !== state || nextFaceCount !== faceCount;

    state = nextState;
    faceCount = nextFaceCount;

    if (changed) {
      options.onStateChange?.(state, faceCount, buildSnapshot());
    }
  }

  function addDuration(previousState: FacePresenceState, durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return;
    }

    summary.totalMonitoringMs += durationMs;

    switch (previousState) {
      case "one_face":
        summary.oneFaceDurationMs += durationMs;
        break;

      case "no_face":
        summary.noFaceDurationMs += durationMs;
        break;

      case "multiple_faces":
        summary.multipleFaceDurationMs += durationMs;
        break;

      default:
        summary.unknownDurationMs += durationMs;
        break;
    }
  }

  function processMeasurement(measurement: FaceMeasurement) {
    if (lastMeasurementTimestampMs !== null) {
      const elapsedMs = measurement.timestampMs - lastMeasurementTimestampMs;

      addDuration(state, elapsedMs);
    }

    lastMeasurementTimestampMs = measurement.timestampMs;

    latestMeasurement = measurement;
    summary.measurementCount += 1;
    engagementController.process(
      measurement.engagementFrame,
      options.shouldRecordEngagement?.() ?? true,
    );
    summary.engagement = engagementController.getSummary();

    reportState(measurement.state, measurement.faceCount);

    options.onMeasurement?.(measurement, buildSnapshot());
  }

  function cancelAnimationFrameLoop() {
    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);

      animationFrameId = null;
    }
  }

  function closeLandmarker() {
    if (landmarker) {
      try {
        landmarker.close();
      } catch (closeError) {
        console.warn("Face Landmarker close failed:", closeError);
      }
      landmarker = null;
    }
    releaseInterviewPoseLandmarker(poseLandmarker);
    poseLandmarker = null;
    handAnalyzer?.close();
    handAnalyzer = null;
  }

  function analyseFrame(timestampMs: number) {
    if (disposed || !running || !videoElement || !landmarker) {
      return;
    }

    const shouldAnalyse = timestampMs - lastAnalysisTimestampMs >= analysisIntervalMs;

    if (shouldAnalyse && videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const frameGapMs = lastAnalysisTimestampMs > 0 ? timestampMs - lastAnalysisTimestampMs : 0;
      lastAnalysisTimestampMs = timestampMs;

      if (frameGapMs > MAX_CONTINUOUS_FRAME_GAP_MS) {
        lastMeasurementTimestampMs = null;
        smoothedHeadPose = null;
        engagementController.resetTracking();
        postureController.resetTracking();
        handController.resetTracking();
      }

      try {
        const result = landmarker.detectForVideo(videoElement, timestampMs);

        const detection = readFaceDetectionResult(result);

        const detectedFaceCount = Math.max(0, Number(detection.faceCount || 0));

        const rawEngagementFrame = estimateCameraEngagementFrame(
          detection.primaryFace,
          timestampMs,
        );
        smoothedHeadPose =
          detectedFaceCount === 1 && rawEngagementFrame.measurable
            ? smoothHeadPose(smoothedHeadPose, rawEngagementFrame.headPose)
            : null;
        const engagementFrame = smoothedHeadPose
          ? {
              ...rawEngagementFrame,
              headPose: smoothedHeadPose,
              engaged:
                smoothedHeadPose.horizontalDirection === "center" &&
                smoothedHeadPose.verticalDirection === "center",
            }
          : rawEngagementFrame;

        if (handAnalyzer && timestampMs - lastHandTimestampMs >= HAND_THRESHOLDS.handIntervalMs) {
          lastHandTimestampMs = timestampMs;
          try {
            const handResult = handAnalyzer.detect(videoElement, timestampMs);
            handFrame = analyzeHandFrame(
              detectedFaceCount === 1 ? handResult.hands : [],
              detectedFaceCount === 1 ? calculateFaceBounds(detection.primaryFace) : null,
              timestampMs,
            );
            handController.process(handFrame, options.shouldRecordEngagement?.() ?? true);
            summary.hands = handController.getSummary();
          } catch (handAnalysisError) {
            handError = "Gesture analysis is temporarily unavailable.";
            console.warn("Hand frame analysis failed:", handAnalysisError);
          }
        }

        if (
          poseLandmarker &&
          timestampMs - lastPoseTimestampMs >= POSTURE_THRESHOLDS.poseIntervalMs
        ) {
          lastPoseTimestampMs = timestampMs;
          try {
            const poseResult = poseLandmarker.detectForVideo(videoElement, timestampMs);
            postureFrame = analyzePostureFrame(
              detectedFaceCount === 1 ? (poseResult.landmarks?.[0] ?? null) : null,
              timestampMs,
            );
            postureController.process(postureFrame, options.shouldRecordEngagement?.() ?? true);
            summary.posture = postureController.getSummary();
          } catch (poseAnalysisError) {
            postureError = "Posture monitoring is temporarily unavailable.";
            console.warn("Pose frame analysis failed:", poseAnalysisError);
          }
        }

        processMeasurement({
          timestampMs,
          faceCount: detectedFaceCount,
          state: getPresenceState(detectedFaceCount),
          engagementFrame,
        });
      } catch (analysisError) {
        summary.analysisErrors += 1;

        console.error("Face frame analysis failed:", analysisError);
      }
    }

    animationFrameId = window.requestAnimationFrame(analyseFrame);
  }

  async function start(nextVideoElement: HTMLVideoElement) {
    if (disposed) {
      throw new Error("Cannot start a disposed face monitor.");
    }

    if (running || loading) {
      return;
    }

    if (!nextVideoElement) {
      throw new Error("A video element is required.");
    }

    videoElement = nextVideoElement;

    loading = true;
    error = "";

    reportState("loading", 0);

    try {
      landmarker = await createInterviewFaceLandmarker({
        maxFaces,
      });

      if (disposed) {
        closeLandmarker();
        return;
      }

      running = true;
      loading = false;

      const startedAt = performance.now();

      summary.startedAtMs ??= startedAt;
      summary.endedAtMs = null;

      lastAnalysisTimestampMs = 0;
      // Stagger the lower-priority models so pose and hands do not run on the same face frame.
      lastPoseTimestampMs = startedAt;
      lastHandTimestampMs = startedAt - HAND_THRESHOLDS.handIntervalMs / 2;
      lastMeasurementTimestampMs = null;

      animationFrameId = window.requestAnimationFrame(analyseFrame);

      void createInterviewPoseLandmarker()
        .then((createdPoseLandmarker) => {
          if (disposed || !running) {
            releaseInterviewPoseLandmarker(createdPoseLandmarker);
            return;
          }
          poseLandmarker = createdPoseLandmarker;
          postureError = "";
        })
        .catch((poseLoadError: unknown) => {
          postureError = "Posture monitoring is unavailable, but face monitoring will continue.";
          console.warn("Pose Landmarker could not load:", poseLoadError);
        });

      void createHandAnalyzer()
        .then((createdHandAnalyzer) => {
          if (disposed || !running) {
            createdHandAnalyzer.close();
            return;
          }
          handAnalyzer = createdHandAnalyzer;
          handError = "";
        })
        .catch((handLoadError: unknown) => {
          handError = "Gesture analysis is unavailable, but the interview will continue.";
          console.warn("Hand Landmarker could not load:", handLoadError);
        });
    } catch (startError) {
      loading = false;
      running = false;

      const normalizedError =
        startError instanceof Error ? startError : new Error("Face monitoring could not start.");

      error = normalizedError.message;

      reportState("error", 0);
      options.onError?.(normalizedError);

      closeLandmarker();

      throw normalizedError;
    }
  }

  function stop() {
    if (!running && !loading) {
      return withRatios(summary);
    }

    const stoppedAt = performance.now();

    if (lastMeasurementTimestampMs !== null) {
      addDuration(state, stoppedAt - lastMeasurementTimestampMs);
    }

    summary.endedAtMs = stoppedAt;

    running = false;
    loading = false;

    cancelAnimationFrameLoop();
    closeLandmarker();

    videoElement = null;
    lastMeasurementTimestampMs = null;

    reportState("inactive", 0);

    summary = withRatios(summary);

    return summary;
  }

  function reset() {
    stop();

    state = "inactive";
    faceCount = 0;
    error = "";

    latestMeasurement = null;
    smoothedHeadPose = null;
    engagementController.reset();
    postureFrame = null;
    postureError = "";
    postureController.resetTracking();
    handFrame = null;
    handError = "";
    handController.resetTracking();
    lastAnalysisTimestampMs = 0;
    lastMeasurementTimestampMs = null;

    summary = createEmptySummary();
  }

  function dispose() {
    if (disposed) {
      return;
    }

    stop();
    disposed = true;
  }

  return {
    start,
    stop,
    reset,
    dispose,

    getSnapshot: buildSnapshot,

    getSummary: () => withRatios(summary),

    isRunning: () => running,
  };
}
