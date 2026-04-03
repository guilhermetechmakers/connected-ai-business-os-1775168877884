import type { ReactNode } from "react";

export interface ReportsAccessControlGuardProps {
  allow: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * RBAC wrapper for Reports Center — use with tenant role checks from profile.
 */
export function ReportsAccessControlGuard({
  allow,
  fallback = null,
  children,
}: ReportsAccessControlGuardProps) {
  if (!allow) return fallback;
  return children;
}

export function profileAllowsReportWrite(roles: string[] | undefined): boolean {
  const r = new Set((roles ?? []).map((x) => String(x).trim().toLowerCase()));
  return (
    r.has("admin") ||
    r.has("owner") ||
    r.has("manager") ||
    r.has("builder") ||
    r.has("super_admin") ||
    r.has("team_member") ||
    r.has("executive") ||
    r.has("company_admin") ||
    r.has("analyst")
  );
}

export function profileAllowsKpiWrite(roles: string[] | undefined): boolean {
  const r = new Set((roles ?? []).map((x) => String(x).trim().toLowerCase()));
  return (
    r.has("admin") ||
    r.has("owner") ||
    r.has("manager") ||
    r.has("builder") ||
    r.has("super_admin") ||
    r.has("analyst")
  );
}
