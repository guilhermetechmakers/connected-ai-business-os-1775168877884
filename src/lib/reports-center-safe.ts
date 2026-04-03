/** Null-safe helpers for Reports Center data shapes. */

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function coerceToArray<T>(value: unknown): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

export function safeMap<T, U>(
  value: unknown,
  fn: (item: T, index: number) => U,
): U[] {
  const arr = ensureArray<T>(value);
  return arr.map(fn);
}

export function safeFilter<T>(
  value: unknown,
  pred: (item: T, index: number) => boolean,
): T[] {
  return ensureArray<T>(value).filter(pred);
}

export function readStringArray(value: unknown): string[] {
  return ensureArray<unknown>(value).filter((x): x is string => typeof x === "string");
}

export function readJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
