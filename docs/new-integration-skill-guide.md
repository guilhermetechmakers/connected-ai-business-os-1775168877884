# New Integration Skill Guide

Use this guide to create any new third-party integration in this codebase with the same standards used for Gmail, Google Drive, Google Calendar, HubSpot, QuickBooks, and Slack.

This document is written to be copied into a Cursor Skill (`SKILL.md`) or used as a runbook for manual implementation.

## Goal

Ship a production-safe integration that:

- exposes provider actions and queries through `toolsExecute`,
- is enforceable via role-based constraints,
- is performant (bounded calls, retries, caps),
- is auditable (structured logs + action traces),
- is test-covered before release.

## Where to Implement

- Runtime + tool catalog: `supabase/functions/_shared/integrations-runtime.ts`
- AI routing + tool use orchestration: `supabase/functions/ai-api/index.ts`
- Intent routing prompt/schema: `supabase/functions/intent-agent/index.ts` and `supabase/functions/_shared/intent-plan.ts`
- Integration API surface: `supabase/functions/integrations-api/index.ts`
- Client types (if needed): `src/types/integrations.ts`
- Tests: `supabase/functions/_shared/*.test.ts`
- Capability docs: `docs/integrations-parity-matrix.md`

## Required Workflow (Always Follow)

### 1) Provider Documentation Pass

- Read official provider docs for:
  - OAuth scopes,
  - read/list/search endpoints,
  - write/update/delete endpoints,
  - rate limits and pagination,
  - idempotency semantics.
- Build a mini matrix:
  - endpoint -> `toolId`,
  - required args,
  - risk tier,
  - role group,
  - confirmation behavior.

### 2) Define Tool IDs (Stable Naming)

Use: `provider.resource.action`

Examples:

- `notion.pages.search`
- `notion.pages.create`
- `notion.pages.update`

Rules:

- keep lowercase with underscores only when needed,
- avoid renaming existing IDs (backward compatibility),
- keep one ID per atomic action.

### 3) Expand Runtime Catalog

In `integrations-runtime.ts`:

- add tools to `TOOL_DEFINITIONS`,
- set:
  - `accessLevel` (`read`/`write`),
  - `riskTier` (`low`/`medium`/`high`/`critical`),
  - `roleGroup` (existing group or new one),
  - `requiresConfirmation` default,
  - `argsShape`.

Then implement execution paths in `providerToolExecute` for each new tool.

### 4) Add RBAC + Constraints

Use role-group enforcement in runtime:

- `canExecuteRoleGroup(...)`,
- per-tool required roles via `roleGroup`.

Add hard constraints:

- pagination caps (`limit`, `pageSize`, `maxResults`),
- max payload sizes,
- required field checks,
- provider-specific safety checks (e.g., immutable fields, admin-only operations).

### 5) Add OAuth Scopes and Credential Logic

- update `getOAuthConfig(...)` scopes,
- ensure token refresh path works,
- ensure missing-scope errors return actionable reconnect guidance,
- avoid client-side secrets.

### 6) Wire AI Routing

In `ai-api/index.ts`:

- route new provider actions in `query_integration`,
- map operation intent (`list/create/update/delete`) to exact `toolId`,
- for writes:
  - return pending confirmation when mode requires,
  - execute via `toolsExecute` only (no stub success paths).

In `intent-agent/index.ts`:

- add concise instruction lines so planner can choose new tool IDs correctly,
- do not allow invented tool IDs.

### 7) Observability and Audit

Ensure each tool execution logs:

- provider,
- toolId,
- risk tier,
- role group,
- execution latency,
- argument preview (safe/redacted),
- result preview (safe/redacted),
- status (`completed`, `pending_confirmation`, `failed`).

### 8) Testing Requirements

Add tests for:

- presence of new tool IDs in catalog,
- role-group enforcement,
- arg constraints/validation,
- critical provider-specific validators.

Minimum commands:

- `deno check supabase/functions/_shared/integrations-runtime.ts`
- `deno check supabase/functions/ai-api/index.ts`
- `deno check supabase/functions/intent-agent/index.ts`
- `deno test "supabase/functions/_shared/*.test.ts"`

## Integration Template (Copy/Paste Checklist)

Use this checklist for each new integration:

```md
[ ] Provider docs reviewed (official)
[ ] Endpoint -> toolId matrix defined
[ ] OAuth scopes added and validated
[ ] TOOL_DEFINITIONS updated with riskTier/roleGroup
[ ] providerToolExecute implemented for all tools
[ ] Args constrained + validated
[ ] toolsList visibility confirms RBAC behavior
[ ] AI query_integration routing added
[ ] intent-agent guidance updated
[ ] Structured audit logs include risk/latency metadata
[ ] Unit tests added for policy + args
[ ] deno check/test pass
[ ] parity matrix doc updated
```

## Role Group Guidance

Prefer existing role groups when possible:

- `reader_plus`
- `ops_plus`
- `integration_admin_plus`
- `comms_plus` / `comms_admin_plus`
- `sales_ops_plus` / `sales_admin_plus`
- `finance_read_plus` / `finance_ops_plus` / `finance_admin_plus`

If adding a new role group:

- keep it narrow and business-domain specific,
- document which roles map to it,
- add tests for allow/deny behavior.

## Performance Guardrails (Do Not Skip)

- Always cap list/search limits.
- Never allow unbounded loops over provider pages.
- Use retry + backoff for 429/5xx.
- Keep response payloads truncated/summarized before returning to AI.
- Avoid N+1 provider calls when batch endpoints exist.

## Release Gate

Only ship when all are true:

- tool execution works in runtime (not just AI),
- role enforcement is tested,
- lint/type/test checks pass,
- observability fields are present,
- parity matrix updated.

## Suggested Skill Description (for `SKILL.md`)

Use this in a future Cursor skill frontmatter:

`description: Build new third-party integrations in this repo using Supabase Edge Functions, runtime tool catalog, AI routing, RBAC constraints, OAuth scope hygiene, and performance guardrails. Use when adding any provider/tool action/query.`

