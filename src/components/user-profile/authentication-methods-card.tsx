import { useMutation } from "@tanstack/react-query";
import { KeyRound, Link2, Shield, Ticket } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SecurityPanel } from "@/components/profile/security-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { restPatchAuthMethods } from "@/api/tenant-user-profile-rest";
import { useTenantAuthMethods } from "@/hooks/use-tenant-user-profile";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function methodsToFlags(methods: string[]) {
  const m = (methods ?? []).map((x) => String(x).toLowerCase());
  return {
    password: m.includes("password"),
    oauth: m.some((x) => ["oauth", "google", "microsoft", "saml", "oidc"].includes(x)),
  };
}

function flagsToMethods(password: boolean, oauth: boolean): string[] {
  const out: string[] = [];
  if (password) out.push("password");
  if (oauth) out.push("oauth");
  return out;
}

export function AuthenticationMethodsCard({
  tenantId,
  userId,
  onRefresh,
}: {
  tenantId: string;
  userId: string;
  onRefresh: () => Promise<void>;
}) {
  const [backupOpen, setBackupOpen] = useState(false);

  const canUseRest = isSupabaseConfigured && Boolean(tenantId) && Boolean(userId);

  const authQuery = useTenantAuthMethods(tenantId, userId);

  const methods = useMemo(() => {
    const raw = authQuery.data?.methods;
    return Array.isArray(raw) ? raw : [];
  }, [authQuery.data?.methods]);

  const flags = useMemo(() => methodsToFlags(methods), [methods]);

  const patchMutation = useMutation({
    mutationFn: async (next: string[]) => {
      if (!tenantId || !userId) throw new Error("Missing tenant or user");
      return restPatchAuthMethods(tenantId, userId, next);
    },
    onSuccess: async () => {
      toast.success("Sign-in methods updated");
      await authQuery.refetch();
      await onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyFlags = (password: boolean, oauth: boolean) => {
    const next = flagsToMethods(password, oauth);
    if (next.length === 0) {
      toast.error("Keep at least one sign-in method enabled");
      return;
    }
    patchMutation.mutate(next);
  };

  const onPasswordCheckedChange = (checked: boolean) => {
    if (!checked && !flags.oauth) {
      toast.error("Enable OAuth / SSO before disabling password");
      return;
    }
    applyFlags(checked, flags.oauth);
  };

  const onOauthCheckedChange = (checked: boolean) => {
    if (!checked && !flags.password) {
      toast.error("Enable password sign-in before disabling OAuth / SSO");
      return;
    }
    applyFlags(flags.password, checked);
  };

  const busy = patchMutation.isPending || authQuery.isLoading;

  return (
    <>
      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden />
            Authentication methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {canUseRest ? (
            <div className="space-y-4 rounded-xl border border-border/60 bg-surface-inner/30 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Link2 className="h-3.5 w-3.5 text-primary" aria-hidden />
                Sign-in options
              </p>
              <p className="text-xs text-muted-foreground">
                Tenant policy controls which methods stay available. Disabling a method updates your profile metadata;
                recovery flows may still require password verification.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    id="auth-password"
                    checked={flags.password}
                    disabled={busy}
                    aria-label="Password sign-in enabled"
                    onCheckedChange={onPasswordCheckedChange}
                  />
                  <Label htmlFor="auth-password" className="cursor-pointer text-sm font-medium">
                    Password / email link
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="auth-oauth"
                    checked={flags.oauth}
                    disabled={busy}
                    aria-label="OAuth and SSO sign-in enabled"
                    onCheckedChange={onOauthCheckedChange}
                  />
                  <Label htmlFor="auth-oauth" className="cursor-pointer text-sm font-medium">
                    OAuth / SSO
                  </Label>
                </div>
              </div>
              {(methods ?? []).length > 0 ? (
                <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                  <p className="text-xs font-medium text-muted-foreground">Active method tags</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Configured authentication methods">
                    {(methods ?? []).map((tag) => (
                      <li
                        key={tag}
                        className={cn(
                          "rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                          "text-muted-foreground",
                        )}
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect Supabase and open this page in a tenant context to manage sign-in methods via the REST API.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 transition-transform duration-150 hover:scale-[1.02]"
              onClick={() => setBackupOpen(true)}
              aria-label="View backup codes information"
            >
              <Ticket className="h-4 w-4" aria-hidden />
              Backup codes
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 bg-surface-inner/20 p-1">
            <SecurityPanel onRefresh={onRefresh} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={backupOpen} onOpenChange={setBackupOpen}>
        <DialogContent className="border-border/80 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
              Backup codes
            </DialogTitle>
            <DialogDescription className="text-left text-sm text-muted-foreground">
              This workspace uses TOTP-based two-factor authentication. One-time backup codes are not stored in the
              browser for security. If you lose your authenticator device, contact a tenant administrator to reset MFA
              after identity verification.
            </DialogDescription>
          </DialogHeader>
          <Button type="button" variant="cta" size="sm" onClick={() => setBackupOpen(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
