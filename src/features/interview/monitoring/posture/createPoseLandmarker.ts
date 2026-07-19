import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { getInterviewVisionResolver } from "../face/createFaceLandmarker";
import { isGpuDelegateError, loadModelWithTimeout } from "../modelLoading";

const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

export function createInterviewPoseLandmarker(): Promise<PoseLandmarker> {
  poseLandmarkerPromise ??= loadModelWithTimeout("Posture coaching", async () => {
    const vision = await getInterviewVisionResolver();
    const options = {
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    };
    try {
      return await PoseLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
      });
    } catch (error) {
      if (!isGpuDelegateError(error)) throw error;
      return PoseLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: "CPU" },
      });
    }
  }).catch((error: unknown) => {
    poseLandmarkerPromise = null;
    throw error;
  });
  return poseLandmarkerPromise;
}

export function releaseInterviewPoseLandmarker(instance: PoseLandmarker | null) {
  if (!instance) return;
  try {
    instance.close();
  } finally {
    poseLandmarkerPromise = null;
  }
}
