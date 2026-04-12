# GPT-5.4 and Tool Search Rollout

## Environment flags
- `OPENAI_MODEL_DEFAULT` (default `gpt-5.4`)
- `OPENAI_MODEL_FAST` (default `gpt-5.4-mini`)
- `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
- `OPENAI_USE_RESPONSES` (default `true`)
- `OPENAI_USE_TOOL_SEARCH` (default `true`)
- `OPENAI_REASONING_EFFORT` (default `none`)
- `OPENAI_TEXT_VERBOSITY` (default `low`)

## What changed
- All Edge Function chat model defaults were migrated from GPT-4o variants to GPT-5.4 family via shared model helpers.
- `ai-api` now uses the OpenAI Responses API by default and maps response output/tool calls into the existing tool loop shape.
- `ai-api` enables hosted `tool_search` with deferred loading for non-core function tools to reduce initial tool-schema token load.
- `search_knowledge_base` now applies user query text to document retrieval instead of scanning only by source.

## Validation checklist
- Run unit tests:
  - `deno test "supabase/functions/_shared/openai-models.test.ts" --allow-env`
- Smoke test Edge Functions in staging:
  - `stream.chat` with connector tool calls
  - `dashboard.insights`
  - `dashboard.executiveBrief`
  - `complete.chat`
  - `intent-agent` routing output

## Rollout sequence
1. Deploy with `OPENAI_USE_RESPONSES=true` and `OPENAI_USE_TOOL_SEARCH=false`.
2. Verify latency, token usage, and tool-call success rates.
3. Enable `OPENAI_USE_TOOL_SEARCH=true`.
4. Compare p95 latency, prompt tokens, completion tokens, and tool-iteration counts against baseline.
5. Roll back quickly by toggling either feature flag to `false`.
