import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invokeAuthApi } from "@/lib/auth-api";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function EmailVerificationPage() {
  const [params] = useSearchParams();
  const tokenFromUrl = params.get("token") ?? "";
  const nextPath = params.get("next")?.trim() || "/onboarding/company";
  const [tokenInput, setTokenInput] = useState(tokenFromUrl);
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user?.email_confirmed_at) {
        setSessionVerified(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      return invokeAuthApi<{ ok: boolean }>(
        { op: "verify.email", token: token.trim() },
        { skipAuthHeader: true },
      );
    },
    onSuccess: () => {
      toast.success("Email verified");
      setSessionVerified(true);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const isSuccess = sessionVerified || verifyMutation.isSuccess;

  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <Card className="w-full max-w-lg border-border/80 bg-card/95 shadow-card transition-transform duration-150 hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {isSuccess ? "Email verified" : "Verify your email"}
            </CardTitle>
            <CardDescription>
              {isSuccess
                ? "Your account is confirmed. Continue onboarding to connect data and invite your team."
                : "Paste the token from your verification email, or open the magic link on this device."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSuccess ? (
              <>
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                  Link expired or invalid? Request a fresh token from your administrator or use the
                  token field below.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verify-token">Verification token</Label>
                  <Input
                    id="verify-token"
                    className="bg-surface-inner"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste token from email"
                    autoComplete="one-time-code"
                  />
                </div>
                <Button
                  type="button"
                  variant="cta"
                  className="w-full transition-transform duration-150 hover:scale-[1.02]"
                  disabled={!tokenInput.trim() || verifyMutation.isPending}
                  onClick={() => verifyMutation.mutate(tokenInput)}
                >
                  {verifyMutation.isPending ? "Verifying…" : "Verify email"}
                </Button>
              </>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button variant="cta" asChild>
                <Link to={nextPath.startsWith("/") ? nextPath : "/onboarding/company"}>
                  Continue setup
                </Link>
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  toast.message("Resend email", {
                    description:
                      "Trigger resend from Supabase Auth admin or your notifications Edge Function.",
                  })
                }
              >
                Resend email
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedPage>
    </PublicChrome>
  );
}
