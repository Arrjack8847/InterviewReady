import type {
  FaceMeasurement,
  FacePresenceState,
} from "./faceMonitor";

export type FaceWarningType =
  | "no_face"
  | "multiple_faces";

export type FaceWarningSeverity =
  | "info"
  | "warning"
  | "pause";

export type FaceWarning = {
  type: FaceWarningType;
  severity: FaceWarningSeverity;
  message: string;

  startedAtMs: number;
  durationMs: number;

  shouldPause: boolean;
};

export type FaceWarningConfig = {
  noFaceWarningAfterMs: number;
  noFacePauseAfterMs: number;

  multipleFacesWarningAfterMs: number;
  multipleFacesPauseAfterMs: number;

  warningCooldownMs: number;
  recoveryDurationMs: number;
};

export type FaceWarningSnapshot = {
  activeWarning: FaceWarning | null;

  noFaceStartedAtMs: number | null;
  multipleFacesStartedAtMs: number | null;
  recoveryStartedAtMs: number | null;

  lastWarningAt: Partial<
    Record<FaceWarningType, number>
  >;

  pauseRequestedForIncident: boolean;
};

export type FaceWarningControllerOptions = {
  config?: Partial<FaceWarningConfig>;

  pauseEnabled?: boolean;

  onWarning?: (
    warning: FaceWarning,
  ) => void;

  onWarningCleared?: (
    previousWarning: FaceWarning,
  ) => void;

  onPauseRequested?: (
    warning: FaceWarning,
  ) => void;
};

export type FaceWarningController = {
  processMeasurement: (
    measurement: FaceMeasurement,
  ) => FaceWarning | null;

  reset: () => void;

  getSnapshot: () => FaceWarningSnapshot;

  getActiveWarning: () =>
    FaceWarning | null;
};

const DEFAULT_CONFIG: FaceWarningConfig = {
  noFaceWarningAfterMs: 2_000,
  noFacePauseAfterMs: 5_000,

  multipleFacesWarningAfterMs: 1_500,
  multipleFacesPauseAfterMs: 4_000,

  warningCooldownMs: 12_000,
  recoveryDurationMs: 3_000,
};

function createInitialSnapshot(): FaceWarningSnapshot {
  return {
    activeWarning: null,

    noFaceStartedAtMs: null,
    multipleFacesStartedAtMs: null,
    recoveryStartedAtMs: null,

    lastWarningAt: {},
    pauseRequestedForIncident: false,
  };
}

function normalizeConfig(
  partialConfig: Partial<FaceWarningConfig> = {},
): FaceWarningConfig {
  const merged = {
    ...DEFAULT_CONFIG,
    ...partialConfig,
  };

  const noFaceWarningAfterMs = Math.max(
    0,
    merged.noFaceWarningAfterMs,
  );

  const multipleFacesWarningAfterMs =
    Math.max(
      0,
      merged.multipleFacesWarningAfterMs,
    );

  return {
    noFaceWarningAfterMs,
    noFacePauseAfterMs: Math.max(
      noFaceWarningAfterMs,
      merged.noFacePauseAfterMs,
    ),

    multipleFacesWarningAfterMs,
    multipleFacesPauseAfterMs: Math.max(
      multipleFacesWarningAfterMs,
      merged.multipleFacesPauseAfterMs,
    ),

    warningCooldownMs: Math.max(
      0,
      merged.warningCooldownMs,
    ),

    recoveryDurationMs: Math.max(
      0,
      merged.recoveryDurationMs,
    ),
  };
}

function getWarningMessage(
  type: FaceWarningType,
  severity: FaceWarningSeverity,
): string {
  if (type === "no_face") {
    if (severity === "pause") {
      return "The interview has been paused because your face is no longer visible. Return to the camera to continue.";
    }

    return "Face not detected. Return to the camera frame before the interview pauses.";
  }

  if (severity === "pause") {
    return "The interview has been paused because multiple people remain visible. Only the candidate may stay in frame.";
  }

  return "Multiple people detected. Only the candidate may remain visible during the interview.";
}

