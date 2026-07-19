import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Eye,
  Loader2,
  ScanFace,
  Video,
} from "lucide-react";
import { FaceLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createHandAnalyzer, type HandAnalyzerController } from "@/lib/handAnalysis";
import {
  createInterviewFaceLandmarker,
  readFaceDetectionResult,
} from "@/features/interview/monitoring/face/createFaceLandmarker";
import {
  mapInterviewMediaError,
  requestInterviewCameraStream,
} from "@/features/interview/mediaErrors";
import {
  buildEyeContactBaseline,
  estimateEyeContactDirection,
  getEyeContactDirectionSample,
  type EyeContactBaseline,
  type EyeContactDirectionSample,
  type VideoPresentationMetrics,
} from "@/lib/videoPresentationAnalysis";

type CheckStatus = "waiting" | "checking" | "passed" | "warning";

interface ReadinessCheck {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  value?: string;
}

interface VideoReadinessCalibrationProps {
  interviewStarted?: boolean;
  onComplete: () => void;
  onBack: () => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  onMetricsUpdate?: (metrics: VideoPresentationMetrics) => void;
  onCameraStopped?: () => void;
}

type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const getFaceBox = (landmarks: NormalizedLandmark[]): FaceBox => {
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const getBrightnessLevel = (
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): "too-dark" | "good" | "too-bright" => {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
    return "good";
  }

  const sampleWidth = 80;
  const sampleHeight = 45;

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  context.drawImage(video, 0, 0, sampleWidth, sampleHeight);

  const frame = context.getImageData(0, 0, sampleWidth, sampleHeight);
  const data = frame.data;

  let totalBrightness = 0;

  for (let i = 0; i < data.length; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];

    totalBrightness += (red + green + blue) / 3;
  }

  const averageBrightness = totalBrightness / (data.length / 4);

  if (averageBrightness < 60) return "too-dark";
  if (averageBrightness > 215) return "too-bright";

  return "good";
};

type CalibrationMetricCounters = {
  frameCount: number;
  faceDetectedFrames: number;
  faceCenteredFrames: number;
  handDetectedFrames: number;
  stableFrames: number;
  eyeContactFrames: number;
  screenFacingFrames: number;
  lookingAwayFrames: number;
  validFaceFrames: number;
  analysisStartedAt: number | null;
  lastAnalyzedAt: number | null;
  cameraActiveStartedAt: number | null;
  cameraActiveDurationMs: number;
};

const createEmptyMetricCounters = (): CalibrationMetricCounters => ({
  frameCount: 0,
  faceDetectedFrames: 0,
  faceCenteredFrames: 0,
  handDetectedFrames: 0,
  stableFrames: 0,
  eyeContactFrames: 0,
  screenFacingFrames: 0,
  lookingAwayFrames: 0,
  validFaceFrames: 0,
  analysisStartedAt: null,
  lastAnalyzedAt: null,
  cameraActiveStartedAt: null,
  cameraActiveDurationMs: 0,
});

const toScore = (value: number) => Math.min(Math.max(Math.round(value), 0), 100);

const buildPresentationMetrics = (
  counters: CalibrationMetricCounters,
  latest: {
    faceDetected: boolean;
    faceCentered: boolean;
    handDetected: boolean;
    eyeContactEstimated: boolean;
  },
): VideoPresentationMetrics => {
  const now = performance.now();
  const frameCount = Math.max(counters.frameCount, 1);
  const faceVisibilityScore = toScore((counters.faceDetectedFrames / frameCount) * 100);
  const faceCenteringScore = toScore((counters.faceCenteredFrames / frameCount) * 100);
  const handVisibilityScore = toScore((counters.handDetectedFrames / frameCount) * 100);
  const movementStabilityScore = toScore((counters.stableFrames / frameCount) * 100);
  const validFaceFrames = Math.max(counters.validFaceFrames, 1);
  const eyeContactScore = toScore((counters.eyeContactFrames / validFaceFrames) * 100);
  const cameraActiveDurationMs =
    counters.cameraActiveDurationMs +
    (counters.cameraActiveStartedAt ? now - counters.cameraActiveStartedAt : 0);
  const analysisDurationMs = counters.analysisStartedAt
    ? Math.max(0, now - counters.analysisStartedAt)
    : 0;
  const cameraPresenceScore =
    analysisDurationMs > 0
      ? toScore((cameraActiveDurationMs / analysisDurationMs) * 100)
      : counters.frameCount > 0
        ? 100
        : 0;
  const overallPresentationScore = toScore(
    faceVisibilityScore * 0.25 +
      faceCenteringScore * 0.2 +
      movementStabilityScore * 0.18 +
      eyeContactScore * 0.15 +
      cameraPresenceScore * 0.15 +
      handVisibilityScore * 0.07,
  );

  const visualSummary = [
    faceVisibilityScore >= 75
      ? "Face visibility was consistent during the video interview."
      : "Face visibility was limited at times; keep your full face in the camera frame.",
    faceCenteringScore >= 70
      ? "Face centering was generally stable."
      : "Try to stay closer to the center of the camera frame.",
    movementStabilityScore >= 70
      ? "Movement stability was suitable for interview presentation."
      : "Reduce unnecessary movement to improve presentation stability.",
    counters.validFaceFrames === 0
      ? "Camera-engagement orientation was not captured long enough for coaching."
      : eyeContactScore >= 70
        ? "Your facial orientation was generally toward the camera or screen."
        : "Your screen-facing direction estimate varied; brief glances down to type are expected.",
    handVisibilityScore > 0
      ? "Hand visibility was detected during the session."
      : "Hand visibility was limited or not detected, which is acceptable if gestures were not needed.",
  ];

  return {
    faceDetected: latest.faceDetected,
    faceCentered: latest.faceCentered,
    handDetected: latest.handDetected,
    faceVisibilityScore,
    faceCenteringScore,
    handVisibilityScore,
    movementStabilityScore,
    cameraPresenceScore,
    overallPresentationScore,
    eyeContactScore,
    frameCount: counters.frameCount,
    faceDetectedFrames: counters.faceDetectedFrames,
    faceCenteredFrames: counters.faceCenteredFrames,
    handDetectedFrames: counters.handDetectedFrames,
    stableFrames: counters.stableFrames,
    eyeContactFrames: counters.eyeContactFrames,
    screenFacingFrames: counters.screenFacingFrames,
    lookingAwayFrames: counters.lookingAwayFrames,
    validFaceFrames: counters.validFaceFrames,
    analysisDurationMs,
    visualSummary,
  };
};

