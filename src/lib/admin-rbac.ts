/** Platform admin console RBAC helpers (TechMakers / compliance roles). */

export function normalizeRoleList(roles: unknown): string[] {
  if (!Array.isArray(roles)) return [];
  return roles.map((x) => String(x).toLowerCase());
}

export function canAccessAdminConsoleRoute(roles: unknown): boolean {
  const r = normalizeRoleList(roles);
  return r.some((x) =>
    ["super_admin", "compliance_auditor", "auditor"].includes(x),
  );
}

export function isSuperAdminProfile(roles: unknown): boolean {
  return normalizeRoleList(roles).includes("super_admin");
}

export function isPlatformAuditorProfile(roles: unknown): boolean {
  const r = normalizeRoleList(roles);
  return r.some((x) => ["compliance_auditor", "auditor"].includes(x));
}

export function canUsePrivilegedAdminData(roles: unknown): boolean {
  return isSuperAdminProfile(roles) || isPlatformAuditorProfile(roles);
}
