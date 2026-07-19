import { GoogleGenAI } from "@google/genai";
import { AI_ERROR_CODES, AIProviderError, classifyProviderError } from "../errors.js";
import { parseJsonResponse } from "../json.js";

export function createGeminiProvider({ apiKey, defaultModel, timeoutMs = 30_000 }) {
  const cleanKey = String(apiKey || "").trim();
  const client = cleanKey ? new GoogleGenAI({ apiKey: cleanKey }) : null;

  return {
    name: "gemini",
    isConfigured: Boolean(client && defaultModel),
    defaultModel,
    async generateJson({ prompt, systemPrompt, model = defaultModel, maxTokens, temperature }) {
      if (!client || !model) {
        throw new AIProviderError("Gemini is not configured.", {
          code: AI_ERROR_CODES.NOT_CONFIGURED,
          provider: "gemini",
          model,
        });
      }

      let response;
      try {
        response = await Promise.race([
          client.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: systemPrompt,
              temperature,
              maxOutputTokens: maxTokens,
              responseMimeType: "application/json",
            },
          }),
          new Promise((_, reject) => {
            const error = new Error(`Gemini request timed out after ${timeoutMs}ms.`);
            error.name = "TimeoutError";
            setTimeout(() => reject(error), timeoutMs).unref?.();
          }),
        ]);
      } catch (cause) {
        throw classifyProviderError({
          provider: "gemini",
          model,
          status: cause?.status || cause?.statusCode,
          cause,
        });
      }

      const text = response?.text;
      if (typeof text !== "string" || !text.trim()) {
        throw new AIProviderError("Gemini returned an empty response.", {
          code: AI_ERROR_CODES.INVALID_RESPONSE,
          provider: "gemini",
          model,
        });
      }

      const usage = response.usageMetadata || {};
      const promptTokens = Number.isFinite(Number(usage.promptTokenCount))
        ? Number(usage.promptTokenCount)
        : null;
      const completionTokens = Number.isFinite(Number(usage.candidatesTokenCount))
        ? Number(usage.candidatesTokenCount)
        : null;
      const reportedTotal = Number(usage.totalTokenCount);
      return {
        data: parseJsonResponse(text, { provider: "gemini", model }),
        model: response.modelVersion || model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: Number.isFinite(reportedTotal)
            ? reportedTotal
            : promptTokens !== null && completionTokens !== null
              ? promptTokens + completionTokens
              : null,
        },
      };
    },
  };
}
