import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  getPartsInTimeZone,
  localCalendarDayToGoogleWindow,
  parseSlashDateFromText,
  parseSlashDateFromTextWithLocale,
  parseWeekdayRelativeFromText,
  resolveExplicitDayWindow,
  resolveDateOrderHint,
  resolveIntegrationTimeWindow,
} from "./intent-time.ts";

Deno.test("parseSlashDateFromText prefers MM/DD/YYYY when US style", () => {
  const r = parseSlashDateFromText("events for 04/10/2026 today", true);
  assertEquals(r, { year: 2026, month: 4, day: 10 });
});

Deno.test("resolveExplicitDayWindow uses provider timezone for bounds", () => {
  const w = resolveExplicitDayWindow(
    { year: 2026, month: 4, day: 10 },
    "America/New_York",
    "provider_calendar",
  );
  if (!w) throw new Error("expected window");
  assertEquals(w.resolvedTimezone, "America/New_York");
  assertEquals(w.resolutionSource, "provider_calendar");
  const min = new Date(w.timeMin);
  const max = new Date(w.timeMax);
  assertEquals(min < max, true);
});

Deno.test("explicitDate overrides today hint in resolveIntegrationTimeWindow", () => {
  const w = resolveIntegrationTimeWindow({
    now: new Date("2026-10-12T12:00:00Z"),
    providerCalendarTimezone: "UTC",
    companyTimezone: "UTC",
    timeWindowHint: "today",
    explicitDate: { year: 2026, month: 4, day: 10 },
  });
  if (!w) throw new Error("expected window");
  const partsMin = getPartsInTimeZone(new Date(w.timeMin), "UTC");
  assertEquals(partsMin.year, 2026);
  assertEquals(partsMin.month, 4);
  assertEquals(partsMin.day, 10);
});

Deno.test("localCalendarDayToGoogleWindow returns exclusive timeMax", () => {
  const w = localCalendarDayToGoogleWindow("UTC", 2026, 4, 10);
  if (!w) throw new Error("expected window");
  assertEquals(new Date(w.timeMin) < new Date(w.timeMax), true);
});

Deno.test("parseSlashDateFromTextWithLocale uses locale-specific order", () => {
  const us = parseSlashDateFromTextWithLocale("event 04/10/2026", "en-US");
  const br = parseSlashDateFromTextWithLocale("event 04/10/2026", "pt-BR");
  assertEquals(us, { year: 2026, month: 4, day: 10 });
  assertEquals(br, { year: 2026, month: 10, day: 4 });
  assertEquals(resolveDateOrderHint("en-US"), "mdy");
  assertEquals(resolveDateOrderHint("pt-BR"), "dmy");
});

Deno.test("resolveIntegrationTimeWindow prefers client timezone over provider/company", () => {
  const w = resolveIntegrationTimeWindow({
    now: new Date("2026-04-10T23:30:00Z"),
    clientTimeZone: "America/New_York",
    providerCalendarTimezone: "UTC",
    companyTimezone: "UTC",
    timeWindowHint: "today",
    explicitDate: null,
  });
  if (!w) throw new Error("expected window");
  assertEquals(w.resolutionSource, "client");
  assertEquals(w.resolvedTimezone, "America/New_York");
});

Deno.test("resolveIntegrationTimeWindow supports this_week windows", () => {
  const w = resolveIntegrationTimeWindow({
    now: new Date("2026-04-10T10:00:00Z"),
    clientTimeZone: "UTC",
    providerCalendarTimezone: null,
    companyTimezone: "UTC",
    timeWindowHint: "this_week",
    explicitDate: null,
  });
  if (!w) throw new Error("expected window");
  assertEquals(new Date(w.timeMax).getTime() - new Date(w.timeMin).getTime(), 7 * 24 * 60 * 60 * 1000);
});

Deno.test("resolveIntegrationTimeWindow explicit without explicitDate returns null", () => {
  const w = resolveIntegrationTimeWindow({
    now: new Date("2026-04-10T12:00:00Z"),
    providerCalendarTimezone: "UTC",
    companyTimezone: "UTC",
    timeWindowHint: "explicit",
    explicitDate: null,
  });
  assertEquals(w, null);
});

Deno.test("parseWeekdayRelativeFromText resolves next Monday from Saturday", () => {
  const r = parseWeekdayRelativeFromText("Anything scheduled for next Monday?", {
    referenceNow: new Date("2026-04-11T15:00:00.000Z"),
    clientTimeZone: "UTC",
    providerCalendarTimezone: null,
    companyTimezone: "UTC",
  });
  assertEquals(r, { year: 2026, month: 4, day: 13 });
});
