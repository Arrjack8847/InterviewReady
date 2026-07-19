import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { isGpuDelegateError, loadModelWithTimeout } from "../modelLoading";

const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const DEFAULT_MAX_FACES = 2;

let visionResolverPromise: Promise<
  Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
> | null = null;

export function getInterviewVisionResolver() {
  if (!visionResolverPromise) {
    visionResolverPromise = FilesetResolver.forVisionTasks(WASM_PATH);
  }

  return visionResolverPromise;
}

export async function createInterviewFaceLandmarker({
  maxFaces = DEFAULT_MAX_FACES,
}: {
  maxFaces?: number;
} = {}): Promise<FaceLandmarker> {
  return loadModelWithTimeout("Face monitoring", async () => {
    const vision = await getInterviewVisionResolver();
    const options = {
      runningMode: "VIDEO" as const,
      numFaces: Math.max(1, Math.floor(maxFaces)),
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    };
    try {
      return await FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL, delegate: "GPU" },
      });
    } catch (error) {
      if (!isGpuDelegateError(error)) throw error;
      return FaceLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL, delegate: "CPU" },
      });
    }
  });
}

export type FaceDetectionSnapshot = {
  faceCount: number;
  primaryFace: NormalizedLandmark[] | null;
  hasExactlyOneFace: boolean;
  hasMultipleFaces: boolean;
};

export function readFaceDetectionResult(result: FaceLandmarkerResult): FaceDetectionSnapshot {
  const faces = result.faceLandmarks ?? [];
  const faceCount = faces.length;

  return {
    faceCount,
    primaryFace: faceCount === 1 ? faces[0] : null,
    hasExactlyOneFace: faceCount === 1,
    hasMultipleFaces: faceCount > 1,
  };
}