export function VideoReadinessCalibration({
  interviewStarted = false,
  onComplete,
  onBack,
  onStreamReady,
  onMetricsUpdate,
  onCameraStopped,
}: VideoReadinessCalibrationProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const brightnessCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const streamTransferredRef = useRef(false);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handAnalyzerRef = useRef<HandAnalyzerController | null>(null);
  const faceLandmarkerPromiseRef = useRef<Promise<FaceLandmarker> | null>(null);
  const handAnalyzerPromiseRef = useRef<Promise<HandAnalyzerController> | null>(null);
  const mountedRef = useRef(true);
  const loadGenerationRef = useRef(0);
  const cameraRequestPromiseRef = useRef<Promise<void> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const stableStartTimeRef = useRef<number | null>(null);
  const metricCountersRef = useRef<CalibrationMetricCounters>(createEmptyMetricCounters());
  const latestSignalRef = useRef({
    faceDetected: false,
    faceCentered: false,
    handDetected: false,
    eyeContactEstimated: false,
  });
  const interviewStartedRef = useRef(interviewStarted);
  const inactiveMetricsIntervalRef = useRef<number | null>(null);
  const eyeContactBaselineRef = useRef<EyeContactBaseline | null>(null);
  const eyeContactBaselineSamplesRef = useRef<EyeContactDirectionSample[]>([]);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [modelError, setModelError] = useState("");
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  const [faceDetected, setFaceDetected] = useState(false);
  const [faceCentered, setFaceCentered] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [handCount, setHandCount] = useState(0);
  const [lightingStatus, setLightingStatus] = useState<
    "waiting" | "too-dark" | "good" | "too-bright"
  >("waiting");
  const [movementStable, setMovementStable] = useState(false);
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState(5);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const [checks, setChecks] = useState<ReadinessCheck[]>([
    {
      id: "camera",
      label: "Camera Access",
      description: "Waiting for camera permission.",
      status: "waiting",
    },
    {
      id: "model",
      label: "Face Detection Model",
      description: "Waiting to load browser-based face detection.",
      status: "waiting",
    },
    {
      id: "face",
      label: "Face Detection",
      description: "Waiting for a face to appear in the frame.",
      status: "waiting",
    },
    {
      id: "landmarks",
      label: "Face Landmark Pinpoints",
      description: "Waiting to map face landmark points.",
      status: "waiting",
    },
    {
      id: "center",
      label: "Face Centering",
      description: "Align your face near the center guide.",
      status: "waiting",
    },
    {
      id: "screen-facing",
      label: "Screen-Facing Direction",
      description: "Look naturally at the screen or camera during the steady hold.",
      status: "waiting",
    },
    {
      id: "lighting",
      label: "Lighting Check",
      description: "Checking brightness from the camera preview.",
      status: "waiting",
    },
    {
      id: "hands",
      label: "Hand Detection",
      description: "Show your hands briefly to map hand landmark points.",
      status: "waiting",
    },
    {
      id: "movement",
      label: "Movement Stability",
      description: "Hold your position steady for 5 seconds.",
      status: "waiting",
    },
  ]);

  const updateCheck = (id: string, status: CheckStatus, value?: string, description?: string) => {
    setChecks((previousChecks) =>
      previousChecks.map((check) =>
        check.id === id
          ? {
              ...check,
              status,
              value,
              description: description ?? check.description,
            }
          : check,
      ),
    );
  };

  const clearCanvas = () => {
    const canvas = overlayCanvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resetHoldTimer = () => {
    stableStartTimeRef.current = null;
    if (!eyeContactBaselineRef.current) {
      eyeContactBaselineSamplesRef.current = [];
    }
    setMovementStable(false);
    setHoldRemainingSeconds(5);
  };

  const stopInactiveMetricsUpdates = () => {
    if (inactiveMetricsIntervalRef.current) {
      window.clearInterval(inactiveMetricsIntervalRef.current);
      inactiveMetricsIntervalRef.current = null;
    }
  };

  const markCameraActive = () => {
    const now = performance.now();
    const counters = metricCountersRef.current;

    counters.analysisStartedAt ??= now;
    counters.lastAnalyzedAt = now;

    if (!counters.cameraActiveStartedAt) {
      counters.cameraActiveStartedAt = now;
    }
  };

  const markCameraInactive = () => {
    const now = performance.now();
    const counters = metricCountersRef.current;

    if (counters.cameraActiveStartedAt) {
      counters.cameraActiveDurationMs += now - counters.cameraActiveStartedAt;
      counters.cameraActiveStartedAt = null;
    }

    if (counters.analysisStartedAt) {
      counters.lastAnalyzedAt = now;
    }
  };

  const drawFaceOverlay = (landmarks: NormalizedLandmark[]) => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.clearRect(0, 0, canvas.width, canvas.height);

    const box = getFaceBox(landmarks);

    const boxX = box.x * canvas.width;
    const boxY = box.y * canvas.height;
    const boxWidth = box.width * canvas.width;
    const boxHeight = box.height * canvas.height;

    context.strokeStyle = "rgba(16, 185, 129, 0.95)";
    context.lineWidth = 4;
    context.shadowColor = "rgba(16, 185, 129, 0.8)";
    context.shadowBlur = 18;
    context.strokeRect(boxX, boxY, boxWidth, boxHeight);

    context.shadowBlur = 0;

    const importantLandmarks = [1, 10, 33, 61, 133, 152, 199, 263, 291, 362, 386, 468, 473];

    importantLandmarks.forEach((index) => {
      const point = landmarks[index];

      if (!point) return;

      const x = point.x * canvas.width;
      const y = point.y * canvas.height;

      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fillStyle = "rgba(34, 211, 238, 0.95)";
      context.fill();

      context.beginPath();
      context.arc(x, y, 8, 0, Math.PI * 2);
      context.strokeStyle = "rgba(34, 211, 238, 0.45)";
      context.lineWidth = 2;
      context.stroke();
    });

    context.fillStyle = "rgba(16, 185, 129, 0.95)";
    context.font = "bold 18px system-ui, sans-serif";
    context.fillText("FACE DETECTED", boxX, Math.max(24, boxY - 12));
  };

  const emitMetrics = (latest: {
    faceDetected: boolean;
    faceCentered: boolean;
    handDetected: boolean;
    eyeContactEstimated: boolean;
  }) => {
    latestSignalRef.current = latest;
    onMetricsUpdate?.(buildPresentationMetrics(metricCountersRef.current, latest));
  };

  const startInactiveMetricsUpdates = () => {
    stopInactiveMetricsUpdates();

    inactiveMetricsIntervalRef.current = window.setInterval(() => {
      emitMetrics({
        faceDetected: false,
        faceCentered: false,
        handDetected: false,
        eyeContactEstimated: false,
      });
    }, 1000);
  };

  const stopCamera = ({
    resetCalibration = true,
    emitPausedMetrics = false,
  }: {
    resetCalibration?: boolean;
    emitPausedMetrics?: boolean;
  } = {}) => {
    streamTransferredRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    markCameraInactive();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      onStreamReady?.(null);
      onCameraStopped?.();
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    clearCanvas();
    setCameraStarted(false);
    setFaceDetected(false);
    setFaceCentered(false);
    setHandDetected(false);
    setHandCount(0);
    setLightingStatus("waiting");

    if (resetCalibration) {
      resetHoldTimer();
      setProgress(0);
      setIsComplete(false);
      stopInactiveMetricsUpdates();
    } else {
      emitMetrics({
        faceDetected: false,
        faceCentered: false,
        handDetected: false,
        eyeContactEstimated: false,
      });

      if (emitPausedMetrics) {
        startInactiveMetricsUpdates();
      }
    }
  };

  useEffect(() => {
    interviewStartedRef.current = interviewStarted;

    if (interviewStarted) {
      clearCanvas();
    }
  }, [interviewStarted]);

  useEffect(() => {
    mountedRef.current = true;

    const ownedVideoElement = videoRef.current;

    return () => {
      mountedRef.current = false;
      loadGenerationRef.current += 1;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      stopInactiveMetricsUpdates();
      markCameraInactive();

      /*
       * After successful calibration, ownership of the MediaStream is
       * transferred to the interview route. Do not stop its tracks here.
       */
      if (!streamTransferredRef.current && streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        onStreamReady?.(null);
        onCameraStopped?.();
      }

      if (ownedVideoElement) {
        ownedVideoElement.srcObject = null;
      }

      streamRef.current = null;

      faceLandmarkerRef.current?.close();
      handAnalyzerRef.current?.close();
      faceLandmarkerRef.current = null;
      handAnalyzerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    void video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setCameraError("Camera preview could not resume automatically. Please restart video setup.");
    });
  }, [interviewStarted, cameraStarted]);

  const loadFaceLandmarker = async () => {
    if (faceLandmarkerRef.current) return faceLandmarkerRef.current;
    if (faceLandmarkerPromiseRef.current) return faceLandmarkerPromiseRef.current;

    setModelLoading(true);
    updateCheck("model", "checking", "Loading", "Loading face detection model in the browser...");
    const generation = loadGenerationRef.current;
    const pending = createInterviewFaceLandmarker({
      maxFaces: 2,
    });
    faceLandmarkerPromiseRef.current = pending;
    try {
      const faceLandmarker = await pending;
      if (!mountedRef.current || loadGenerationRef.current !== generation) {
        faceLandmarker.close();
        throw new DOMException("Model loading was cancelled.", "AbortError");
      }
      faceLandmarkerRef.current = faceLandmarker;
      setModelReady(true);
      setModelLoading(false);
      updateCheck(
        "model",
        "passed",
        "Ready",
        "Face detection model is ready for live camera analysis.",
      );
      return faceLandmarker;
    } finally {
      if (faceLandmarkerPromiseRef.current === pending) faceLandmarkerPromiseRef.current = null;
    }
  };

  const loadHandAnalyzer = async () => {
    if (handAnalyzerRef.current) return handAnalyzerRef.current;
    if (handAnalyzerPromiseRef.current) return handAnalyzerPromiseRef.current;

    updateCheck("hands", "checking", "Loading", "Loading hand detection model in the browser...");
    const generation = loadGenerationRef.current;
    const pending = createHandAnalyzer();
    handAnalyzerPromiseRef.current = pending;
    try {
      const handAnalyzer = await pending;
      if (!mountedRef.current || loadGenerationRef.current !== generation) {
        handAnalyzer.close();
        throw new DOMException("Model loading was cancelled.", "AbortError");
      }

      handAnalyzerRef.current = handAnalyzer;

      updateCheck(
        "hands",
        "checking",
        "Ready",
        "Hand detection model is ready. Show your hands briefly.",
      );

      return handAnalyzer;
    } catch (error) {
      console.warn("Hand detection calibration model could not be loaded:", error);

      if (!mountedRef.current || loadGenerationRef.current !== generation) return null;

      updateCheck(
        "hands",
        "warning",
        "Optional",
        "Hand landmark detection is optional and unavailable right now.",
      );

      return null;
    } finally {
      if (handAnalyzerPromiseRef.current === pending) handAnalyzerPromiseRef.current = null;
    }
  };

  const analyzeFrame = () => {
    const video = videoRef.current;
    const faceLandmarker = faceLandmarkerRef.current;
    const handAnalyzer = handAnalyzerRef.current;

    if (!video || !faceLandmarker || video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      const now = performance.now();
      const counters = metricCountersRef.current;

      counters.analysisStartedAt ??= now;
      counters.lastAnalyzedAt = now;
      counters.frameCount += 1;

      const result = faceLandmarker.detectForVideo(video, now);
      const faceDetection = readFaceDetectionResult(result);
      const handAnalysis = handAnalyzer?.detect(video, now);

      const landmarks = faceDetection.primaryFace;
      const hands = handAnalysis?.hands || [];

      if (faceDetection.hasMultipleFaces) {
        resetHoldTimer();

        setFaceDetected(false);
        setFaceCentered(false);
        setHandDetected(false);
        setHandCount(0);
        setProgress(35);
        setIsComplete(false);

        clearCanvas();

        updateCheck(
          "face",
          "warning",
          `${faceDetection.faceCount} faces`,
          "More than one face is visible. Continue when only you are in the frame.",
        );
        updateCheck(
          "landmarks",
          "warning",
          undefined,
          "Face landmark calibration requires exactly one visible face.",
        );
        updateCheck(
          "center",
          "waiting",
          undefined,
          "Centering will resume when exactly one face is visible.",
        );
        updateCheck(
          "screen-facing",
          "waiting",
          "Waiting",
          "Screen-facing calibration will resume when exactly one face is visible.",
        );
        updateCheck(
          "movement",
          "waiting",
          "Waiting",
          "Stability calibration will resume when exactly one face is visible.",
        );

        emitMetrics({
          faceDetected: false,
          faceCentered: false,
          handDetected: false,
          eyeContactEstimated: false,
        });

        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      if (!landmarks) {
        resetHoldTimer();

        setFaceDetected(false);
        setFaceCentered(false);
        setHandDetected(false);
        setHandCount(0);
        setProgress(35);
        setIsComplete(false);

        clearCanvas();

        updateCheck("face", "checking", "Searching", "Move your face into the camera frame.");
        updateCheck("landmarks", "waiting", undefined, "Waiting for facial landmark pinpoints.");
        updateCheck("center", "waiting", undefined, "Align your face near the center guide.");
        updateCheck(
          "screen-facing",
          "waiting",
          "Waiting",
          "Look naturally at the screen or camera after your face is detected.",
        );
        updateCheck("hands", "waiting", "Waiting", "Show your hands after your face is detected.");
        updateCheck("movement", "waiting", "Waiting", "Hold your position steady after detection.");

        emitMetrics({
          faceDetected: false,
          faceCentered: false,
          handDetected: false,
          eyeContactEstimated: false,
        });

        animationFrameRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      if (interviewStartedRef.current) {
        clearCanvas();
      } else {
        drawFaceOverlay(landmarks);
      }

      if (
        !interviewStartedRef.current &&
        hands.length > 0 &&
        overlayCanvasRef.current &&
        videoRef.current
      ) {
        handAnalyzer?.draw(overlayCanvasRef.current, videoRef.current, hands);
      }

      const box = getFaceBox(landmarks);
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;

      const centerDistanceX = Math.abs(faceCenterX - 0.5);
      const centerDistanceY = Math.abs(faceCenterY - 0.5);

      const isCentered = centerDistanceX < 0.16 && centerDistanceY < 0.18;
      const faceSizeGood =
        box.width > 0.18 && box.width < 0.65 && box.height > 0.22 && box.height < 0.75;
      const faceCenteredAndSized = isCentered && faceSizeGood;
      const eyeContactEstimate = estimateEyeContactDirection({
        landmarks,
        faceCentered: faceCenteredAndSized,
        baseline: eyeContactBaselineRef.current,
      });

      const brightness =
        video && brightnessCanvasRef.current
          ? getBrightnessLevel(video, brightnessCanvasRef.current)
          : "good";

      const lightingGood = brightness === "good";

      setFaceDetected(true);
      setFaceCentered(faceCenteredAndSized);
      setLightingStatus(brightness);
      setHandDetected(hands.length > 0);
      setHandCount(hands.length);

      updateCheck("camera", "passed", "Passed", "Camera preview is active.");
      updateCheck("face", "passed", "Detected", "A face is detected in the camera frame.");
      updateCheck(
        "landmarks",
        "passed",
        `${landmarks.length} points`,
        "Facial landmark pinpoints are mapped on the preview.",
      );

      if (hands.length > 0) {
        updateCheck(
          "hands",
          "passed",
          `${hands.length} hand${hands.length > 1 ? "s" : ""}`,
          "Hand landmark points are detected and mapped on the preview.",
        );
      } else {
        updateCheck(
          "hands",
          "checking",
          "Searching",
          "Show your hands briefly if you want hand landmark detection to appear.",
        );
      }

      if (faceCenteredAndSized) {
        updateCheck("center", "passed", "Good", "Your face is centered inside the guide.");
      } else {
        resetHoldTimer();

        updateCheck(
          "center",
          "warning",
          "Adjust",
          "Move closer to the center and keep your full face visible.",
        );
      }

      if (!faceCenteredAndSized) {
        updateCheck(
          "screen-facing",
          "waiting",
          "Waiting",
          "Center your face before the screen-facing direction baseline is captured.",
        );
      } else if (!eyeContactBaselineRef.current) {
        updateCheck(
          "screen-facing",
          "checking",
          "Capturing",
          "Look naturally at the screen or camera while the 5-second hold runs.",
        );
      } else if (eyeContactEstimate.screenFacing) {
        updateCheck(
          "screen-facing",
          "passed",
          "Screen-facing",
          "Your screen-facing direction estimate is aligned with setup.",
        );
      } else {
        updateCheck(
          "screen-facing",
          "warning",
          "Adjust",
          "Face the screen or camera naturally; brief glances down are okay.",
        );
      }

      if (brightness === "good") {
        updateCheck(
          "lighting",
          "passed",
          "Good",
          "Lighting looks suitable for video interview setup.",
        );
      } else if (brightness === "too-dark") {
        resetHoldTimer();

        updateCheck(
          "lighting",
          "warning",
          "Too dark",
          "Try facing a light source or brightening the room.",
        );
      } else {
        resetHoldTimer();

        updateCheck("lighting", "warning", "Too bright", "Reduce strong backlight or glare.");
      }

      const setupIsGood = faceCenteredAndSized && lightingGood;

      if (setupIsGood) {
        if (!stableStartTimeRef.current) {
          stableStartTimeRef.current = performance.now();
        }

        if (!eyeContactBaselineRef.current) {
          const baselineSample = getEyeContactDirectionSample(landmarks);

          if (baselineSample) {
            eyeContactBaselineSamplesRef.current = [
              ...eyeContactBaselineSamplesRef.current.slice(-149),
              baselineSample,
            ];
          }
        }
      } else {
        stableStartTimeRef.current = null;
      }

      const stableHeldMs = stableStartTimeRef.current
        ? performance.now() - stableStartTimeRef.current
        : 0;

      const requiredHoldMs = 5000;
      const remainingMs = Math.max(requiredHoldMs - stableHeldMs, 0);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const stableEnough = stableHeldMs >= requiredHoldMs;

      setHoldRemainingSeconds(remainingSeconds);
      setMovementStable(stableEnough);

      if (stableEnough) {
        if (!eyeContactBaselineRef.current) {
          eyeContactBaselineRef.current = buildEyeContactBaseline(
            eyeContactBaselineSamplesRef.current,
          );
        }

        updateCheck(
          "screen-facing",
          eyeContactBaselineRef.current ? "passed" : "warning",
          eyeContactBaselineRef.current ? "Baseline set" : "Optional",
          eyeContactBaselineRef.current
            ? "Forward-facing setup baseline captured for the interview."
            : "Screen-facing direction baseline was limited, so a lenient default estimate will be used.",
        );

        updateCheck(
          "movement",
          "passed",
          "Stable",
          "You held a stable video position for 5 seconds.",
        );
      } else if (setupIsGood) {
        updateCheck(
          "movement",
          "checking",
          `${remainingSeconds}s left`,
          "Hold your face steady for 5 seconds to complete calibration.",
        );
      } else {
        updateCheck(
          "movement",
          "waiting",
          "Waiting",
          "Center your face and improve lighting before the 5-second hold begins.",
        );
      }

      const holdProgress = clamp(stableHeldMs / requiredHoldMs, 0, 1);

      const nextProgress =
        20 +
        20 +
        15 +
        (faceCenteredAndSized ? 15 : 5) +
        (lightingGood ? 15 : 5) +
        holdProgress * 15;

      setProgress(Math.round(clamp(nextProgress, 0, 100)));
      setIsComplete(stableEnough && setupIsGood);

      counters.faceDetectedFrames += 1;

      if (faceCenteredAndSized) {
        counters.faceCenteredFrames += 1;
      }

      if (hands.length > 0) {
        counters.handDetectedFrames += 1;
      }

      if (setupIsGood) {
        counters.stableFrames += 1;
      }

      if (eyeContactEstimate.validFace) {
        counters.validFaceFrames += 1;

        if (eyeContactEstimate.screenFacing) {
          counters.screenFacingFrames += 1;
        } else {
          counters.lookingAwayFrames += 1;
        }

        if (eyeContactEstimate.eyeContactEstimated) {
          counters.eyeContactFrames += 1;
        }
      }

      emitMetrics({
        faceDetected: true,
        faceCentered: faceCenteredAndSized,
        handDetected: hands.length > 0,
        eyeContactEstimated: eyeContactEstimate.eyeContactEstimated,
      });
    }

    animationFrameRef.current = requestAnimationFrame(analyzeFrame);
  };

  const startDetectionAnalysis = async (stream: MediaStream) => {
    setModelError("");

    try {
      const [faceLandmarker] = await Promise.all([loadFaceLandmarker(), loadHandAnalyzer()]);

      if (
        !mountedRef.current ||
        streamRef.current !== stream ||
        !stream.active ||
        stream.getVideoTracks().every((track) => track.readyState !== "live")
      ) {
        return;
      }

      if (!faceLandmarker) {
        throw new Error("Face detection model failed to load.");
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      lastVideoTimeRef.current = -1;
      animationFrameRef.current = requestAnimationFrame(analyzeFrame);
    } catch (error) {
      if (
        !mountedRef.current ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }

      console.error("Visual monitoring model failed to load:", error);

      setModelLoading(false);
      setModelReady(false);
      setModelError(
        "The camera is active, but face analysis could not load. Check your connection and retry detection.",
      );

      updateCheck(
        "model",
        "warning",
        "Unavailable",
        "The camera is working, but browser-based face analysis could not load.",
      );

      updateCheck(
        "face",
        "waiting",
        "Waiting",
        "Face calibration will begin after the detection model loads.",
      );

      updateCheck(
        "landmarks",
        "waiting",
        "Waiting",
        "Facial landmark calibration is temporarily unavailable.",
      );
    }
  };

  const runStartCamera = async ({
    resetMetrics = !interviewStartedRef.current,
  }: {
    resetMetrics?: boolean;
  } = {}) => {
    try {
      setCameraError("");
      setModelError("");
      stopInactiveMetricsUpdates();

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      lastVideoTimeRef.current = -1;

      if (resetMetrics) {
        setIsComplete(false);
        setProgress(0);
        metricCountersRef.current = createEmptyMetricCounters();
        latestSignalRef.current = {
          faceDetected: false,
          faceCentered: false,
          handDetected: false,
          eyeContactEstimated: false,
        };
        eyeContactBaselineRef.current = null;
        eyeContactBaselineSamplesRef.current = [];
        resetHoldTimer();
      }

      setHandDetected(false);
      setHandCount(0);

      updateCheck("camera", "checking", "Requesting", "Requesting camera permission...");
      updateCheck(
        "model",
        "waiting",
        "Waiting",
        "Detection models will load after the camera preview starts.",
      );
      updateCheck("face", "waiting", undefined, "Waiting for a face to appear in the frame.");
      updateCheck("landmarks", "waiting", undefined, "Waiting to map face landmark points.");
      updateCheck("center", "waiting", undefined, "Align your face near the center guide.");
      updateCheck(
        "screen-facing",
        "waiting",
        undefined,
        "Look naturally at the screen or camera during the steady hold.",
      );
      updateCheck("lighting", "waiting", undefined, "Waiting for the camera preview.");
      updateCheck(
        "hands",
        "waiting",
        undefined,
        "Hand detection will load after the camera preview starts.",
      );
      updateCheck("movement", "waiting", "Waiting", "Hold your position steady for 5 seconds.");

      let stream: MediaStream;

      try {
        /*
         * Start the camera before loading MediaPipe. A network or model-loading
         * failure must never prevent the browser permission prompt or preview.
         */
        stream = await requestInterviewCameraStream();
      } catch (error) {
        if (!mountedRef.current) return;

        const mediaError = mapInterviewMediaError("camera", error);

        setCameraStarted(false);
        setCameraError(mediaError.message);
        updateCheck("camera", "warning", "Failed", mediaError.message);

        if (interviewStartedRef.current) {
          startInactiveMetricsUpdates();
        }

        return;
      }

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      if (streamRef.current && streamRef.current !== stream) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        stream.getTracks().forEach((track) => track.stop());
        setCameraStarted(false);
        setCameraError("No video track was returned by the selected camera.");
        updateCheck(
          "camera",
          "warning",
          "Failed",
          "No video track was returned by the selected camera.",
        );
        return;
      }

      streamTransferredRef.current = false;
      streamRef.current = stream;

      videoTrack.addEventListener(
        "ended",
        () => {
          if (!mountedRef.current || streamRef.current !== stream) return;

          markCameraInactive();
          setCameraStarted(false);
          setCameraError("Camera access was interrupted. Reconnect the camera to continue.");
          updateCheck(
            "camera",
            "warning",
            "Disconnected",
            "Camera access was interrupted. Reconnect the camera to continue.",
          );
        },
        { once: true },
      );

      videoTrack.addEventListener("mute", () => {
        if (!mountedRef.current || streamRef.current !== stream) return;

        setCameraError(
          "Camera video is temporarily interrupted. The preview will recover when the device resumes.",
        );
      });

      videoTrack.addEventListener("unmute", () => {
        if (!mountedRef.current || streamRef.current !== stream) return;
        setCameraError("");
      });

      markCameraActive();
      onStreamReady?.(stream);

      const video = videoRef.current;

      if (video) {
        video.srcObject = stream;

        try {
          await video.play();
        } catch (error) {
          const isExpectedAbort = error instanceof DOMException && error.name === "AbortError";

          if (!isExpectedAbort) {
            console.warn("Camera preview play() failed:", error);
          }
        }
      }

      if (!mountedRef.current || streamRef.current !== stream) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setCameraStarted(true);
      updateCheck("camera", "passed", "Passed", "Camera preview is active.");
      setProgress(30);

      /*
       * Load face and hand analysis only after the live preview is visible.
       * Model failure leaves the camera running and exposes a retry action.
       */
      await startDetectionAnalysis(stream);
    } catch (error) {
      console.error("Unexpected camera setup failure:", error);

      if (!mountedRef.current) return;

      setModelLoading(false);
      setCameraError("Camera setup encountered an unexpected error. Please retry.");
    }
  };

  const startCamera = (options: { resetMetrics?: boolean } = {}) => {
    if (cameraRequestPromiseRef.current) {
      return cameraRequestPromiseRef.current;
    }

    const pending = runStartCamera(options);
    cameraRequestPromiseRef.current = pending;

    const clearPendingRequest = () => {
      if (cameraRequestPromiseRef.current === pending) {
        cameraRequestPromiseRef.current = null;
      }
    };

    void pending.then(clearPendingRequest, clearPendingRequest);

    return pending;
  };

  const retryDetectionAnalysis = () => {
    const stream = streamRef.current;

    if (!stream || !stream.active) {
      setCameraError("The camera stream is no longer active. Turn the camera on again.");
      return;
    }

    void startDetectionAnalysis(stream);
  };

  const handleStartInterview = () => {
    const stream = streamRef.current;

    const videoTrack = stream?.getVideoTracks()[0];

    if (!stream || !stream.active || !videoTrack || videoTrack.readyState !== "live") {
      setCameraError("The camera stream is no longer active. Please restart the video setup.");
      return;
    }

    /*
     * The parent interview route now owns this stream. The calibration
     * component may unmount without ending the camera tracks.
     */
    streamTransferredRef.current = true;
    onStreamReady?.(stream);
    onComplete();
  };

  const handleTurnOffCamera = () => {
    streamTransferredRef.current = false;
    stopCamera({ resetCalibration: false, emitPausedMetrics: true });
  };

  const handleTurnOnCamera = () => {
    void startCamera({ resetMetrics: false });
  };

  const handleBack = () => {
    streamTransferredRef.current = false;
    stopCamera({ resetCalibration: true, emitPausedMetrics: false });
    onBack();
  };

  const getStatusIcon = (status: CheckStatus) => {
    if (status === "checking") {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }

    if (status === "passed") {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }

    if (status === "warning") {
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    }

    return <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />;
  };

  if (interviewStarted) {
    return (
      <Card className="mb-4 overflow-hidden">
        <CardContent className="p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_1fr]">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
              {cameraStarted ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-white">
                  <div className="rounded-full bg-white/10 p-4 backdrop-blur">
                    <CameraOff className="h-8 w-8" />
                  </div>

                  <div className="text-center">
                    <p className="font-semibold">Camera paused</p>
                    <p className="text-xs text-white/70">Your interview is still active.</p>
                  </div>
                </div>
              )}

              <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                {cameraStarted ? "Camera ready from setup" : "Camera paused"}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Camera className="h-4 w-4" />
                  Video setup
                </h3>

                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    {cameraStarted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    {cameraStarted ? "Presentation signals active" : "Presentation signals paused"}
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    {cameraStarted ? (
                      <Camera className="h-4 w-4 text-primary" />
                    ) : (
                      <CameraOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    {cameraStarted ? "Camera ready from setup" : "Camera paused"}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {cameraStarted ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTurnOffCamera}
                    className="gap-2"
                  >
                    <CameraOff className="h-4 w-4" />
                    Turn Off Camera
                  </Button>
                ) : (
                  <Button type="button" onClick={handleTurnOnCamera} className="gap-2">
                    <Camera className="h-4 w-4" />
                    Turn Camera On
                  </Button>
                )}
              </div>

              {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
              {modelError && <p className="text-sm text-amber-600">{modelError}</p>}
            </div>
          </div>

          <canvas ref={overlayCanvasRef} className="hidden" />
          <canvas ref={brightnessCanvasRef} className="hidden" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="video-calibration fixed inset-0 z-50 overflow-y-auto bg-background px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="rounded-full border px-4 py-2 text-sm text-muted-foreground">
            Video Mode Setup
          </div>
        </div>

        <div className="space-y-2 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-foreground text-background">
            <ScanFace className="h-7 w-7" />
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight">
            Face & Hand Detection Calibration
          </h1>

          <p className="mx-auto max-w-2xl text-muted-foreground">
            Position your face inside the guide. The system will detect your face, map face and hand
            landmark pinpoints, check centering, lighting, and ask you to look naturally at the
            screen or camera during a steady 5-second hold before the video interview begins.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-video overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full scale-x-[-1] object-cover"
                />

                <canvas
                  ref={overlayCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
                />

                <canvas ref={brightnessCanvasRef} className="hidden" />

                {!cameraStarted && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
                    <div className="rounded-full bg-white/10 p-5 backdrop-blur">
                      <Camera className="h-10 w-10" />
                    </div>

                    <div className="text-center">
                      <p className="text-lg font-semibold">Camera preview is not active</p>
                      <p className="text-sm text-white/70">
                        Start your camera to run real face and hand detection calibration.
                      </p>
                    </div>
                  </div>
                )}

                {cameraStarted && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />

                    <div className="pointer-events-none absolute inset-8 rounded-[2rem] border-2 border-white/30" />

                    <div
                      className={`pointer-events-none absolute left-1/2 top-1/2 h-[48%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                        faceDetected ? "border-emerald-400/80" : "border-white/70"
                      }`}
                    />

                    <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                      {faceDetected ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      )}
                      {faceDetected ? "Face detected" : "Scanning for face..."}
                    </div>

                    <div className="pointer-events-none absolute bottom-4 left-4 right-4 grid gap-2 sm:grid-cols-5">
                      <MiniSignal
                        label="Face"
                        value={faceDetected ? "Detected" : "Searching"}
                        active={faceDetected}
                      />

                      <MiniSignal
                        label="Centering"
                        value={faceCentered ? "Good" : "Adjust"}
                        active={faceCentered}
                      />

                      <MiniSignal
                        label="Lighting"
                        value={
                          lightingStatus === "good"
                            ? "Good"
                            : lightingStatus === "too-dark"
                              ? "Too dark"
                              : lightingStatus === "too-bright"
                                ? "Too bright"
                                : "Checking"
                        }
                        active={lightingStatus === "good"}
                      />

                      <MiniSignal
                        label="Hands"
                        value={handDetected ? `${handCount} detected` : "Optional"}
                        active={handDetected}
                      />

                      <MiniSignal
                        label="Stability"
                        value={movementStable ? "Stable" : `Hold ${holdRemainingSeconds}s`}
                        active={movementStable}
                      />
                    </div>
                  </>
                )}
              </div>

              {cameraError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {cameraError}
                </div>
              )}

              {modelError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {modelError}
                </div>
              )}

              <div className="space-y-2">
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Detection Calibration Progress</span>
                  <span className="font-medium">{progress}%</span>
                </div>
              </div>

              {isComplete && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Video analysis notice: </span>
                  During the interview, camera-based presentation signals such as face visibility,
                  face centering, hand visibility, movement stability, and camera presence may be
                  used to support your presentation feedback score. Only these presentation signals
                  are analyzed.
                </div>
              )}

              {!cameraStarted ? (
                <Button
                  onClick={() => void startCamera({ resetMetrics: true })}
                  className="w-full gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Start Detection Check
                </Button>
              ) : !modelReady ? (
                <Button
                  type="button"
                  onClick={retryDetectionAnalysis}
                  disabled={modelLoading}
                  className="w-full gap-2"
                >
                  {modelLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanFace className="h-4 w-4" />
                  )}
                  {modelLoading ? "Loading Detection Models..." : "Retry Detection Models"}
                </Button>
              ) : (
                <Button
                  onClick={handleStartInterview}
                  disabled={!isComplete}
                  className="w-full gap-2"
                >
                  {isComplete ? (
                    <>
                      <Video className="h-4 w-4" />
                      Start Video Interview
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Hold Steady for 5 Seconds
                    </>
                  )}
                </Button>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Camera access is used for the live preview and visual coaching. Video and landmark
                data stay in this browser and are not recorded or uploaded; only aggregated coaching
                metrics are saved.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Eye className="h-5 w-5 text-primary" />
                  Detection Checklist
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Real-time face and hand setup checks before the interview room opens.
                </p>
              </div>

              <div className="space-y-3">
                {checks.map((check) => (
                  <div key={check.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getStatusIcon(check.status)}</div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-medium">{check.label}</h3>

                          {check.value && (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                              {check.value}
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-muted-foreground">{check.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {modelReady && (
                <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                  Browser-based face and hand detection models loaded successfully.
                </div>
              )}

              {isComplete && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Detection calibration completed. Your video setup is ready.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniSignal({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-white backdrop-blur">
      <p className="text-[10px] uppercase tracking-wide text-white/60">{label}</p>
      <p className={active ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold"}>
        {value}
      </p>
    </div>
  );
}