import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer } from "vite";

const vite = await createServer({
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
});
after(() => vite.close());

const warningModule = await vite.ssrLoadModule(
  "/src/features/interview/monitoring/face/faceWarnings.ts",
);
const machineModule = await vite.ssrLoadModule("/src/features/interview/state/interviewMachine.ts");
const capabilityModule = await vite.ssrLoadModule("/src/features/interview/browserCapabilities.ts");
const mediaModule = await vite.ssrLoadModule("/src/features/interview/mediaErrors.ts");
const resilienceModule = await vite.ssrLoadModule("/src/features/interview/resilience.ts");
const answerDraftModule = await vite.ssrLoadModule("/src/features/interview/answerDraft.ts");

const { createFaceWarningController } = warningModule;
const { interviewMachineReducer, initialInterviewMachineState } = machineModule;
const { detectInterviewBrowserCapabilities, getInterviewCapabilityMessages } = capabilityModule;
const { mapInterviewMediaError } = mediaModule;
const { decideSpeechRecovery, retryTransient, shouldAppendSpeechSegment } = resilienceModule;
const { clearInterviewAnswerLocalDraft, readInterviewAnswerDraft, saveInterviewAnswerLocalDraft } =
  answerDraftModule;

const measurement = (state, timestampMs, faceCount = state === "one_face" ? 1 : 0) => ({
  state,
  timestampMs,
  faceCount,
  engagementFrame: { measurable: false },
});

function warningHarness(config = {}) {
  const warnings = [];
  const pauses = [];
  const cleared = [];
  const controller = createFaceWarningController({
    pauseEnabled: true,
    config: {
      noFaceWarningAfterMs: 2_000,
      noFacePauseAfterMs: 5_000,
      multipleFacesWarningAfterMs: 2_000,
      multipleFacesPauseAfterMs: 4_000,
      warningCooldownMs: 12_000,
      recoveryDurationMs: 3_000,
      ...config,
    },
    onWarning: (warning) => warnings.push(warning),
    onPauseRequested: (warning) => pauses.push(warning),
    onWarningCleared: (warning) => cleared.push(warning),
  });
  return { controller, warnings, pauses, cleared };
}

test("no-face warning and pause use independent thresholds", () => {
  const { controller, warnings, pauses } = warningHarness();
  controller.processMeasurement(measurement("no_face", 0));
  controller.processMeasurement(measurement("no_face", 1_999));
  assert.equal(warnings.length, 0);
  controller.processMeasurement(measurement("no_face", 2_000));
  assert.equal(warnings.at(-1).severity, "warning");
  controller.processMeasurement(measurement("no_face", 5_000));
  assert.equal(pauses.length, 1);
  assert.equal(pauses[0].severity, "pause");
});

test("pause enforcement bypasses warning cooldown and fires once per incident", () => {
  const { controller, warnings, pauses } = warningHarness();
  controller.processMeasurement(measurement("no_face", 0));
  controller.processMeasurement(measurement("no_face", 2_000));
  controller.processMeasurement(measurement("no_face", 5_000));
  controller.processMeasurement(measurement("no_face", 5_200));
  controller.processMeasurement(measurement("no_face", 8_000));
  assert.equal(warnings.length, 1, "pause-level display remains cooldown-limited");
  assert.equal(pauses.length, 1, "pause request is incident-locked");
  assert.equal(controller.getSnapshot().pauseRequestedForIncident, true);
});

test("multiple-face warning and pause are stable and incident-locked", () => {
  const { controller, warnings, pauses } = warningHarness();
  controller.processMeasurement(measurement("multiple_faces", 0, 2));
  controller.processMeasurement(measurement("multiple_faces", 1_500, 2));
  assert.equal(warnings.length, 0);
  controller.processMeasurement(measurement("multiple_faces", 2_000, 2));
  controller.processMeasurement(measurement("multiple_faces", 4_000, 2));
  controller.processMeasurement(measurement("multiple_faces", 4_200, 2));
  assert.equal(warnings[0].type, "multiple_faces");
  assert.equal(pauses.length, 1);
});

test("recovery requires one face for three continuous seconds and resets when invalid", () => {
  const { controller, pauses, cleared } = warningHarness();
  controller.processMeasurement(measurement("no_face", 0));
  controller.processMeasurement(measurement("no_face", 5_000));
  assert.equal(pauses.length, 1);
  controller.processMeasurement(measurement("one_face", 5_100, 1));
  controller.processMeasurement(measurement("one_face", 7_999, 1));
  assert.equal(cleared.length, 0);
  controller.processMeasurement(measurement("no_face", 8_000));
  controller.processMeasurement(measurement("one_face", 8_100, 1));
  controller.processMeasurement(measurement("one_face", 11_099, 1));
  assert.equal(cleared.length, 0);
  controller.processMeasurement(measurement("one_face", 11_100, 1));
  assert.equal(cleared.length, 1);
  assert.equal(controller.getSnapshot().pauseRequestedForIncident, false);
});

test("unavailable face measurement interrupts recovery", () => {
  const { controller, cleared } = warningHarness();
  controller.processMeasurement(measurement("no_face", 0));
  controller.processMeasurement(measurement("no_face", 5_000));
  controller.processMeasurement(measurement("one_face", 5_100, 1));
  controller.processMeasurement(measurement("error", 6_000));
  controller.processMeasurement(measurement("one_face", 6_100, 1));
  controller.processMeasurement(measurement("one_face", 9_099, 1));
  assert.equal(cleared.length, 0);
  controller.processMeasurement(measurement("one_face", 9_100, 1));
  assert.equal(cleared.length, 1);
});

