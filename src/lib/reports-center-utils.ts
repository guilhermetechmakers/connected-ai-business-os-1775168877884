/**
 * Runtime-safe helpers for Reports Center data shapes.
 */

export function ensureArray<T>(value: unknown, guard: (x: unknown) => x is T): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (guard(item)) out.push(item);
  }
  return out;
}

export function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

export function safeMap<T, U>(arr: T[] | null | undefined, fn: (item: T, i: number) => U): U[] {
  const list = Array.isArray(arr) ? arr : [];
  return list.map(fn);
}

export function normalizeRoleSet(roles: string[] | null | undefined): Set<string> {
  const list = Array.isArray(roles) ? roles : [];
  return new Set(list.map((r) => r.trim().toLowerCase()));
}

export function canEditReportsCenter(roles: string[] | null | undefined): boolean {
  const r = normalizeRoleSet(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("super_admin") ||
    r.has("owner") ||
    r.has("manager") ||
    r.has("executive") ||
    r.has("analyst")
  );
}

export function canManageKpisUi(roles: string[] | null | undefined): boolean {
  const r = normalizeRoleSet(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("super_admin") ||
    r.has("owner") ||
    r.has("analyst")
  );
}

export function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readKpiCachedNumber(cached: unknown): number | null {
  if (!isStringRecord(cached)) return null;
  const v = cached.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
