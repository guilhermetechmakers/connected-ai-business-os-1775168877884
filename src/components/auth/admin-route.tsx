import { Loader2 } from "lucide-react";
import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/contexts/auth-context";
import { canAccessAdminConsoleRoute } from "@/lib/admin-rbac";

/**
 * TechMakers / compliance roles only (see `canAccessAdminConsoleRoute`).
 */
export function AdminRoute() {
  const { profile, isLoading, isConfigured } = useAuth();

  if (!isConfigured) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (!canAccessAdminConsoleRoute(profile?.roles)) {
    return <Navigate to="/dashboard/global" replace />;
  }

  return <Outlet />;
}