test("invalid reducer transitions are ignored and paused answers require stable recovery", () => {
  let state = interviewMachineReducer(initialInterviewMachineState, { type: "ANSWER_STARTED" });
  assert.equal(state.phase, "preparing");
  state = interviewMachineReducer(state, { type: "PREPARATION_COMPLETED" });
  state = interviewMachineReducer(state, { type: "ANSWER_STARTED" });
  state = interviewMachineReducer(state, {
    type: "INTERVIEW_PAUSED",
    reason: "No face",
    source: "automatic",
    warningType: "no_face",
  });
  assert.equal(state.phase, "paused");
  assert.equal(interviewMachineReducer(state, { type: "ANSWER_RESUMED" }).phase, "paused");
  state = interviewMachineReducer(state, { type: "RECOVERY_STARTED" });
  state = interviewMachineReducer(state, { type: "RECOVERY_COMPLETED" });
  state = interviewMachineReducer(state, { type: "ANSWER_RESUMED" });
  assert.equal(state.phase, "answering");
});

test("manual pauses do not auto-recover and lower-priority warnings cannot replace integrity warnings", () => {
  let state = interviewMachineReducer(initialInterviewMachineState, {
    type: "PREPARATION_COMPLETED",
  });
  state = interviewMachineReducer(state, { type: "ANSWER_STARTED" });
  state = interviewMachineReducer(state, {
    type: "PAUSE_COUNTDOWN_STARTED",
    warningType: "multiple_faces",
  });
  const unchanged = interviewMachineReducer(state, {
    type: "MONITOR_WARNING",
    warningType: "posture",
  });
  assert.equal(unchanged.warningType, "multiple_faces");

  state = interviewMachineReducer(state, {
    type: "INTERVIEW_PAUSED",
    reason: "Paused by the candidate",
    source: "manual",
  });
  assert.equal(interviewMachineReducer(state, { type: "RECOVERY_STARTED" }).phase, "paused");
});

test("browser capabilities are SSR-safe and mode messages degrade independently", () => {
  const none = detectInterviewBrowserCapabilities({ window: {}, navigator: {}, document: {} });
  assert.equal(none.cameraCapture, false);
  assert.equal(none.mediaPipeRuntime, false);
  assert.equal(getInterviewCapabilityMessages("Text", none).length, 0);
  const videoMessages = getInterviewCapabilityMessages("Video", none);
  assert.ok(videoMessages.some((message) => message.level === "blocking"));
  assert.ok(videoMessages.some((message) => message.code === "SPEECH_RECOGNITION_UNSUPPORTED"));
});

test("camera and microphone errors map to stable friendly codes", () => {
  assert.equal(
    mapInterviewMediaError("camera", { name: "NotAllowedError" }).code,
    "CAMERA_PERMISSION_DENIED",
  );
  assert.equal(
    mapInterviewMediaError("microphone", { name: "NotReadableError" }).code,
    "MIC_IN_USE",
  );
  assert.doesNotMatch(
    mapInterviewMediaError("camera", new Error("secret raw browser detail")).message,
    /secret raw browser detail/,
  );
});

test("speech recovery is capped and duplicate replay segments are suppressed", () => {
  assert.equal(
    decideSpeechRecovery({
      error: "network",
      shouldListen: true,
      pageVisible: true,
      retryCount: 0,
    }).restart,
    true,
  );
  assert.equal(
    decideSpeechRecovery({
      error: "network",
      shouldListen: true,
      pageVisible: true,
      retryCount: 3,
    }).restart,
    false,
  );
  assert.equal(
    decideSpeechRecovery({
      shouldListen: true,
      pageVisible: false,
      retryCount: 0,
    }).restart,
    false,
  );
  assert.equal(
    shouldAppendSpeechSegment({
      segment: "same result",
      previousSegment: "Same result",
      previousAtMs: 1_000,
      nowMs: 2_000,
    }),
    false,
  );
});

test("persistence retry is bounded and skips non-transient errors", async () => {
  let attempts = 0;
  const result = await retryTransient(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("network request failed");
      return "saved";
    },
    { sleep: async () => undefined },
  );
  assert.equal(result, "saved");
  assert.equal(attempts, 3);
  attempts = 0;
  await assert.rejects(
    retryTransient(
      async () => {
        attempts += 1;
        throw new Error("validation failed");
      },
      { sleep: async () => undefined },
    ),
  );
  assert.equal(attempts, 1);
});

test("failed persistence retains a complete local draft and confirmed persistence clears it", () => {
  const values = new Map();
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const localStorageMock = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = {
    localStorage: localStorageMock,
  };
  globalThis.localStorage = localStorageMock;
  try {
    saveInterviewAnswerLocalDraft("session-1", 2, "Preserved answer", {
      finalizedTranscript: "Preserved transcript",
      mode: "video",
      submittedAt: "2026-07-18T00:00:00.000Z",
      persistenceStatus: "failed",
      metrics: {
        metricsVersion: "interview-metrics-v3",
        scoringVersion: "interview-score-v3",
        measurementStatus: {
          answerQuality: "measured",
          speechDelivery: "not_measurable",
          audioQuality: "not_measurable",
          visualPresentation: "not_measurable",
        },
        raw: { pausedDurationMs: 3_000 },
        normalized: { answerQuality: 80, overall: 80 },
        contributions: [],
      },
    });
    const retained = readInterviewAnswerDraft("session-1", 2);
    assert.equal(retained.persistenceStatus, "failed");
    assert.equal(retained.answer, "Preserved answer");
    assert.equal(retained.metrics.raw.pausedDurationMs, 3_000);
    assert.equal(readInterviewAnswerDraft("different-session", 2), null);

    clearInterviewAnswerLocalDraft("session-1", 2);
    assert.equal(readInterviewAnswerDraft("session-1", 2), null);
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});
