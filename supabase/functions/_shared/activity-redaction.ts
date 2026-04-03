/**
 * Server-side redaction for activity log payloads (nested keys matching sensitive patterns).
 */

const SENSITIVE_KEY = /password|token|secret|apikey|api_key|authorization|credential|private_key/i;

export function redactJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactJsonValue(v));
  }
  if (typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactJsonValue(v);
    }
  }
  return out;
}
