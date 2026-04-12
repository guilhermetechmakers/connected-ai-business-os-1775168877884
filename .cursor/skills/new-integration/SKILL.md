---
name: new-integration
description: Build new third-party integrations in this repository using Supabase Edge Functions, runtime tool catalog, AI routing, RBAC constraints, OAuth scope hygiene, and performance guardrails. Use when adding any provider integration, provider tool action, or provider query.
---

# New Integration

Use this skill when implementing a new third-party integration (or expanding an existing provider) in this repository.

## Where To Change Code

- Runtime catalog and execution: `supabase/functions/_shared/integrations-runtime.ts`
- AI orchestration: `supabase/functions/ai-api/index.ts`
- Intent planning and routing guidance: `supabase/functions/intent-agent/index.ts` and `supabase/functions/_shared/intent-plan.ts`
- Integration API surface: `supabase/functions/integrations-api/index.ts`
- Client types (if needed): `src/types/integrations.ts`
- Tests: `supabase/functions/_shared/*.test.ts`
- Capability docs: `docs/integrations-parity-matrix.md`

## Required Workflow

1. **Provider documentation pass**
   - Read official docs for scopes, read/write endpoints, pagination, limits, retries, and idempotency.
   - Create endpoint-to-tool mapping before coding.

2. **Define stable tool IDs**
   - Format: `provider.resource.action` (example: `notion.pages.search`).
   - Keep IDs backward compatible; one ID per atomic action.

3. **Expand runtime catalog**
   - Add each tool to `TOOL_DEFINITIONS`.
   - Set `accessLevel`, `riskTier`, `roleGroup`, `requiresConfirmation`, and `argsShape`.
   - Implement each tool path in provider execution code.

4. **Add RBAC and hard constraints**
   - Enforce role-group checks.
   - Add caps for list/search pagination and payload sizes.
   - Add required-field validation and provider-specific safety checks.

5. **Wire OAuth and credentials**
   - Add/update scopes in OAuth config.
   - Ensure refresh logic works.
   - Return actionable reconnect guidance for missing scopes.

6. **Wire AI routing**
   - Map operation intents to exact tool IDs.
   - For writes, respect confirmation mode and execute through `toolsExecute`.
   - Do not allow invented tool IDs.

7. **Add observability and audit fields**
   - Log provider, tool ID, risk tier, role group, latency, safe arg/result previews, and status.

8. **Add tests and run checks**
   - Cover tool catalog presence, role enforcement, argument validation, and critical provider constraints.

## Integration Checklist

Copy and track this checklist while implementing:

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

## Validation Commands

Run these before considering the work complete:

```bash
deno check supabase/functions/_shared/integrations-runtime.ts
deno check supabase/functions/ai-api/index.ts
deno check supabase/functions/intent-agent/index.ts
deno test "supabase/functions/_shared/*.test.ts"
```

## Additional Reference

- For the full runbook and role-group/performance details, read [reference.md](reference.md).
