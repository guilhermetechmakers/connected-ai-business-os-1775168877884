import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { intentPlanRequestSchema, intentPlanResultSchema } from "./intent-plan.ts";

Deno.test("intentPlanResultSchema applies defaults for missing required operational fields", () => {
  const parsed = intentPlanResultSchema.parse({
    intent: "general",
  });

  assertEquals(parsed.intent, "general");
  assertEquals(parsed.confidence, 0.35);
  assertEquals(parsed.reasoningSummary, "Model returned partial plan");
  assertEquals(parsed.fallbackBehavior, "use_llm_tools");
});

Deno.test("intentPlanResultSchema coerces numeric confidence from string", () => {
  const parsed = intentPlanResultSchema.parse({
    intent: "integration_read",
    confidence: "0.8",
    reasoningSummary: "Calendar read",
    fallbackBehavior: "use_llm_tools",
  });

  assertEquals(parsed.confidence, 0.8);
});

Deno.test("intentPlanResultSchema rejects out-of-range confidence", () => {
  const result = intentPlanResultSchema.safeParse({
    intent: "integration_read",
    confidence: 1.2,
    reasoningSummary: "Too high",
    fallbackBehavior: "use_llm_tools",
  });

  assertEquals(result.success, false);
});

Deno.test("intentPlanResultSchema rejects malformed confidence", () => {
  const result = intentPlanResultSchema.safeParse({
    intent: "integration_read",
    confidence: "not-a-number",
    reasoningSummary: "Bad confidence",
    fallbackBehavior: "use_llm_tools",
  });

  assertEquals(result.success, false);
});

Deno.test("intentPlanResultSchema accepts integration_write calendar create shape", () => {
  const parsed = intentPlanResultSchema.parse({
    intent: "integration_write",
    toolId: "google_calendar.create_event",
    queryArgs: {
      summary: "dream",
      start: "2026-04-10T21:00:00Z",
      end: "2026-04-10T22:00:00Z",
      calendarId: "primary",
    },
  });

  assertEquals(parsed.intent, "integration_write");
  assertEquals(parsed.toolId, "google_calendar.create_event");
});

Deno.test("intentPlanRequestSchema accepts client-local temporal context", () => {
  const parsed = intentPlanRequestSchema.parse({
    userMessage: "what do I have today?",
    mode: "Ask",
    workspaceId: "global",
    permittedToolIds: ["google_calendar.list_events"],
    toolCatalogSummary: "google_calendar.list_events",
    companyTimezone: "UTC",
    clientNowIso: "2026-04-10T20:00:00.000Z",
    clientTimeZone: "America/Sao_Paulo",
    clientLocale: "pt-BR",
  });

  assertEquals(parsed.clientTimeZone, "America/Sao_Paulo");
  assertEquals(parsed.clientLocale, "pt-BR");
  assertEquals(parsed.clientNowIso, "2026-04-10T20:00:00.000Z");
});
