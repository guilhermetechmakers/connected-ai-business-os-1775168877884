import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/auth-context";

export function ProtectedRoute() {
  const { session, isLoading, isConfigured, ensureProfile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isConfigured || !session) return;
    void ensureProfile();
  }, [ensureProfile, isConfigured, session]);

  if (!isConfigured) {
    return (
      <div className="min-h-screen">
        <div className="border-b border-border/80 bg-card/90 px-4 py-2 text-center text-xs text-muted-foreground">
          Demo mode: set{" "}
          <span className="font-mono text-[10px] text-foreground">VITE_SUPABASE_URL</span> and{" "}
          <span className="font-mono text-[10px] text-foreground">VITE_SUPABASE_ANON_KEY</span>{" "}
          to enforce authenticated dashboard access.
        </div>
        <Outlet />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid-bg flex min-h-screen items-center justify-center">
        <Loader2
          className="h-8 w-8 animate-spin text-primary"
          aria-label="Loading session"
        />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
