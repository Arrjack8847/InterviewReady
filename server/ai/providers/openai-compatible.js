import { AI_ERROR_CODES, AIProviderError, classifyProviderError } from "../errors.js";
import { parseJsonResponse } from "../json.js";

export function createOpenAICompatibleProvider({
  name,
  apiKey,
  endpoint,
  defaultModel,
  extraHeaders = {},
  timeoutMs = 30_000,
}) {
  const cleanKey = String(apiKey || "").trim();

  return {
    name,
    isConfigured: Boolean(cleanKey && defaultModel),
    defaultModel,
    async generateJson({
      prompt,
      systemPrompt,
      model = defaultModel,
      maxTokens,
      temperature,
      jsonMode,
    }) {
      if (!cleanKey || !model) {
        throw new AIProviderError(`${name} is not configured.`, {
          code: AI_ERROR_CODES.NOT_CONFIGURED,
          provider: name,
          model,
        });
      }

      const body = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      };
      if (jsonMode) body.response_format = { type: "json_object" };

      let response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            "Content-Type": "application/json",
            ...extraHeaders,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        throw classifyProviderError({ provider: name, model, cause });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw classifyProviderError({
          provider: name,
          model,
          status: response.status,
          message:
            payload?.error?.message || `${name} request failed with HTTP ${response.status}.`,
        });
      }

      const text = payload?.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text.trim()) {
        throw new AIProviderError(`${name} returned an empty response.`, {
          code: AI_ERROR_CODES.INVALID_RESPONSE,
          provider: name,
          model,
        });
      }

      const promptTokens = Number.isFinite(Number(payload?.usage?.prompt_tokens))
        ? Number(payload.usage.prompt_tokens)
        : null;
      const completionTokens = Number.isFinite(Number(payload?.usage?.completion_tokens))
        ? Number(payload.usage.completion_tokens)
        : null;
      const reportedTotal = Number(payload?.usage?.total_tokens);
      return {
        data: parseJsonResponse(text, { provider: name, model }),
        model: payload.model || model,
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
