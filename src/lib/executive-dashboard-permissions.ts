const norm = (r: string) => r.trim().toLowerCase();

export function normalizeRoleSet(roles: string[] | null | undefined): Set<string> {
  const list = Array.isArray(roles) ? roles : [];
  return new Set(list.map(norm));
}

export function canRefreshExecutiveBrief(roles: string[] | null | undefined): boolean {
  const r = normalizeRoleSet(roles);
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("executive") ||
    r.has("owner") ||
    r.has("manager")
  );
}

export function canScheduleExecutiveExports(roles: string[] | null | undefined): boolean {
  const r = normalizeRoleSet(roles);
  return r.has("admin") || r.has("company admin") || r.has("executive") || r.has("owner");
}

export function canExportExecutiveData(roles: string[] | null | undefined): boolean {
  const r = normalizeRoleSet(roles);
  if (r.has("viewer") && r.size === 1) return false;
  return (
    r.has("admin") ||
    r.has("company admin") ||
    r.has("executive") ||
    r.has("owner") ||
    r.has("manager") ||
    r.has("analyst")
  );
}
