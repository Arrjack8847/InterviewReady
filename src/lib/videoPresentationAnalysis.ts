import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import { createHandAnalyzer, type HandAnalyzerController } from "@/lib/handAnalysis";
import {
  createInterviewFaceLandmarker,
  readFaceDetectionResult,
} from "@/features/interview/monitoring/face/createFaceLandmarker";
import { clampScore } from "@/lib/metrics";

export interface VideoPresentationMetrics {
  faceDetected: boolean;
  faceCentered: boolean;
  handDetected: boolean;
  faceVisibilityScore: number;
  faceCenteringScore: number;
  handVisibilityScore: number;
  movementStabilityScore: number;
  cameraPresenceScore: number;
  overallPresentationScore: number;
  eyeContactScore: number;
  frameCount: number;
  faceDetectedFrames: number;
  faceCenteredFrames: number;
  handDetectedFrames: number;
  stableFrames: number;
  eyeContactFrames: number;
  screenFacingFrames: number;
  lookingAwayFrames: number;
  validFaceFrames: number;
  analysisDurationMs: number;
  visualSummary: string[];
}

export interface VideoPresentationAnalyzerController {
  analyze: (video: HTMLVideoElement, timestampMs: number) => VideoPresentationMetrics;
  getMetrics: () => VideoPresentationMetrics;
  reset: () => void;
  close: () => void;
}

type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PresentationCounters = {
  frameCount: number;
  faceDetectedFrames: number;
  faceCenteredFrames: number;
  handDetectedFrames: number;
  stableFrames: number;
  eyeContactFrames: number;
  screenFacingFrames: number;
  lookingAwayFrames: number;
  validFaceFrames: number;
  cameraActiveFrames: number;
  analysisStartedAt: number | null;
  lastAnalyzedAt: number | null;
  lastFaceCenterX: number | null;
  lastFaceCenterY: number | null;
  movementSamples: number[];
  faceDetected: boolean;
  faceCentered: boolean;
  handDetected: boolean;
  eyeContactEstimated: boolean;
};

export type EyeContactDirectionSample = {
  yawOffset: number;
  irisCenter: number | null;
  faceCenterX: number;
  faceCenterY: number;
};

export type EyeContactBaseline = {
  baselineYawOffset: number;
  baselineIrisCenter: number | null;
  baselineFaceCenterX: number;
  baselineFaceCenterY: number;
};

export type EyeContactDirectionEstimate = EyeContactDirectionSample & {
  validFace: boolean;
  headFacingCamera: boolean;
  irisNearCenter: boolean;
  screenFacing: boolean;
  eyeContactEstimated: boolean;
};

const MAX_MOVEMENT_SAMPLES = 90;
const STABLE_MOVEMENT_THRESHOLD = 0.018;
const NOSE_TIP_INDEX = 1;
const LEFT_EYE_OUTER_INDEX = 33;
const LEFT_EYE_INNER_INDEX = 133;
const RIGHT_EYE_INNER_INDEX = 362;
const RIGHT_EYE_OUTER_INDEX = 263;
const LEFT_IRIS_CENTER_INDEX = 468;
const RIGHT_IRIS_CENTER_INDEX = 473;
const BASELINE_YAW_THRESHOLD = 0.13;
const BASELINE_IRIS_THRESHOLD = 0.2;
const BASELINE_FACE_CENTER_THRESHOLD = 0.18;
const DEFAULT_IRIS_CENTER = 0.5;

function getEmptyCounters(): PresentationCounters {
  return {
    frameCount: 0,
    faceDetectedFrames: 0,
    faceCenteredFrames: 0,
    handDetectedFrames: 0,
    stableFrames: 0,
    eyeContactFrames: 0,
    screenFacingFrames: 0,
    lookingAwayFrames: 0,
    validFaceFrames: 0,
    cameraActiveFrames: 0,
    analysisStartedAt: null,
    lastAnalyzedAt: null,
    lastFaceCenterX: null,
    lastFaceCenterY: null,
    movementSamples: [],
    faceDetected: false,
    faceCentered: false,
    handDetected: false,
    eyeContactEstimated: false,
  };
}

