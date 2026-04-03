import type { ReactNode } from "react";

export type PermissionGuardProps = {
  /** Current user roles from profile or simulated preview roles. */
  roles: string[];
  /** At least one match (case-insensitive) grants access. */
  anyOf: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

function matchesAnyRole(userRoles: string[], required: string[]): boolean {
  const set = new Set((userRoles ?? []).map((r) => String(r).toLowerCase()));
  const req = Array.isArray(required) ? required : [];
  return req.some((r) => set.has(String(r).toLowerCase()));
}

export function usePermissionGuard(userRoles: string[], anyOf: string[]): boolean {
  return matchesAnyRole(userRoles, anyOf);
}

export function PermissionGuard({ roles, anyOf, children, fallback = null }: PermissionGuardProps) {
  if (!matchesAnyRole(roles, anyOf)) return fallback;
  return children;
}
