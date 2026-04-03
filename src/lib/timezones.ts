const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export function getTimeZoneOptions(): string[] {
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    if (typeof fn === "function") {
      const list = fn.call(Intl, "timeZone");
      return Array.isArray(list) && list.length > 0 ? [...list].sort() : [...FALLBACK_TIMEZONES];
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_TIMEZONES];
}