function getFaceBox(landmarks: NormalizedLandmark[]): FaceBox {
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
}

function isFaceCentered(box: FaceBox) {
  const faceCenterX = box.x + box.width / 2;
  const faceCenterY = box.y + box.height / 2;
  const centerDistanceX = Math.abs(faceCenterX - 0.5);
  const centerDistanceY = Math.abs(faceCenterY - 0.5);
  const faceSizeGood = box.width > 0.16 && box.width < 0.7 && box.height > 0.2 && box.height < 0.78;

  return centerDistanceX < 0.18 && centerDistanceY < 0.2 && faceSizeGood;
}

function averageNumbers(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getIrisRatio(
  landmarks: NormalizedLandmark[],
  outerIndex: number,
  innerIndex: number,
  irisIndex: number,
) {
  const outer = landmarks[outerIndex];
  const inner = landmarks[innerIndex];
  const iris = landmarks[irisIndex];

  if (!outer || !inner || !iris) return null;

  const minX = Math.min(outer.x, inner.x);
  const maxX = Math.max(outer.x, inner.x);
  const width = maxX - minX;

  if (width <= 0.001) return null;

  return (iris.x - minX) / width;
}

export function getEyeContactDirectionSample(
  landmarks: NormalizedLandmark[],
): EyeContactDirectionSample | null {
  const nose = landmarks[NOSE_TIP_INDEX];
  const leftOuter = landmarks[LEFT_EYE_OUTER_INDEX];
  const rightOuter = landmarks[RIGHT_EYE_OUTER_INDEX];

  if (!nose || !leftOuter || !rightOuter) return null;

  const box = getFaceBox(landmarks);
  const faceCenterX = box.x + box.width / 2;
  const faceCenterY = box.y + box.height / 2;
  const eyeMidX = (leftOuter.x + rightOuter.x) / 2;
  const eyeSpan = Math.abs(rightOuter.x - leftOuter.x);

  if (eyeSpan <= 0.001) return null;

  const leftIrisRatio = getIrisRatio(
    landmarks,
    LEFT_EYE_OUTER_INDEX,
    LEFT_EYE_INNER_INDEX,
    LEFT_IRIS_CENTER_INDEX,
  );
  const rightIrisRatio = getIrisRatio(
    landmarks,
    RIGHT_EYE_INNER_INDEX,
    RIGHT_EYE_OUTER_INDEX,
    RIGHT_IRIS_CENTER_INDEX,
  );
  const irisRatios = [leftIrisRatio, rightIrisRatio].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  return {
    yawOffset: (nose.x - eyeMidX) / eyeSpan,
    irisCenter: irisRatios.length > 0 ? averageNumbers(irisRatios) : null,
    faceCenterX,
    faceCenterY,
  };
}

export function buildEyeContactBaseline(
  samples: EyeContactDirectionSample[],
): EyeContactBaseline | null {
  if (samples.length === 0) return null;

  const irisSamples = samples
    .map((sample) => sample.irisCenter)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return {
    baselineYawOffset: averageNumbers(samples.map((sample) => sample.yawOffset)),
    baselineIrisCenter: irisSamples.length > 0 ? averageNumbers(irisSamples) : null,
    baselineFaceCenterX: averageNumbers(samples.map((sample) => sample.faceCenterX)),
    baselineFaceCenterY: averageNumbers(samples.map((sample) => sample.faceCenterY)),
  };
}

export function estimateEyeContactDirection({
  landmarks,
  faceCentered,
  baseline,
}: {
  landmarks: NormalizedLandmark[];
  faceCentered: boolean;
  baseline: EyeContactBaseline | null;
}): EyeContactDirectionEstimate {
  const sample = getEyeContactDirectionSample(landmarks);

  if (!sample) {
    return {
      yawOffset: 0,
      irisCenter: null,
      faceCenterX: 0.5,
      faceCenterY: 0.5,
      validFace: false,
      headFacingCamera: false,
      irisNearCenter: true,
      screenFacing: false,
      eyeContactEstimated: false,
    };
  }

  const yawTarget = baseline?.baselineYawOffset ?? 0;
  const irisTarget = baseline?.baselineIrisCenter ?? DEFAULT_IRIS_CENTER;
  const faceCenterTargetX = baseline?.baselineFaceCenterX ?? 0.5;
  const faceCenterTargetY = baseline?.baselineFaceCenterY ?? 0.5;
  const faceCenterDelta = Math.hypot(
    sample.faceCenterX - faceCenterTargetX,
    sample.faceCenterY - faceCenterTargetY,
  );
  const headFacingCamera =
    Math.abs(sample.yawOffset - yawTarget) <= BASELINE_YAW_THRESHOLD &&
    faceCenterDelta <= BASELINE_FACE_CENTER_THRESHOLD;
  const irisNearCenter =
    sample.irisCenter === null ||
    Math.abs(sample.irisCenter - irisTarget) <= BASELINE_IRIS_THRESHOLD;
  const screenFacing = headFacingCamera && irisNearCenter;

  return {
    ...sample,
    validFace: true,
    headFacingCamera,
    irisNearCenter,
    screenFacing,
    eyeContactEstimated: faceCentered && screenFacing,
  };
}

function scoreRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;

  return clampScore((numerator / denominator) * 100);
}

