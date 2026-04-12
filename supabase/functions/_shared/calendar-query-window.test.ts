import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { resolveCalendarListWindowFromMessageAndPlan } from "./calendar-query-window.ts";

Deno.test("resolveCalendarListWindowFromMessageAndPlan merges next Monday from user text", () => {
  const w = resolveCalendarListWindowFromMessageAndPlan({
    userMessage: "Do I have anything scheduled for next Monday?",
    plan: {
      intent: "integration_read",
      confidence: 0.9,
      toolId: "google_calendar.list_events",
      reasoningSummary: "test",
      fallbackBehavior: "use_llm_tools",
    },
    referenceNowIso: "2026-04-11T15:00:00.000Z",
    clientTimeZone: "UTC",
    clientLocale: "en-US",
    providerCalendarTimezone: "UTC",
    companyTimezone: "UTC",
  });
  if (!w) throw new Error("expected window");
  const min = new Date(w.timeMin);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(min);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  assertEquals({ y, m, d }, { y: 2026, m: 4, d: 13 });
});
