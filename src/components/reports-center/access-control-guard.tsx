import type { ReactNode } from "react";

export interface AccessControlGuardProps {
  /** When true, children render; otherwise `fallback` is shown. */
  allow: boolean;
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * RBAC wrapper for Reports Center sections. Server-side checks remain authoritative.
 */
export function AccessControlGuard({
  allow,
  fallback,
  children,
}: AccessControlGuardProps) {
  if (!allow) return fallback;
  return children;
}
