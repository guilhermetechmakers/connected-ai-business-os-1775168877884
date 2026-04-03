const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "credential",
  "private_key",
  "client_secret",
];

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((f) => k.includes(f));
}

/** Shallow + one-level nested redaction for JSON payloads stored on activity logs. */
export function redactPayloadJson(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactPayloadJson(v, depth + 1));
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(o)) {
      if (isSensitiveKey(key)) {
        out[key] = "[REDACTED]";
      } else if (v !== null && typeof v === "object") {
        out[key] = redactPayloadJson(v, depth + 1);
      } else {
        out[key] = v;
      }
    }
    return out;
  }
  return value;
}
