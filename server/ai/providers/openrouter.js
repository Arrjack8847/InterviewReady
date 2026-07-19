import { createOpenAICompatibleProvider } from "./openai-compatible.js";

export function createOpenRouterProvider({ apiKey, defaultModel, timeoutMs, appUrl, appName }) {
  return createOpenAICompatibleProvider({
    name: "openrouter",
    apiKey,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel,
    timeoutMs,
    extraHeaders: {
      "HTTP-Referer": appUrl,
      "X-Title": appName,
    },
  });
}
