export const DEFAULT_MODEL_LOAD_TIMEOUT_MS = 15_000;

export class ModelLoadTimeoutError extends Error {
  constructor(modelName: string, timeoutMs: number) {
    super(`${modelName} did not load within ${Math.round(timeoutMs / 1_000)} seconds.`);
    this.name = "ModelLoadTimeoutError";
  }
}

export function getModelLoadTimeoutMs() {
  const configured = Number(import.meta.env.VITE_MEDIAPIPE_MODEL_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 5_000 && configured <= 60_000
    ? configured
    : DEFAULT_MODEL_LOAD_TIMEOUT_MS;
}

export async function loadModelWithTimeout<T extends { close?: () => void }>(
  modelName: string,
  factory: () => Promise<T>,
  timeoutMs = getModelLoadTimeoutMs(),
) {
  let timedOut = false;
  const pending = factory();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new ModelLoadTimeoutError(modelName, timeoutMs));
    }, timeoutMs);
  });
  void pending
    .then((instance) => {
      if (timedOut) instance.close?.();
    })
    .catch(() => undefined);
  try {
    return await Promise.race([pending, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function isGpuDelegateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /gpu|webgl|delegate|context/i.test(message);
}
