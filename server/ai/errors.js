export const AI_ERROR_CODES = Object.freeze({
  RATE_LIMITED: "RATE_LIMITED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  TIMEOUT: "TIMEOUT",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  INVALID_JSON: "INVALID_JSON",
  NETWORK_ERROR: "NETWORK_ERROR",
  NOT_CONFIGURED: "NOT_CONFIGURED",
  ALL_PROVIDERS_FAILED: "ALL_PROVIDERS_FAILED",
  UNKNOWN: "UNKNOWN",
});

export class AIProviderError extends Error {
  constructor(
    message,
    { code = AI_ERROR_CODES.UNKNOWN, provider, model, status, retryable, cause } = {},
  ) {
    super(message, { cause });
    this.name = "AIProviderError";
    this.code = code;
    this.provider = provider || "unknown";
    this.model = model || "unknown";
    this.status = status;
    this.statusCode = status;
    this.retryable =
      retryable ??
      [AI_ERROR_CODES.RATE_LIMITED, AI_ERROR_CODES.TIMEOUT, AI_ERROR_CODES.NETWORK_ERROR].includes(
        code,
      );
  }
}

export function classifyProviderError({ provider, model, status, message, cause }) {
  const details = String(message || cause?.message || "AI provider request failed.");
  const lower = details.toLowerCase();
  let code = AI_ERROR_CODES.UNKNOWN;

  if (
    cause?.name === "TimeoutError" ||
    cause?.name === "AbortError" ||
    /timed? out|timeout/.test(lower)
  ) {
    code = AI_ERROR_CODES.TIMEOUT;
  } else if (status === 401 || /invalid api key|invalid_api_key|authentication/.test(lower)) {
    code = AI_ERROR_CODES.AUTHENTICATION_FAILED;
  } else if (/quota|billing|insufficient credits|resource_exhausted/.test(lower)) {
    code = AI_ERROR_CODES.QUOTA_EXCEEDED;
  } else if (status === 429 || /rate.?limit|too many requests/.test(lower)) {
    code = AI_ERROR_CODES.RATE_LIMITED;
  } else if (status === 404 || /model.*(not found|unavailable|permission|access)/.test(lower)) {
    code = AI_ERROR_CODES.MODEL_UNAVAILABLE;
  } else if (!status && cause instanceof TypeError) {
    code = AI_ERROR_CODES.NETWORK_ERROR;
  } else if (status && status >= 500) {
    code = AI_ERROR_CODES.NETWORK_ERROR;
  }

  return new AIProviderError(details, { code, provider, model, status, cause });
}

export function asAIProviderError(error, context = {}) {
  if (error instanceof AIProviderError) return error;
  return classifyProviderError({ ...context, message: error?.message, cause: error });
}
