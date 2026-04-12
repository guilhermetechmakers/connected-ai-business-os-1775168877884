/**
 * Timezone-aware day bounds for integration queries (Google Calendar, etc.).
 * Provider calendar timezone is preferred; falls back to company timezone, then UTC.
 */

export type TimeResolutionSource = "client" | "provider_calendar" | "company" | "utc";

export type ResolvedDayWindow = {
  timeMin: string;
  timeMax: string;
  resolvedTimezone: string;
  resolutionSource: TimeResolutionSource;
  /** Human label e.g. "2026-04-10 (America/New_York)" */
  label: string;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Validate IANA timezone; returns normalized id or null. */
export function normalizeIanaTimezone(tz: string | null | undefined): string | null {
  if (!tz || typeof tz !== "string") return null;
  const t = tz.trim();
  if (!t) return null;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return t;
  } catch {
    return null;
  }
}

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getPartsInTimeZone(utc: Date, timeZone: string): ZonedParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(utc);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** First UTC instant where local civil date in `timeZone` is (y,m,d), scanning by minute. */
export function findStartOfLocalCalendarDayUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
): Date | null {
  const base = Date.UTC(year, month - 1, day, 12, 0, 0);
  let best: Date | null = null;
  for (let offsetMin = -36 * 60; offsetMin <= 36 * 60; offsetMin++) {
    const t = new Date(base + offsetMin * 60 * 1000);
    const p = getPartsInTimeZone(t, timeZone);
    if (p.year === year && p.month === month && p.day === day) {
      if (!best || t.getTime() < best.getTime()) best = t;
    }
  }
  return best;
}

/** Start of next civil calendar day after (year, month, day) in `timeZone`. */
export function findStartOfNextLocalCalendarDayUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
): Date | null {
  const t = new Date(Date.UTC(year, month - 1, day + 1));
  const ny = t.getUTCFullYear();
  const nm = t.getUTCMonth() + 1;
  const nd = t.getUTCDate();
  return findStartOfLocalCalendarDayUtc(timeZone, ny, nm, nd);
}

/**
 * Inclusive/exclusive window matching Google Calendar `events.list`:
 * timeMin inclusive, timeMax exclusive (RFC3339).
 */
export function localCalendarDayToGoogleWindow(
  timeZone: string,
  year: number,
  month: number,
  day: number,
): { timeMin: string; timeMax: string } | null {
  const start = findStartOfLocalCalendarDayUtc(timeZone, year, month, day);
  const nextStart = findStartOfNextLocalCalendarDayUtc(timeZone, year, month, day);
  if (!start || !nextStart) return null;
  return {
    timeMin: start.toISOString(),
    timeMax: nextStart.toISOString(),
  };
}

/** "Today" in the given IANA timezone relative to `now`. */
export function resolveTodayWindow(
  now: Date,
  timeZone: string,
  resolutionSource: TimeResolutionSource,
): ResolvedDayWindow | null {
  const p = getPartsInTimeZone(now, timeZone);
  const w = localCalendarDayToGoogleWindow(timeZone, p.year, p.month, p.day);
  if (!w) return null;
  return {
    ...w,
    resolvedTimezone: timeZone,
    resolutionSource,
    label: `${p.year}-${pad2(p.month)}-${pad2(p.day)} (${timeZone})`,
  };
}

/** "Tomorrow" in the given IANA timezone relative to `now`. */
export function resolveTomorrowWindow(
  now: Date,
  timeZone: string,
  resolutionSource: TimeResolutionSource,
): ResolvedDayWindow | null {
  const p = getPartsInTimeZone(now, timeZone);
  const t = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const ny = t.getUTCFullYear();
  const nm = t.getUTCMonth() + 1;
  const nd = t.getUTCDate();
  const w = localCalendarDayToGoogleWindow(timeZone, ny, nm, nd);
  if (!w) return null;
  return {
    ...w,
    resolvedTimezone: timeZone,
    resolutionSource,
    label: `${ny}-${pad2(nm)}-${pad2(nd)} (${timeZone})`,
  };
}

export type ExplicitDateParts = { year: number; month: number; day: number };

