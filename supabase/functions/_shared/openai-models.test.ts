import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  getOpenAiDefaultModel,
  getOpenAiFastModel,
  getOpenAiEmbeddingModel,
  isResponsesApiEnabled,
  isToolSearchEnabled,
  resolveOpenAiModel,
} from "./openai-models.ts";

const ENV_KEYS = [
  "OPENAI_MODEL_DEFAULT",
  "OPENAI_MODEL_FAST",
  "OPENAI_EMBEDDING_MODEL",
  "OPENAI_USE_RESPONSES",
  "OPENAI_USE_TOOL_SEARCH",
] as const;

function withCleanEnv(fn: () => void): void {
  const snapshot = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) snapshot.set(key, Deno.env.get(key));
  try {
    for (const key of ENV_KEYS) Deno.env.delete(key);
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = snapshot.get(key);
      if (typeof value === "string") Deno.env.set(key, value);
      else Deno.env.delete(key);
    }
  }
}

Deno.test("openai model defaults resolve to GPT-5.4 family", () => {
  withCleanEnv(() => {
    assertEquals(getOpenAiDefaultModel(), "gpt-5.4");
    assertEquals(getOpenAiFastModel(), "gpt-5.4-mini");
    assertEquals(getOpenAiEmbeddingModel(), "text-embedding-3-small");
  });
});

Deno.test("openai model env overrides are respected", () => {
  withCleanEnv(() => {
    Deno.env.set("OPENAI_MODEL_DEFAULT", "gpt-5.4-pro");
    Deno.env.set("OPENAI_MODEL_FAST", "gpt-5.4-nano");
    Deno.env.set("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large");
    assertEquals(getOpenAiDefaultModel(), "gpt-5.4-pro");
    assertEquals(getOpenAiFastModel(), "gpt-5.4-nano");
    assertEquals(getOpenAiEmbeddingModel(), "text-embedding-3-large");
    assertEquals(resolveOpenAiModel(undefined, "default"), "gpt-5.4-pro");
    assertEquals(resolveOpenAiModel(null, "fast"), "gpt-5.4-nano");
    assertEquals(resolveOpenAiModel("gpt-5.4", "fast"), "gpt-5.4");
  });
});

Deno.test("responses and tool search flags default on and accept explicit off", () => {
  withCleanEnv(() => {
    assertEquals(isResponsesApiEnabled(), true);
    assertEquals(isToolSearchEnabled(), true);
    Deno.env.set("OPENAI_USE_RESPONSES", "false");
    Deno.env.set("OPENAI_USE_TOOL_SEARCH", "off");
    assertEquals(isResponsesApiEnabled(), false);
    assertEquals(isToolSearchEnabled(), false);
  });
});
