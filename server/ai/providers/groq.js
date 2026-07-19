import { createOpenAICompatibleProvider } from "./openai-compatible.js";

export function createGroqProvider({ apiKey, defaultModel, timeoutMs }) {
  return createOpenAICompatibleProvider({
    name: "groq",
    apiKey,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel,
    timeoutMs,
  });
}
