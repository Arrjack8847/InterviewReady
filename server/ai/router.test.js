import test from "node:test";
import assert from "node:assert/strict";
import { AI_ERROR_CODES, AIProviderError } from "./errors.js";
import { createAiRouter } from "./router.js";

function provider(name, outcomes = []) {
  const calls = [];
  return {
    name,
    isConfigured: true,
    calls,
    async generateJson(input) {
      calls.push(input);
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return (
        outcome || {
          data: { ok: true },
          model: input.model,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        }
      );
    },
  };
}

function error(code, providerName) {
  return new AIProviderError(code, { code, provider: providerName });
}

function routerWith({ groq, gemini, openrouter }) {
  return createAiRouter({
    providers: { groq, gemini, openrouter },
    models: {
      groq: { primary: "groq-fast", fallback: "groq-scout" },
      gemini: { primary: "gemini-flash" },
      openrouter: { primary: "openrouter-model" },
    },
    defaults: { maxTokens: 100, temperature: 0, jsonMode: true },
  });
}

test("Gemini timeout falls back to Groq Scout for answer analysis", async () => {
  const gemini = provider("gemini", [error(AI_ERROR_CODES.TIMEOUT, "gemini")]);
  const groq = provider("groq");
  const result = await routerWith({ gemini, groq, openrouter: provider("openrouter") }).callJson({
    taskName: "answer_analysis",
    prompt: "test",
    systemPrompt: "json",
  });
  assert.equal(result.provider, "groq");
  assert.equal(result.model, "groq-scout");
  assert.equal(result.fallbackUsed, true);
});

test("Gemini rate limit falls back to Groq Scout", async () => {
  const gemini = provider("gemini", [error(AI_ERROR_CODES.RATE_LIMITED, "gemini")]);
  const result = await routerWith({
    gemini,
    groq: provider("groq"),
    openrouter: provider("openrouter"),
  }).callJson({ taskName: "answer_analysis", prompt: "test", systemPrompt: "json" });
  assert.equal(result.provider, "groq");
});

test("question generation reaches OpenRouter after Groq and Gemini failures", async () => {
  const groq = provider("groq", [
    error(AI_ERROR_CODES.NETWORK_ERROR, "groq"),
    error(AI_ERROR_CODES.MODEL_UNAVAILABLE, "groq"),
  ]);
  const gemini = provider("gemini", [error(AI_ERROR_CODES.QUOTA_EXCEEDED, "gemini")]);
  const result = await routerWith({ groq, gemini, openrouter: provider("openrouter") }).callJson({
    taskName: "question_generation",
    prompt: "test",
    systemPrompt: "json",
  });
  assert.equal(result.provider, "openrouter");
});

test("final report falls back from OpenRouter to Gemini and then Groq", async () => {
  const openrouter = provider("openrouter", [error(AI_ERROR_CODES.NETWORK_ERROR, "openrouter")]);
  const gemini = provider("gemini", [error(AI_ERROR_CODES.TIMEOUT, "gemini")]);
  const result = await routerWith({ openrouter, gemini, groq: provider("groq") }).callJson({
    taskName: "final_report_generation",
    prompt: "test",
    systemPrompt: "json",
  });
  assert.equal(result.provider, "groq");
  assert.equal(result.model, "groq-scout");
});

test("invalid JSON gets one repair attempt before falling back", async () => {
  const gemini = provider("gemini", [
    error(AI_ERROR_CODES.INVALID_JSON, "gemini"),
    error(AI_ERROR_CODES.INVALID_JSON, "gemini"),
  ]);
  const result = await routerWith({
    gemini,
    groq: provider("groq"),
    openrouter: provider("openrouter"),
  }).callJson({ taskName: "answer_analysis", prompt: "test", systemPrompt: "json" });
  assert.equal(gemini.calls.length, 2);
  assert.equal(result.provider, "groq");
});

test("authentication failure skips other models for the same provider", async () => {
  const groq = provider("groq", [error(AI_ERROR_CODES.AUTHENTICATION_FAILED, "groq")]);
  const result = await routerWith({
    groq,
    gemini: provider("gemini"),
    openrouter: provider("openrouter"),
  }).callJson({ taskName: "resume_analysis", prompt: "test", systemPrompt: "json" });
  assert.equal(groq.calls.length, 1);
  assert.equal(result.provider, "gemini");
});

test("all provider failures produce one typed aggregate error", async () => {
  const failing = (name) => provider(name, [error(AI_ERROR_CODES.QUOTA_EXCEEDED, name)]);
  await assert.rejects(
    routerWith({
      groq: failing("groq"),
      gemini: failing("gemini"),
      openrouter: failing("openrouter"),
    }).callJson({
      taskName: "final_report_generation",
      prompt: "test",
      systemPrompt: "json",
    }),
    (caught) =>
      caught instanceof AIProviderError && caught.code === AI_ERROR_CODES.ALL_PROVIDERS_FAILED,
  );
});
