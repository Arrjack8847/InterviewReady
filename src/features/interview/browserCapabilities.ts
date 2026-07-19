export interface InterviewBrowserCapabilities {
  cameraCapture: boolean;
  microphoneCapture: boolean;
  audioContext: boolean;
  speechRecognition: boolean;
  mediaStream: boolean;
  mediaStreamTrack: boolean;
  requestAnimationFrame: boolean;
  permissionsApi: boolean;
  pageVisibilityApi: boolean;
  webAssembly: boolean;
  webGL: boolean;
  mediaPipeRuntime: boolean;
}

export interface InterviewCapabilityMessage {
  level: "blocking" | "warning";
  code: string;
  message: string;
}

type CapabilityEnvironment = {
  window?: Record<string, unknown>;
  navigator?: Record<string, unknown>;
  document?: { visibilityState?: string; createElement?: (tag: string) => unknown };
  webAssembly?: unknown;
  mediaStream?: unknown;
  mediaStreamTrack?: unknown;
};

function canCreateWebGlContext(documentValue: CapabilityEnvironment["document"]) {
  try {
    const canvas = documentValue?.createElement?.("canvas") as
      | { getContext?: (context: string) => unknown }
      | undefined;
    return Boolean(canvas?.getContext?.("webgl2") || canvas?.getContext?.("webgl"));
  } catch {
    return false;
  }
}

export function detectInterviewBrowserCapabilities(
  override?: CapabilityEnvironment,
): InterviewBrowserCapabilities {
  const windowValue =
    override?.window ??
    (typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : undefined);
  const navigatorValue =
    override?.navigator ??
    (typeof navigator !== "undefined"
      ? (navigator as unknown as Record<string, unknown>)
      : undefined);
  const documentValue =
    override?.document ??
    (typeof document !== "undefined" ? (document as CapabilityEnvironment["document"]) : undefined);
  const mediaDevices = navigatorValue?.mediaDevices as
    | { getUserMedia?: (...args: unknown[]) => unknown }
    | undefined;
  const hasGetUserMedia = typeof mediaDevices?.getUserMedia === "function";
  const hasMediaStream = Boolean(
    override?.mediaStream ??
    (typeof MediaStream !== "undefined" ? MediaStream : windowValue?.MediaStream),
  );
  const hasMediaStreamTrack = Boolean(
    override?.mediaStreamTrack ??
    (typeof MediaStreamTrack !== "undefined" ? MediaStreamTrack : windowValue?.MediaStreamTrack),
  );
  const hasAnimationFrame = typeof windowValue?.requestAnimationFrame === "function";
  const hasWebAssembly = Boolean(
    override?.webAssembly ??
    (typeof WebAssembly !== "undefined" ? WebAssembly : windowValue?.WebAssembly),
  );
  const webGL = canCreateWebGlContext(documentValue);

  return {
    cameraCapture: hasGetUserMedia && hasMediaStream && hasMediaStreamTrack,
    microphoneCapture: hasGetUserMedia && hasMediaStream && hasMediaStreamTrack,
    audioContext: Boolean(windowValue?.AudioContext || windowValue?.webkitAudioContext),
    speechRecognition: Boolean(
      windowValue?.SpeechRecognition || windowValue?.webkitSpeechRecognition,
    ),
    mediaStream: hasMediaStream,
    mediaStreamTrack: hasMediaStreamTrack,
    requestAnimationFrame: hasAnimationFrame,
    permissionsApi: Boolean(
      (navigatorValue?.permissions as { query?: unknown } | undefined)?.query,
    ),
    pageVisibilityApi: Boolean(documentValue && "visibilityState" in documentValue),
    webAssembly: hasWebAssembly,
    webGL,
    mediaPipeRuntime: hasWebAssembly && webGL && hasAnimationFrame,
  };
}

export function getInterviewCapabilityMessages(
  mode: "Text" | "Voice" | "Video" | "text" | "voice" | "video",
  capabilities: InterviewBrowserCapabilities,
): InterviewCapabilityMessage[] {
  const normalizedMode = mode.toLowerCase();
  const messages: InterviewCapabilityMessage[] = [];

  if (normalizedMode === "video" && !capabilities.cameraCapture) {
    messages.push({
      level: "blocking",
      code: "CAMERA_CAPTURE_UNSUPPORTED",
      message:
        "Camera access is unavailable in this browser. Choose text or voice mode, or use a current browser with camera support.",
    });
  }
  if (normalizedMode !== "text" && !capabilities.speechRecognition) {
    messages.push({
      level: "warning",
      code: "SPEECH_RECOGNITION_UNSUPPORTED",
      message:
        "Live speech recognition is unavailable in this browser. You can continue by typing your answer.",
    });
  }
  if (normalizedMode !== "text" && !capabilities.microphoneCapture) {
    messages.push({
      level: "warning",
      code: "MICROPHONE_CAPTURE_UNSUPPORTED",
      message:
        "Microphone coaching is unavailable in this browser. Your typed answer can still be evaluated.",
    });
  }
  if (normalizedMode === "video" && !capabilities.mediaPipeRuntime) {
    messages.push({
      level: "warning",
      code: "VISUAL_COACHING_UNSUPPORTED",
      message:
        "Visual coaching may be unavailable on this device. Camera preview can still work if camera access is supported.",
    });
  }
  return messages;
}