export function createFaceWarningController(
  options: FaceWarningControllerOptions = {},
): FaceWarningController {
  const config = normalizeConfig(
    options.config,
  );

  let snapshot =
    createInitialSnapshot();

  function canShowWarning(
    type: FaceWarningType,
    timestampMs: number,
  ): boolean {
    const previousTimestamp =
      snapshot.lastWarningAt[type];

    if (previousTimestamp === undefined) {
      return true;
    }

    return (
      timestampMs - previousTimestamp >=
      config.warningCooldownMs
    );
  }

  function clearWarning(): void {
    const previousWarning =
      snapshot.activeWarning;

    if (!previousWarning) {
      return;
    }

    snapshot.activeWarning = null;

    options.onWarningCleared?.(
      previousWarning,
    );
  }

  function beginIncident(
    type: FaceWarningType,
    timestampMs: number,
  ): number {
    snapshot.recoveryStartedAtMs = null;

    if (type === "no_face") {
      const switchedIncident =
        snapshot.multipleFacesStartedAtMs !==
          null ||
        snapshot.activeWarning?.type ===
          "multiple_faces";

      if (switchedIncident) {
        clearWarning();
        snapshot.pauseRequestedForIncident =
          false;
      }

      snapshot.multipleFacesStartedAtMs =
        null;

      snapshot.noFaceStartedAtMs ??=
        timestampMs;

      return snapshot.noFaceStartedAtMs;
    }

    const switchedIncident =
      snapshot.noFaceStartedAtMs !== null ||
      snapshot.activeWarning?.type ===
        "no_face";

    if (switchedIncident) {
      clearWarning();
      snapshot.pauseRequestedForIncident =
        false;
    }

    snapshot.noFaceStartedAtMs = null;

    snapshot.multipleFacesStartedAtMs ??=
      timestampMs;

    return snapshot.multipleFacesStartedAtMs;
  }

  function activateWarning(
    type: FaceWarningType,
    severity: FaceWarningSeverity,
    startedAtMs: number,
    timestampMs: number,
  ): FaceWarning {
    const durationMs = Math.max(
      timestampMs - startedAtMs,
      0,
    );

    const shouldPause =
      severity === "pause" &&
      Boolean(options.pauseEnabled);

    const warning: FaceWarning = {
      type,
      severity,
      message: getWarningMessage(
        type,
        severity,
      ),
      startedAtMs,
      durationMs,
      shouldPause,
    };

    const existing =
      snapshot.activeWarning;

    const changed =
      !existing ||
      existing.type !== warning.type ||
      existing.severity !==
        warning.severity;

    snapshot.activeWarning = warning;

    /*
     * Visual warning notifications remain cooldown-limited,
     * while the separate pause request below is incident-locked
     * and must still fire when the pause threshold is reached.
     */
    const shouldNotify =
      changed &&
      canShowWarning(type, timestampMs);

    if (shouldNotify) {
      snapshot.lastWarningAt[type] =
        timestampMs;

      options.onWarning?.(warning);
    }

    if (
      warning.shouldPause &&
      !snapshot.pauseRequestedForIncident
    ) {
      snapshot.pauseRequestedForIncident =
        true;

      options.onPauseRequested?.(
        warning,
      );
    }

    return warning;
  }

  function processNoFace(
    timestampMs: number,
  ): FaceWarning | null {
    const startedAt = beginIncident(
      "no_face",
      timestampMs,
    );

    const durationMs =
      timestampMs - startedAt;

    if (
      durationMs >=
      config.noFacePauseAfterMs
    ) {
      return activateWarning(
        "no_face",
        "pause",
        startedAt,
        timestampMs,
      );
    }

    if (
      durationMs >=
      config.noFaceWarningAfterMs
    ) {
      return activateWarning(
        "no_face",
        "warning",
        startedAt,
        timestampMs,
      );
    }

    return null;
  }

  function processMultipleFaces(
    timestampMs: number,
  ): FaceWarning | null {
    const startedAt = beginIncident(
      "multiple_faces",
      timestampMs,
    );

    const durationMs =
      timestampMs - startedAt;

    if (
      durationMs >=
      config.multipleFacesPauseAfterMs
    ) {
      return activateWarning(
        "multiple_faces",
        "pause",
        startedAt,
        timestampMs,
      );
    }

    if (
      durationMs >=
      config.multipleFacesWarningAfterMs
    ) {
      return activateWarning(
        "multiple_faces",
        "warning",
        startedAt,
        timestampMs,
      );
    }

    return null;
  }

  function processRecovery(
    timestampMs: number,
  ): FaceWarning | null {
    snapshot.noFaceStartedAtMs = null;
    snapshot.multipleFacesStartedAtMs =
      null;

    if (!snapshot.activeWarning) {
      snapshot.recoveryStartedAtMs =
        null;

      snapshot.pauseRequestedForIncident =
        false;

      return null;
    }

    snapshot.recoveryStartedAtMs ??=
      timestampMs;

    const recoveredForMs =
      timestampMs -
      snapshot.recoveryStartedAtMs;

    if (
      recoveredForMs >=
      config.recoveryDurationMs
    ) {
      clearWarning();

      snapshot.recoveryStartedAtMs =
        null;

      snapshot.pauseRequestedForIncident =
        false;

      return null;
    }

    return snapshot.activeWarning;
  }

  function processMeasurement(
    measurement: FaceMeasurement,
  ): FaceWarning | null {
    const timestampMs =
      measurement.timestampMs;

    switch (measurement.state) {
      case "no_face":
        return processNoFace(timestampMs);

      case "multiple_faces":
        return processMultipleFaces(
          timestampMs,
        );

      case "one_face":
        return processRecovery(timestampMs);

      default:
        snapshot.recoveryStartedAtMs =
          null;

        return snapshot.activeWarning;
    }
  }

  function reset(): void {
    if (snapshot.activeWarning) {
      options.onWarningCleared?.(
        snapshot.activeWarning,
      );
    }

    snapshot =
      createInitialSnapshot();
  }

  return {
    processMeasurement,
    reset,

    getSnapshot: () => ({
      ...snapshot,
      lastWarningAt: {
        ...snapshot.lastWarningAt,
      },
    }),

    getActiveWarning: () =>
      snapshot.activeWarning,
  };
}

export function getFaceWarningLabel(
  state: FacePresenceState,
): string {
  switch (state) {
    case "loading":
      return "Starting visual analysis…";

    case "one_face":
      return "Exactly one face detected";

    case "no_face":
      return "Face not detected";

    case "multiple_faces":
      return "Multiple people detected";

    case "error":
      return "Visual analysis unavailable";

    default:
      return "Camera monitoring inactive";
  }
}
