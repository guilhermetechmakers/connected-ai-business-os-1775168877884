const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTENDEES = 50;

export type CalendarAttendeeNormalized = { email: string };

export type CalendarCreateInput = {
  summary: string;
  start: string;
  end: string;
  description?: string;
  calendarId?: string;
  attendees?: unknown;
  /** When true (default if attendees present), Google Calendar sends invitation emails. */
  sendCalendarInvites?: boolean;
};

export type CalendarCreateNormalized = {
  summary: string;
  start: string;
  end: string;
  description?: string;
  calendarId: string;
  attendees: CalendarAttendeeNormalized[];
  sendCalendarInvites: boolean;
};

function parseAttendees(raw: unknown):
  | { ok: true; value: CalendarAttendeeNormalized[] }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "event.attendees must be an array of email strings or { email } objects." };
  }
  const emails: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t && SIMPLE_EMAIL.test(t)) emails.push(t.toLowerCase());
    } else if (typeof item === "object" && item !== null) {
      const rec = item as Record<string, unknown>;
      const e = typeof rec.email === "string" ? rec.email.trim() : "";
      if (e && SIMPLE_EMAIL.test(e)) emails.push(e.toLowerCase());
    }
  }
  const deduped = [...new Set(emails)];
  if (deduped.length > MAX_ATTENDEES) {
    return { ok: false, error: `Too many attendees (max ${MAX_ATTENDEES}).` };
  }
  return { ok: true, value: deduped.map((email) => ({ email })) };
}

export function normalizeCalendarCreateInput(raw: Record<string, unknown>): {
  ok: true;
  value: CalendarCreateNormalized;
} | {
  ok: false;
  error: string;
} {
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const start = typeof raw.start === "string" ? raw.start.trim() : "";
  const end = typeof raw.end === "string" ? raw.end.trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : undefined;
  const calendarId = typeof raw.calendarId === "string" && raw.calendarId.trim()
    ? raw.calendarId.trim()
    : "primary";

  const attendeesParsed = parseAttendees(raw.attendees);
  if (!attendeesParsed.ok) return { ok: false, error: attendeesParsed.error };

  const sendRaw = raw.sendCalendarInvites;
  const sendCalendarInvites = typeof sendRaw === "boolean"
    ? sendRaw
    : attendeesParsed.value.length > 0;

  if (!summary) return { ok: false, error: "Missing required field: event.summary" };
  if (!start) return { ok: false, error: "Missing required field: event.start (RFC3339)" };
  if (!end) return { ok: false, error: "Missing required field: event.end (RFC3339)" };

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs)) return { ok: false, error: "Invalid event.start. Expected RFC3339 datetime." };
  if (!Number.isFinite(endMs)) return { ok: false, error: "Invalid event.end. Expected RFC3339 datetime." };
  if (endMs <= startMs) return { ok: false, error: "Invalid range: event.end must be after event.start." };

  return {
    ok: true,
    value: {
      summary,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      description: description && description.length > 0 ? description : undefined,
      calendarId,
      attendees: attendeesParsed.value,
      sendCalendarInvites,
    },
  };
}

export function buildCalendarCreatePendingPreview(input: CalendarCreateNormalized): Record<string, unknown> {
  return {
    args: {
      calendarId: input.calendarId,
      summary: input.summary,
      start: input.start,
      end: input.end,
      description: input.description ?? "",
      attendees: input.attendees,
      sendCalendarInvites: input.sendCalendarInvites,
    },
  };
}

export function shouldExecuteCalendarCreate(executionMode: "confirm" | "auto"): boolean {
  return executionMode === "auto";
}
