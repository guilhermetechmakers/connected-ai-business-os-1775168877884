import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCalendarCreatePendingPreview,
  normalizeCalendarCreateInput,
  shouldExecuteCalendarCreate,
} from "./calendar-write.ts";

Deno.test("normalizeCalendarCreateInput validates required fields", () => {
  const bad = normalizeCalendarCreateInput({
    summary: "",
    start: "2026-04-10T21:00:00Z",
    end: "2026-04-10T22:00:00Z",
  });
  assertEquals(bad.ok, false);
});

Deno.test("normalizeCalendarCreateInput validates datetime order", () => {
  const bad = normalizeCalendarCreateInput({
    summary: "dream",
    start: "2026-04-10T22:00:00Z",
    end: "2026-04-10T21:00:00Z",
  });
  assertEquals(bad.ok, false);
});

Deno.test("normalizeCalendarCreateInput normalizes valid payload", () => {
  const good = normalizeCalendarCreateInput({
    summary: "dream",
    start: "2026-04-10T21:00:00Z",
    end: "2026-04-10T22:00:00Z",
    description: "night task",
  });
  assertEquals(good.ok, true);
  if (!good.ok) return;
  assertEquals(good.value.calendarId, "primary");
  assertEquals(good.value.attendees.length, 0);
  assertEquals(good.value.sendCalendarInvites, false);
  const preview = buildCalendarCreatePendingPreview(good.value);
  assertEquals((preview.args as Record<string, unknown>).summary, "dream");
});

Deno.test("normalizeCalendarCreateInput parses attendees and dedupes", () => {
  const good = normalizeCalendarCreateInput({
    summary: "Meet",
    start: "2026-04-10T21:00:00Z",
    end: "2026-04-10T22:00:00Z",
    attendees: ["A@Example.com", { email: "a@example.com" }, { email: "b@test.com" }],
  });
  assertEquals(good.ok, true);
  if (!good.ok) return;
  assertEquals(good.value.attendees.map((a) => a.email).sort(), ["a@example.com", "b@test.com"]);
  assertEquals(good.value.sendCalendarInvites, true);
});

Deno.test("normalizeCalendarCreateInput rejects invalid attendees", () => {
  const bad = normalizeCalendarCreateInput({
    summary: "Meet",
    start: "2026-04-10T21:00:00Z",
    end: "2026-04-10T22:00:00Z",
    attendees: "not-an-array" as unknown as [],
  });
  assertEquals(bad.ok, false);
});

Deno.test("shouldExecuteCalendarCreate maps confirm vs auto", () => {
  assertEquals(shouldExecuteCalendarCreate("confirm"), false);
  assertEquals(shouldExecuteCalendarCreate("auto"), true);
});
