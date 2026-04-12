/**
 * Detects when a user message asks to create a calendar event with a clock time
 * but no explicit calendar day — requires clarification before creating.
 */

function hasTimeOfDayHint(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  // 6pm, 6 pm, 18:00, 18:30, noon, midnight
  if (/\b\d{1,2}\s*(:\d{2})?\s*(am|pm)\b/i.test(m)) return true;
  if (/\b\d{1,2}:\d{2}\b/.test(m)) return true;
  if (/\b(noon|midnight)\b/i.test(m)) return true;
  return false;
}

function hasExplicitCalendarDayHint(message: string): boolean {
  const m = message.toLowerCase();
  if (/\b(today|tomorrow|tonight|yesterday)\b/.test(m)) return true;
  if (/\b(next|this|last)\s+(week|month|year)\b/.test(m)) return true;
  if (/\b(next|this|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(m)) return true;
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(m)) return true;
  // ISO date
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(m)) return true;
  // Slash / dash numeric dates (locale-ambiguous; still a concrete day anchor)
  if (/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/.test(m)) return true;
  // April 13, 13 April, etc.
  if (
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?\b/
      .test(m)
  ) {
    return true;
  }
  if (
    /\b\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/
      .test(m)
  ) {
    return true;
  }
  // Relative time spans that pin the day (e.g. in 2 hours)
  if (/\bin\s+\d+\s+(hour|hours|minute|minutes|min|mins)\b/.test(m)) return true;
  if (/\bin\s+\d+\s+days?\b/.test(m)) return true;
  return false;
}

function looksLikeCalendarEventCreateIntent(message: string): boolean {
  const m = message.toLowerCase();
  const createKw = /\b(add|create|schedule|book|put|set|new)\b/.test(m);
  const calKw = /\b(event|meeting|appointment|calendar)\b/.test(m);
  const newEvent = /\bnew\s+event\b/.test(m);
  return (createKw && calKw) || newEvent;
}

/**
 * Returns true when the user likely wants to create an event with a time but did not name a day.
 * Caller should ask which day (e.g. today vs tomorrow) before creating.
 */
export function isCalendarCreateDateAmbiguousFromUserMessage(message: string): boolean {
  if (!looksLikeCalendarEventCreateIntent(message)) return false;
  if (!hasTimeOfDayHint(message)) return false;
  if (hasExplicitCalendarDayHint(message)) return false;
  return true;
}

export function buildCalendarCreateDateClarificationMessage(clientTimeZone: string | null | undefined): string {
  const tz = clientTimeZone && clientTimeZone.trim()
    ? ` (${clientTimeZone.trim()})`
    : "";
  return (
    `I need a calendar day to schedule this. You gave a time but no date (e.g. today, tomorrow, next Monday, or a specific date). ` +
    `Which day should I use${tz}?`
  );
}
