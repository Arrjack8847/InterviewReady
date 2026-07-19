import { AI_ERROR_CODES, AIProviderError } from "./errors.js";

export function cleanJsonText(text) {
  const raw = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw;
}

export function parseJsonResponse(text, { provider, model } = {}) {
  try {
    return JSON.parse(cleanJsonText(text));
  } catch (cause) {
    throw new AIProviderError(`${provider || "AI provider"} returned invalid JSON.`, {
      code: AI_ERROR_CODES.INVALID_JSON,
      provider,
      model,
      cause,
    });
  }
}
