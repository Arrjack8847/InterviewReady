import { HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";
import { getInterviewVisionResolver } from "@/features/interview/monitoring/face/createFaceLandmarker";
import {
  isGpuDelegateError,
  loadModelWithTimeout,
} from "@/features/interview/monitoring/modelLoading";

export type HandAnalysisResult = {
  hands: NormalizedLandmark[][];
  handDetected: boolean;
  handCount: number;
  totalLandmarks: number;
};

export type HandAnalyzerController = {
  detect: (video: HTMLVideoElement, timestampMs: number) => HandAnalysisResult;
  draw: (canvas: HTMLCanvasElement, video: HTMLVideoElement, hands: NormalizedLandmark[][]) => void;
  close: () => void;
};

const HAND_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export async function createHandAnalyzer(): Promise<HandAnalyzerController> {
  const handLandmarker = await loadModelWithTimeout("Hand coaching", async () => {
    const vision = await getInterviewVisionResolver();
    const options = {
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    };
    try {
      return await HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL, delegate: "GPU" },
      });
    } catch (error) {
      if (!isGpuDelegateError(error)) throw error;
      return HandLandmarker.createFromOptions(vision, {
        ...options,
        baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL, delegate: "CPU" },
      });
    }
  });

  return {
    detect(video: HTMLVideoElement, timestampMs: number): HandAnalysisResult {
      const result = handLandmarker.detectForVideo(video, timestampMs);
      const hands = result.landmarks || [];

      return {
        hands,
        handDetected: hands.length > 0,
        handCount: hands.length,
        totalLandmarks: hands.reduce((total, hand) => total + hand.length, 0),
      };
    },

    draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, hands: NormalizedLandmark[][]) {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const context = canvas.getContext("2d");

      if (!context) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      hands.forEach((hand) => {
        HAND_CONNECTIONS.forEach(([startIndex, endIndex]) => {
          const start = hand[startIndex];
          const end = hand[endIndex];

          if (!start || !end) return;

          context.beginPath();
          context.moveTo(start.x * canvas.width, start.y * canvas.height);
          context.lineTo(end.x * canvas.width, end.y * canvas.height);
          context.strokeStyle = "rgba(250, 204, 21, 0.95)";
          context.lineWidth = 3;
          context.shadowColor = "rgba(250, 204, 21, 0.55)";
          context.shadowBlur = 10;
          context.stroke();
          context.shadowBlur = 0;
        });

        hand.forEach((point) => {
          const x = point.x * canvas.width;
          const y = point.y * canvas.height;

          context.beginPath();
          context.arc(x, y, 4, 0, Math.PI * 2);
          context.fillStyle = "rgba(250, 204, 21, 0.98)";
          context.fill();

          context.beginPath();
          context.arc(x, y, 8, 0, Math.PI * 2);
          context.strokeStyle = "rgba(250, 204, 21, 0.35)";
          context.lineWidth = 2;
          context.stroke();
        });
      });
    },

    close() {
      handLandmarker.close();
    },
  };
}
