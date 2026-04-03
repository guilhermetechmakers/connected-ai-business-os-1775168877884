import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/contexts/auth-context";

type AuthenticatorGuardProps = {
  children: ReactNode;
  /** Where to send users who already have a session */
  redirectTo?: string;
};

/**
 * Allows only guests (no Supabase session). Authenticated users are redirected away —
 * used for sign-up / invite acceptance so tenants cannot re-enter provisioning flows.
 */
export function AuthenticatorGuard({
  children,
  redirectTo = "/dashboard/global",
}: AuthenticatorGuardProps) {
  const { session, isLoading, isConfigured } = useAuth();

  if (!isConfigured) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="grid-bg flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading session" />
      </div>
    );
  }

  if (session) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
