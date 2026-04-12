/**
 * Unified calendar list time window for intent prefetch, heuristic prefetch, and query_integration.
 */
import type { IntentPlanResult } from "./intent-plan.ts";
import {
  inferTimeWindowHintFromMessage,
  parseSlashDateFromText,
  parseWeekdayRelativeFromText,
  resolveIntegrationTimeWindow,
  type ResolvedDayWindow,
} from "./intent-time.ts";

export function resolveCalendarListWindowFromMessageAndPlan(params: {
  userMessage: string;
  plan: IntentPlanResult | null;
  referenceNowIso: string;
  clientTimeZone?: string;
  clientLocale?: string;
  providerCalendarTimezone: string | null;
  companyTimezone: string;
}): ResolvedDayWindow | null {
  const plan = params.plan;
  const explicit =
    plan?.explicitDate ??
    parseSlashDateFromText(params.userMessage, params.clientLocale ?? true) ??
    parseWeekdayRelativeFromText(params.userMessage, {
      referenceNow: new Date(params.referenceNowIso),
      clientTimeZone: params.clientTimeZone,
      providerCalendarTimezone: params.providerCalendarTimezone,
      companyTimezone: params.companyTimezone,
    }) ??
    undefined;

  const hint =
    plan?.timeWindowHint ??
    (explicit ? "explicit" : inferTimeWindowHintFromMessage(params.userMessage));

  let window = resolveIntegrationTimeWindow({
    now: new Date(params.referenceNowIso),
    clientTimeZone: params.clientTimeZone,
    providerCalendarTimezone: params.providerCalendarTimezone,
    companyTimezone: params.companyTimezone,
    timeWindowHint: hint,
    explicitDate: explicit ?? null,
  });

  if (!window && hint === "explicit") {
    window = resolveIntegrationTimeWindow({
      now: new Date(params.referenceNowIso),
      clientTimeZone: params.clientTimeZone,
      providerCalendarTimezone: params.providerCalendarTimezone,
      companyTimezone: params.companyTimezone,
      timeWindowHint: "today",
      explicitDate: null,
    });
  }
  return window;
}
