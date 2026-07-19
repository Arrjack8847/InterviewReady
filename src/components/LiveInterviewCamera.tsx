import { useEffect, useRef, useState } from "react";

import {
  createInterviewFaceLandmarker,
  readFaceDetectionResult,
} from "@/features/interview/monitoring/face/createFaceLandmarker";

export type LiveFaceState =
  | "inactive"
  | "loading"
  | "one_face"
  | "no_face"
  | "multiple_faces"
  | "error";

type LiveInterviewCameraProps = {
  stream: MediaStream | null;
  active: boolean;
  onFaceStateChange?: (state: LiveFaceState, faceCount: number) => void;
};

const ANALYSIS_INTERVAL_MS = 180;

export function LiveInterviewCamera({
  stream,
  active,
  onFaceStateChange,
}: LiveInterviewCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastAnalysisTimeRef = useRef(0);
  const lastReportedStateRef = useRef<LiveFaceState>("inactive");

  const [faceState, setFaceState] = useState<LiveFaceState>("inactive");

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.srcObject = stream;

    if (stream) {
      void video.play().catch(() => {
        // The camera preview remains available after user interaction.
      });
    }

    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (!active || !stream || !videoRef.current) {
      setFaceState("inactive");
      lastReportedStateRef.current = "inactive";
      onFaceStateChange?.("inactive", 0);

      return;
    }

    const video = videoRef.current;
    let cancelled = false;

    function reportState(nextState: LiveFaceState, faceCount: number) {
      setFaceState(nextState);

      if (lastReportedStateRef.current !== nextState) {
        lastReportedStateRef.current = nextState;
        onFaceStateChange?.(nextState, faceCount);
      }
    }

    async function startAnalysis() {
      reportState("loading", 0);

      try {
        const landmarker = await createInterviewFaceLandmarker({
          maxFaces: 2,
        });

        if (cancelled) {
          landmarker.close();
          return;
        }

        const analyseFrame = (timestamp: number) => {
          if (cancelled) {
            return;
          }

          if (
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            timestamp - lastAnalysisTimeRef.current >= ANALYSIS_INTERVAL_MS
          ) {
            lastAnalysisTimeRef.current = timestamp;

            const result = landmarker.detectForVideo(video, timestamp);

            const snapshot = readFaceDetectionResult(result);

            if (snapshot.faceCount === 0) {
              reportState("no_face", 0);
            } else if (snapshot.faceCount > 1) {
              reportState("multiple_faces", snapshot.faceCount);
            } else {
              reportState("one_face", 1);
            }
          }

          animationFrameRef.current = window.requestAnimationFrame(analyseFrame);
        };

        animationFrameRef.current = window.requestAnimationFrame(analyseFrame);

        return () => {
          landmarker.close();
        };
      } catch (error) {
        console.error("Live face analysis failed:", error);

        reportState("error", 0);

        return undefined;
      }
    }

    let disposeLandmarker: (() => void) | undefined;

    void startAnalysis().then((dispose) => {
      disposeLandmarker = dispose;
    });

    return () => {
      cancelled = true;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = null;
      disposeLandmarker?.();
    };
  }, [active, onFaceStateChange, stream]);

  const statusText = (() => {
    switch (faceState) {
      case "loading":
        return "Starting camera analysis…";

      case "one_face":
        return "Face detected";

      case "no_face":
        return "Move back into the camera frame";

      case "multiple_faces":
        return "More than one face is visible";

      case "error":
        return "Visual analysis unavailable";

      default:
        return "Camera ready";
    }
  })();

  return (
    <div className={`live-interview-camera live-interview-camera--${faceState}`}>
      <video ref={videoRef} className="live-interview-camera__video" muted playsInline autoPlay />

      <div className="live-interview-camera__frame" aria-hidden="true" />

      <div className="live-interview-camera__status" role="status" aria-live="polite">
        <i aria-hidden="true" />
        <span>{statusText}</span>
      </div>
    </div>
  );
}
