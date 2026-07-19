export const PERSISTENCE_MAX_ATTEMPTS = 3;

export function isTransientPersistenceError(error: unknown) {
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    name === "aborterror" ||
    /network|fetch|timeout|timed out|connection|temporar|502|503|504/.test(message)
  );
}

export async function retryTransient<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    sleep?: (delayMs: number) => Promise<void>;
  } = {},
) {
  const maxAttempts = Math.max(1, options.maxAttempts ?? PERSISTENCE_MAX_ATTEMPTS);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const sleep =
    options.sleep ??
    ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientPersistenceError(error)) throw error;
      await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), 1_500));
    }
  }
  throw lastError;
}

export type SpeechRecoveryDecision = { restart: boolean; delayMs: number; terminal: boolean };

export function decideSpeechRecovery({
  error,
  shouldListen,
  pageVisible,
  retryCount,
  maxRetries = 3,
}: {
  error?: string | null;
  shouldListen: boolean;
  pageVisible: boolean;
  retryCount: number;
  maxRetries?: number;
}): SpeechRecoveryDecision {
  if (!shouldListen || !pageVisible) return { restart: false, delayMs: 0, terminal: false };
  if (["not-allowed", "service-not-allowed", "audio-capture"].includes(error || "")) {
    return { restart: false, delayMs: 0, terminal: true };
  }
  const retryable = !error || ["network", "no-speech", "aborted"].includes(error);
  if (!retryable || retryCount >= maxRetries) {
    return { restart: false, delayMs: 0, terminal: true };
  }
  return {
    restart: true,
    delayMs: Math.min(250 * 2 ** retryCount, 1_500),
    terminal: false,
  };
}

export function shouldAppendSpeechSegment({
  segment,
  previousSegment,
  previousAtMs,
  nowMs,
}: {
  segment: string;
  previousSegment: string;
  previousAtMs: number;
  nowMs: number;
}) {
  const normalized = segment.trim().replace(/\s+/g, " ").toLowerCase();
  const previous = previousSegment.trim().replace(/\s+/g, " ").toLowerCase();
  return Boolean(normalized && (normalized !== previous || nowMs - previousAtMs > 2_000));
}
