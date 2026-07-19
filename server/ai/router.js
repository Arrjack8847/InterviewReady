import { randomUUID } from "node:crypto";
import { AI_ERROR_CODES, AIProviderError, asAIProviderError } from "./errors.js";

export const TASK_CHAINS = Object.freeze({
  resume_analysis: ["groq:primary", "groq:fallback", "gemini:primary"],
  company_research_synthesis: ["groq:primary", "gemini:primary", "openrouter:primary"],
  company_recommendation: ["groq:primary", "gemini:primary", "openrouter:primary"],
  question_generation: ["groq:primary", "groq:fallback", "gemini:primary", "openrouter:primary"],
  answer_analysis: ["gemini:primary", "groq:fallback", "openrouter:primary"],
  answer_review: ["groq:fallback", "gemini:primary"],
  final_report_generation: ["openrouter:primary", "gemini:primary", "groq:fallback"],
});

const TERMINAL_PROVIDER_ERRORS = new Set([
  AI_ERROR_CODES.AUTHENTICATION_FAILED,
  AI_ERROR_CODES.QUOTA_EXCEEDED,
]);

export function createAiRouter({ providers, models, defaults = {} }) {
  const resolveAttempt = (entry) => {
    const [providerName, modelName] = entry.split(":");
    const provider = providers[providerName];
    return { providerName, provider, model: models?.[providerName]?.[modelName] };
  };

  const getChain = (taskName) => TASK_CHAINS[taskName] || TASK_CHAINS.question_generation;
  const configuredAttempts = (taskName) =>
    getChain(taskName)
      .map(resolveAttempt)
      .filter(({ provider, model }) => provider?.isConfigured && model);

  return {
    hasConfiguredProvider(taskName) {
      return configuredAttempts(taskName).length > 0;
    },
    getPreferredConfig(taskName) {
      const attempt = configuredAttempts(taskName)[0];
      return attempt
        ? { provider: attempt.providerName, model: attempt.model }
        : { provider: "local", model: "local-fallback" };
    },
    async callJson({
      taskName,
      prompt,
      systemPrompt,
      maxTokens,
      temperature,
      jsonMode,
      context,
      excludeProviders = [],
    }) {
      const callId = randomUUID().slice(0, 8);
      const excluded = new Set(excludeProviders);
      const attempts = configuredAttempts(taskName).filter(
        ({ providerName }) => !excluded.has(providerName),
      );
      const failures = [];
      const disabledProviders = new Set();

      if (attempts.length === 0) {
        throw new AIProviderError(`No AI provider is configured for ${taskName}.`, {
          code: AI_ERROR_CODES.NOT_CONFIGURED,
        });
      }

      for (const [index, attempt] of attempts.entries()) {
        if (disabledProviders.has(attempt.providerName)) continue;
        const startedAt = Date.now();
        let repairedInvalidJson = false;

        while (true) {
          try {
            const result = await attempt.provider.generateJson({
              prompt,
              systemPrompt: repairedInvalidJson
                ? `${systemPrompt}\nYour previous response was malformed. Return one complete valid JSON object only.`
                : systemPrompt,
              model: attempt.model,
              maxTokens: maxTokens || defaults.maxTokens,
              temperature: temperature ?? defaults.temperature,
              jsonMode: jsonMode ?? defaults.jsonMode,
            });
            return {
              ...result,
              task: taskName,
              callId,
              provider: attempt.providerName,
              model: result.model || attempt.model,
              latencyMs: Date.now() - startedAt,
              fallbackUsed: index > 0,
              attemptedProviders: [
                ...failures.map((failure) => failure.provider),
                attempt.providerName,
              ],
              context,
            };
          } catch (error) {
            const failure = asAIProviderError(error, {
              provider: attempt.providerName,
              model: attempt.model,
            });

            if (failure.code === AI_ERROR_CODES.INVALID_JSON && !repairedInvalidJson) {
              repairedInvalidJson = true;
              console.warn("AI provider returned invalid JSON; attempting one repair:", {
                task: taskName,
                callId,
                provider: attempt.providerName,
                model: attempt.model,
              });
              continue;
            }

            failures.push(failure);
            if (TERMINAL_PROVIDER_ERRORS.has(failure.code)) {
              disabledProviders.add(attempt.providerName);
            }
            console.warn("AI provider attempt failed:", {
              task: taskName,
              callId,
              provider: attempt.providerName,
              model: attempt.model,
              code: failure.code,
              status: failure.status,
              success: false,
              errorType: failure.code,
              evaluationVersion: taskName.startsWith("answer_") ? "humane-v2" : null,
              ...context,
            });
            break;
          }
        }
      }

      throw new AIProviderError(`All configured AI providers failed for ${taskName}.`, {
        code: AI_ERROR_CODES.ALL_PROVIDERS_FAILED,
        cause: failures.at(-1),
      });
    },
  };
}
