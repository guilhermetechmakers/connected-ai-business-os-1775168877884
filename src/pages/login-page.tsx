import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AuthLayoutShell } from "@/components/auth/login/auth-layout-shell";
import { LoginForm } from "@/components/auth/login/login-form";
import { useAuth } from "@/contexts/auth-context";
import { parseLoginSearchParams } from "@/lib/login-url-params";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isConfigured, demoSession } = useAuth();
  const tenantCtx = parseLoginSearchParams(location.search);

  const from =
    (location.state as { from?: string } | null)?.from &&
    String((location.state as { from?: string }).from).startsWith("/")
      ? (location.state as { from: string }).from
      : "/dashboard/global";

  useEffect(() => {
    if (isConfigured && session) {
      navigate(from, { replace: true });
      return;
    }
    if (!isConfigured && demoSession) {
      navigate(from, { replace: true });
    }
  }, [demoSession, from, isConfigured, navigate, session]);

  return (
    <AuthLayoutShell>
      <LoginForm
        tenantName={tenantCtx.tenantName}
        tenantId={tenantCtx.tenantId}
        oauthProviders={tenantCtx.oauthProviders}
        ssoEnabled={tenantCtx.ssoEnabled}
        postAuthRedirectPath={from}
        onSuccess={() => navigate(from, { replace: true })}
      />
    </AuthLayoutShell>
  );
}