function buildVisualSummary(metrics: Omit<VideoPresentationMetrics, "visualSummary">) {
  if (metrics.frameCount === 0) {
    return ["Camera was not active long enough for video presentation analysis."];
  }

  const summary: string[] = [];

  if (metrics.cameraPresenceScore >= 80) {
    summary.push("Your camera presence was consistent during the video interview.");
  } else {
    summary.push("Camera presence was limited during the video interview.");
  }

  if (metrics.faceVisibilityScore >= 80) {
    summary.push("Your face was visible for most of the session.");
  } else {
    summary.push("Face visibility was limited; keep your face clearly in frame for practice.");
  }

  if (metrics.faceCenteringScore >= 75) {
    summary.push("Your face centering was stable for most analyzed frames.");
  } else {
    summary.push("Try keeping your face closer to the center of the camera frame.");
  }

  if (metrics.movementStabilityScore >= 75) {
    summary.push("Your movement stability estimate was good.");
  } else {
    summary.push(
      "Movement stability varied; try holding a steady camera position while answering.",
    );
  }

  if (metrics.eyeContactScore >= 70) {
    summary.push("Your facial orientation was generally toward the camera or screen.");
  } else if (metrics.validFaceFrames > 0) {
    summary.push(
      "Your screen-facing direction estimate varied; brief glances down to type are expected.",
    );
  }

  if (metrics.handVisibilityScore > 0) {
    summary.push("Hand visibility was detected during parts of the interview.");
  } else {
    summary.push(
      "Hand visibility was limited, which is optional but can support natural presentation.",
    );
  }

  summary.push("Only presentation signals are included in this video feedback.");

  return summary;
}

function buildMetrics(counters: PresentationCounters): VideoPresentationMetrics {
  const frameCount = counters.frameCount;
  const faceVisibilityScore = scoreRatio(counters.faceDetectedFrames, frameCount);
  const faceCenteringScore = scoreRatio(counters.faceCenteredFrames, counters.faceDetectedFrames);
  const handVisibilityScore = scoreRatio(counters.handDetectedFrames, frameCount);
  const movementStabilityScore = scoreRatio(counters.stableFrames, counters.faceDetectedFrames);
  const cameraPresenceScore = frameCount > 0 ? 100 : 0;
  const eyeContactScore = scoreRatio(counters.eyeContactFrames, counters.validFaceFrames);
  const overallPresentationScore = clampScore(
    cameraPresenceScore * 0.15 +
      faceVisibilityScore * 0.25 +
      faceCenteringScore * 0.2 +
      movementStabilityScore * 0.2 +
      eyeContactScore * 0.2,
  );
  const analysisDurationMs =
    counters.analysisStartedAt !== null && counters.lastAnalyzedAt !== null
      ? Math.max(0, Math.round(counters.lastAnalyzedAt - counters.analysisStartedAt))
      : 0;

  const metricsWithoutSummary = {
    faceDetected: counters.faceDetected,
    faceCentered: counters.faceCentered,
    handDetected: counters.handDetected,
    faceVisibilityScore,
    faceCenteringScore,
    handVisibilityScore,
    movementStabilityScore,
    cameraPresenceScore,
    overallPresentationScore,
    eyeContactScore,
    frameCount,
    faceDetectedFrames: counters.faceDetectedFrames,
    faceCenteredFrames: counters.faceCenteredFrames,
    handDetectedFrames: counters.handDetectedFrames,
    stableFrames: counters.stableFrames,
    eyeContactFrames: counters.eyeContactFrames,
    screenFacingFrames: counters.screenFacingFrames,
    lookingAwayFrames: counters.lookingAwayFrames,
    validFaceFrames: counters.validFaceFrames,
    analysisDurationMs,
  };

  return {
    ...metricsWithoutSummary,
    visualSummary: buildVisualSummary(metricsWithoutSummary),
  };
}