function inferSlashDateOrderFromLocale(locale: string | null | undefined): "mdy" | "dmy" {
  const normalized = typeof locale === "string" ? locale.trim() : "";
  if (!normalized) return "mdy";
  try {
    const sample = new Date(Date.UTC(2031, 10, 22));
    const parts = new Intl.DateTimeFormat(normalized, {
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(sample);
    const order = parts
      .filter((p) => p.type === "month" || p.type === "day")
      .map((p) => p.type)
      .join("-");
    return order.startsWith("month") ? "mdy" : "dmy";
  } catch {
    return "mdy";
  }
}

/**
 * Parse MM/DD/YYYY or DD/MM/YYYY from free text.
 * If both day and month are <= 12, chooses by locale (or preferUsStyle when boolean passed).
 */
export function parseSlashDateFromText(
  text: string,
  localeOrPreferUsStyle: string | boolean = true,
): ExplicitDateParts | null {
  const m = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const year = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(year)) return null;
  let month: number;
  let day: number;
  if (a > 12) {
    day = a;
    month = b;
  } else if (b > 12) {
    month = a;
    day = b;
  } else {
    const preferUsStyle = typeof localeOrPreferUsStyle === "boolean"
      ? localeOrPreferUsStyle
      : inferSlashDateOrderFromLocale(localeOrPreferUsStyle) === "mdy";
    if (preferUsStyle) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function parseSlashDateFromTextWithLocale(
  text: string,
  locale: string | null | undefined,
): ExplicitDateParts | null {
  return parseSlashDateFromText(text, locale ?? true);
}

export function resolveExplicitDayWindow(
  parts: ExplicitDateParts,
  timeZone: string,
  resolutionSource: TimeResolutionSource,
): ResolvedDayWindow | null {
  const w = localCalendarDayToGoogleWindow(timeZone, parts.year, parts.month, parts.day);
  if (!w) return null;
  return {
    ...w,
    resolvedTimezone: timeZone,
    resolutionSource,
    label: `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} (${timeZone})`,
  };
}

export type ResolveIntentTimeParams = {
  now: Date;
  /** Browser/client timezone (IANA) from the user session/device */
  clientTimeZone?: string | null | undefined;
  /** Google Calendar primary timezone (IANA) when available */
  providerCalendarTimezone: string | null | undefined;
  /** companies.timezone */
  companyTimezone: string | null | undefined;
  timeWindowHint: "today" | "tomorrow" | "this_week" | "explicit" | "none" | undefined;
  explicitDate: ExplicitDateParts | null | undefined;
};

/**
 * Pick IANA tz: client timezone first, then provider calendar, then company, then UTC.
 * Apply window from hint or explicit date.
 */
export function resolveIntegrationTimeWindow(params: ResolveIntentTimeParams): ResolvedDayWindow | null {
  const client = normalizeIanaTimezone(params.clientTimeZone);
  const provider = normalizeIanaTimezone(params.providerCalendarTimezone);
  const company = normalizeIanaTimezone(params.companyTimezone);
  const tz = client ?? provider ?? company ?? "UTC";
  const source: TimeResolutionSource = client
    ? "client"
    : provider
    ? "provider_calendar"
    : company
    ? "company"
    : "utc";

  // Any explicit Y-M-D wins over "today" / ambiguous hints
  if (params.explicitDate) {
    return resolveExplicitDayWindow(params.explicitDate, tz, source);
  }

  if (params.timeWindowHint === "tomorrow") {
    return resolveTomorrowWindow(params.now, tz, source);
  }

  if (params.timeWindowHint === "today" || params.timeWindowHint === "none" || params.timeWindowHint === undefined) {
    return resolveTodayWindow(params.now, tz, source);
  }

  if (params.timeWindowHint === "this_week") {
    const today = resolveTodayWindow(params.now, tz, source);
    if (!today) return null;
    const start = new Date(today.timeMin);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      timeMin: today.timeMin,
      timeMax: end.toISOString(),
      resolvedTimezone: tz,
      resolutionSource: source,
      label: `week_from_${today.label}`,
    };
  }

  if (params.timeWindowHint === "explicit") {
    // Do not fall back to "today" — callers must merge explicitDate or weekday parsers first.
    return null;
  }

  return resolveTodayWindow(params.now, tz, source);
}

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function weekdayNameToIndex(name: string): number | null {
  const n = name.toLowerCase();
  const i = (WEEKDAY_NAMES as readonly string[]).indexOf(n);
  return i >= 0 ? i : null;
}

/** Local weekday 0=Sun..6=Sat in `timeZone` for `instant`. */
export function getLocalWeekdayIndexInTimeZone(instant: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
    .formatToParts(instant)
    .find((p) => p.type === "weekday")?.value;
  const w = (part ?? "sunday").toLowerCase();
  return weekdayNameToIndex(w) ?? 0;
}

export type ParseWeekdayRelativeParams = {
  referenceNow: Date;
  clientTimeZone?: string | null;
  providerCalendarTimezone?: string | null;
  companyTimezone?: string | null;
};

function pickTzForRelativeParsing(params: ParseWeekdayRelativeParams): string {
  const client = normalizeIanaTimezone(params.clientTimeZone);
  const provider = normalizeIanaTimezone(params.providerCalendarTimezone);
  const company = normalizeIanaTimezone(params.companyTimezone);
  return client ?? provider ?? company ?? "UTC";
}

/** Advance civil (y,m,d) by `dayDelta` days in `timeZone` (DST-safe stepping). */
export function addDaysToExplicitDateInTimeZone(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  dayDelta: number,
): ExplicitDateParts | null {
  if (dayDelta === 0) return { year, month, day };
  let y = year;
  let m = month;
  let d = day;
  for (let i = 0; i < dayDelta; i++) {
    const nextStart = findStartOfNextLocalCalendarDayUtc(timeZone, y, m, d);
    if (!nextStart) return null;
    const p = getPartsInTimeZone(nextStart, timeZone);
    y = p.year;
    m = p.month;
    d = p.day;
  }
  return { year: y, month: m, day: d };
}

/**
 * Resolve phrases like "next Monday", "this Friday", or "on Monday" to a local calendar date
 * using the same timezone stack as resolveIntegrationTimeWindow.
 */
export function parseWeekdayRelativeFromText(
  text: string,
  params: ParseWeekdayRelativeParams,
): ExplicitDateParts | null {
  const tz = pickTzForRelativeParsing(params);
  const now = params.referenceNow;

  type Mode = "next" | "this" | "upcoming";
  const patterns: Array<{ re: RegExp; mode: Mode }> = [
    { re: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, mode: "next" },
    { re: /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, mode: "this" },
    {
      re: /\b(?:on|for)\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      mode: "upcoming",
    },
  ];

  let weekdayName: string | null = null;
  let mode: Mode = "upcoming";

  for (const { re, mode: md } of patterns) {
    const match = text.match(re);
    if (match) {
      weekdayName = match[1];
      mode = md;
      break;
    }
  }
  if (!weekdayName) return null;

  const target = weekdayNameToIndex(weekdayName);
  if (target === null) return null;

  const current = getLocalWeekdayIndexInTimeZone(now, tz);
  let delta = (target - current + 7) % 7;

  if (mode === "next") {
    if (delta === 0) delta = 7;
  }
  // "this" and "upcoming": delta 0 means the named weekday is today

  const parts = getPartsInTimeZone(now, tz);
  return addDaysToExplicitDateInTimeZone(tz, parts.year, parts.month, parts.day, delta);
}

/**
 * Coarse time hint when intent-agent did not set timeWindowHint (calendar list queries).
 */
export function inferTimeWindowHintFromMessage(message: string): "today" | "tomorrow" | "this_week" | "explicit" | "none" {
  const m = message.toLowerCase();
  if (/\bthis\s+week\b/.test(m) || /\bnext\s+week\b/.test(m)) return "this_week";
  if (/\btomorrow\b/.test(m)) return "tomorrow";
  if (/\btoday\b|\btonight\b/.test(m)) return "today";
  if (
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(m) ||
    /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(m) ||
    /\b(?:on|for)\s+(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(m)
  ) {
    return "explicit";
  }
  return "none";
}

export function resolveDateOrderHint(locale: string | null | undefined): "mdy" | "dmy" {
  return inferSlashDateOrderFromLocale(locale);
}
