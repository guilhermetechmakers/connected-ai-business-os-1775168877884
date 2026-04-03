import type { ReactNode } from "react";

export function SearchAccessControlGuard({
  allow,
  fallback = null,
  children,
}: {
  allow: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  if (!allow) return fallback;
  return children;
}