export async function createVideoPresentationAnalyzer(): Promise<VideoPresentationAnalyzerController> {
  const faceLandmarker = await createInterviewFaceLandmarker({
    maxFaces: 2,
  });

  let handAnalyzer: HandAnalyzerController | null = null;

  try {
    handAnalyzer = await createHandAnalyzer();
  } catch (error) {
    console.warn("Hand presentation analyzer could not be loaded:", error);
  }

  let counters = getEmptyCounters();
  let closed = false;

  return {
    analyze(video: HTMLVideoElement, timestampMs: number) {
      if (closed || video.videoWidth === 0 || video.videoHeight === 0) {
        return buildMetrics(counters);
      }

      counters.analysisStartedAt ??= timestampMs;
      counters.lastAnalyzedAt = timestampMs;
      counters.frameCount += 1;
      counters.cameraActiveFrames += 1;

      const faceResult = faceLandmarker.detectForVideo(video, timestampMs);
      const faceDetection = readFaceDetectionResult(faceResult);
      const faceLandmarks = faceDetection.primaryFace ?? [];
      const handResult = handAnalyzer?.detect(video, timestampMs);
      const handDetected = Boolean(handResult?.handDetected);

      counters.handDetected = handDetected;

      if (handDetected) {
        counters.handDetectedFrames += 1;
      }

      if (!faceLandmarks.length) {
        counters.faceDetected = false;
        counters.faceCentered = false;
        counters.eyeContactEstimated = false;
        counters.lastFaceCenterX = null;
        counters.lastFaceCenterY = null;

        return buildMetrics(counters);
      }

      counters.faceDetected = true;
      counters.faceDetectedFrames += 1;

      const box = getFaceBox(faceLandmarks);
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const centered = isFaceCentered(box);
      const eyeContactEstimate = estimateEyeContactDirection({
        landmarks: faceLandmarks,
        faceCentered: centered,
        baseline: null,
      });

      counters.faceCentered = centered;
      counters.eyeContactEstimated = eyeContactEstimate.eyeContactEstimated;

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

      if (centered) {
        counters.faceCenteredFrames += 1;
      }

      if (counters.lastFaceCenterX !== null && counters.lastFaceCenterY !== null) {
        const movement = Math.hypot(
          faceCenterX - counters.lastFaceCenterX,
          faceCenterY - counters.lastFaceCenterY,
        );

        counters.movementSamples.push(movement);

        if (counters.movementSamples.length > MAX_MOVEMENT_SAMPLES) {
          counters.movementSamples.shift();
        }

        if (movement <= STABLE_MOVEMENT_THRESHOLD) {
          counters.stableFrames += 1;
        }
      }

      counters.lastFaceCenterX = faceCenterX;
      counters.lastFaceCenterY = faceCenterY;

      return buildMetrics(counters);
    },

    getMetrics() {
      return buildMetrics(counters);
    },

    reset() {
      counters = getEmptyCounters();
    },

    close() {
      if (closed) return;

      closed = true;
      faceLandmarker.close();
      handAnalyzer?.close();
    },
  };
}
