export type InterviewMediaErrorCode =
  | "CAMERA_PERMISSION_DENIED"
  | "CAMERA_NOT_FOUND"
  | "CAMERA_IN_USE"
  | "CAMERA_CONSTRAINT_UNSUPPORTED"
  | "CAMERA_INTERRUPTED"
  | "MIC_PERMISSION_DENIED"
  | "MIC_NOT_FOUND"
  | "MIC_IN_USE"
  | "MIC_CONSTRAINT_UNSUPPORTED"
  | "MIC_INTERRUPTED"
  | "MEDIA_SECURITY_ERROR"
  | "MEDIA_UNAVAILABLE";

export interface InterviewMediaError {
  code: InterviewMediaErrorCode;
  message: string;
  retryable: boolean;
}

function errorName(error: unknown) {
  if (error && typeof error === "object" && "name" in error) {
    return String((error as { name?: unknown }).name || "");
  }
  return "";
}

export function mapInterviewMediaError(
  kind: "camera" | "microphone",
  error: unknown,
): InterviewMediaError {
  const camera = kind === "camera";
  const name = errorName(error);
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      code: camera ? "CAMERA_PERMISSION_DENIED" : "MIC_PERMISSION_DENIED",
      message: `${camera ? "Camera" : "Microphone"} permission was denied. Allow access in your browser settings and try again.`,
      retryable: true,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      code: camera ? "CAMERA_NOT_FOUND" : "MIC_NOT_FOUND",
      message: `No ${camera ? "camera" : "microphone"} was found on this device.`,
      retryable: false,
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      code: camera ? "CAMERA_IN_USE" : "MIC_IN_USE",
      message: `The ${camera ? "camera" : "microphone"} is unavailable or being used by another application.`,
      retryable: true,
    };
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      code: camera ? "CAMERA_CONSTRAINT_UNSUPPORTED" : "MIC_CONSTRAINT_UNSUPPORTED",
      message: `The selected ${camera ? "camera" : "microphone"} does not support the requested settings.`,
      retryable: true,
    };
  }
  if (name === "AbortError") {
    return {
      code: camera ? "CAMERA_INTERRUPTED" : "MIC_INTERRUPTED",
      message: `${camera ? "Camera" : "Microphone"} access was interrupted. Please reconnect and try again.`,
      retryable: true,
    };
  }
  if (name === "SecurityError") {
    return {
      code: "MEDIA_SECURITY_ERROR",
      message: `${camera ? "Camera" : "Microphone"} access requires a secure browser connection.`,
      retryable: false,
    };
  }
  return {
    code: "MEDIA_UNAVAILABLE",
    message: `${camera ? "Camera" : "Microphone"} access is unavailable. Check the device and try again.`,
    retryable: true,
  };
}

export async function requestInterviewCameraStream(
  mediaDevices: Pick<MediaDevices, "getUserMedia"> = navigator.mediaDevices,
) {
  const preferred: MediaStreamConstraints = {
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  };
  try {
    return await mediaDevices.getUserMedia(preferred);
  } catch (error) {
    const name = errorName(error);
    if (name !== "OverconstrainedError" && name !== "ConstraintNotSatisfiedError") throw error;
  }
  try {
    return await mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  } catch (error) {
    const name = errorName(error);
    if (name !== "OverconstrainedError" && name !== "ConstraintNotSatisfiedError") throw error;
  }
  return mediaDevices.getUserMedia({ video: true, audio: false });
}

export async function requestInterviewMicrophoneStream(
  mediaDevices: Pick<MediaDevices, "getUserMedia"> = navigator.mediaDevices,
) {
  try {
    return await mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (error) {
    const name = errorName(error);
    if (name !== "OverconstrainedError" && name !== "ConstraintNotSatisfiedError") throw error;
    return mediaDevices.getUserMedia({ audio: true, video: false });
  }
}
