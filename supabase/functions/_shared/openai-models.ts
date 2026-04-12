const DEFAULT_MODEL = "gpt-5.4";
const FAST_MODEL = "gpt-5.4-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

export type OpenAiModelTier = "default" | "fast";

export function getOpenAiDefaultModel(): string {
  const configured = Deno.env.get("OPENAI_MODEL_DEFAULT")?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_MODEL;
}

export function getOpenAiFastModel(): string {
  const configured = Deno.env.get("OPENAI_MODEL_FAST")?.trim();
  return configured && configured.length > 0 ? configured : FAST_MODEL;
}

export function resolveOpenAiModel(override: string | null | undefined, tier: OpenAiModelTier = "default"): string {
  if (typeof override === "string" && override.trim().length > 0) {
    return override.trim();
  }
  return tier === "fast" ? getOpenAiFastModel() : getOpenAiDefaultModel();
}

export function getOpenAiEmbeddingModel(): string {
  const configured = Deno.env.get("OPENAI_EMBEDDING_MODEL")?.trim();
  return configured && configured.length > 0 ? configured : EMBEDDING_MODEL;
}

export function isResponsesApiEnabled(): boolean {
  const raw = (Deno.env.get("OPENAI_USE_RESPONSES") ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function isToolSearchEnabled(): boolean {
  const raw = (Deno.env.get("OPENAI_USE_TOOL_SEARCH") ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}
