import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ErrorBanner } from "@/components/auth/login/error-banner";
import { EmailField } from "@/components/auth/login/email-field";
import { PasswordField } from "@/components/auth/login/password-field";
import { RememberMeToggle } from "@/components/auth/login/remember-me-toggle";
import { SocialAuthBar } from "@/components/auth/login/social-auth-bar";
import { SSOSignInButton } from "@/components/auth/login/sso-sign-in-button";
import { TenantBanner } from "@/components/auth/login/tenant-banner";
import type { OAuthProviderId } from "@/components/auth/login/types";
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
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { startTenantSsoFlow } from "@/lib/auth-api";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  tenantDomain: z.string().max(200).optional(),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export type LoginFormProps = {
  tenantName?: string;
  tenantId?: string;
  oauthProviders?: OAuthProviderId[];
  ssoEnabled?: boolean;
  /** Path after OAuth redirect (must start with /). */
  postAuthRedirectPath?: string;
  onSuccess: () => void;
  onError?: (message: string) => void;
  className?: string;
};

export function LoginForm({
  tenantName,
  tenantId,
  oauthProviders,
  ssoEnabled = false,
  postAuthRedirectPath = "/dashboard/global",
  onSuccess,
  onError,
  className,
}: LoginFormProps) {
  const navigate = useNavigate();
  const { signInWithPassword, signInDemo, isConfigured } = useAuth();
  const [bannerError, setBannerError] = useState<string>("");
  const [bannerVisible, setBannerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ssoBusy, setSsoBusy] = useState(false);

  const providersRaw = Array.isArray(oauthProviders) ? oauthProviders : [];
  const enabledOAuth: OAuthProviderId[] =
    providersRaw.length > 0
      ? providersRaw.filter((p): p is OAuthProviderId => p === "google" || p === "microsoft")
      : ["google", "microsoft"];

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      tenantDomain: "",
      rememberMe: false,
    },
    mode: "onBlur",
  });

  const { control, handleSubmit, formState: { errors } } = form;

  const showError = (msg: string) => {
    const safe = msg.trim() || "Something went wrong. Please try again.";
    setBannerError(safe);
    setBannerVisible(true);
    onError?.(safe);
  };

  const clearError = () => {
    setBannerVisible(false);
    setBannerError("");
  };

  const onValidSubmit = async (values: LoginFormValues) => {
    clearError();
    setIsSubmitting(true);
    try {
      if (!isConfigured) {
        signInDemo({
          email: values.email.trim(),
          rememberMe: values.rememberMe === true,
          tenantName,
          tenantId,
        });
        toast.success("Demo sign-in", {
          description: "Exploring the dashboard without Supabase credentials.",
        });
        onSuccess();
        return;
      }

      const result = await signInWithPassword({
        email: values.email.trim(),
        password: values.password,
        tenantDomain: values.tenantDomain?.trim() || undefined,
        tenantId,
        rememberMe: values.rememberMe === true,
      });

      if (!result.ok) {
        if (result.code === "email_unverified") {
          showError(result.error ?? "Verify your email before signing in.");
          navigate(`/verify-email?email=${encodeURIComponent(values.email.trim())}`);
          return;
        }
        showError(result.error ?? "Sign-in failed.");
        return;
      }

      toast.success("Signed in");
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  const path =
    postAuthRedirectPath.startsWith("/") ? postAuthRedirectPath : `/${postAuthRedirectPath}`;
  const redirectTarget = `${window.location.origin}${path}`;

  const handleOAuth = async (provider: OAuthProviderId) => {
    clearError();
    if (!isConfigured) {
      toast.message("OAuth requires Supabase", {
        description: "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then enable Google or Microsoft in your project.",
      });
      return;
    }
    const supaProvider = provider === "microsoft" ? "azure" : "google";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: supaProvider,
      options: { redirectTo: redirectTarget },
    });
    if (error) showError(error.message);
  };

  const handleSso = async () => {
    clearError();
    if (!isConfigured) {
      toast.message("SSO requires a configured backend", {
        description: "Connect Supabase and configure sso_settings on the tenant record.",
      });
      return;
    }
    const scopedTenantId = typeof tenantId === "string" ? tenantId.trim() : "";
    if (!scopedTenantId) {
      showError(
        "Workspace ID is required for SSO. Use the sign-in link from your administrator or try email instead.",
      );
      return;
    }
    setSsoBusy(true);
    try {
      const res = await startTenantSsoFlow(scopedTenantId);
      const url = typeof res.data?.url === "string" ? res.data.url : "";
      if (!url || res.error) {
        showError(
          res.error?.message ??
            "Could not start single sign-on. Try email sign-in or contact your workspace admin.",
        );
        return;
      }
      window.location.assign(url);
    } finally {
      setSsoBusy(false);
    }
  };

  return (
    <Card
      className={cn(
        "border-white/[0.06] bg-card/95 shadow-card transition-[transform,box-shadow] duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-card-hover",
        className,
      )}
    >
      <CardHeader className="space-y-3">
        <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Welcome <span className="text-primary">back</span>
        </CardTitle>
        <CardDescription className="text-base leading-relaxed text-muted-foreground">
          Enterprise sign-in with tenant-aware routing. Password, OAuth, and SSO share the same
          workspace context.
        </CardDescription>
        <TenantBanner tenantName={tenantName} />
        {!isConfigured ? (
          <p className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-primary">Demo mode:</span> valid email format and a
            non-empty password unlock the global dashboard without Supabase.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <ErrorBanner
          message={bannerError}
          visible={bannerVisible}
          onDismiss={clearError}
          onRetry={() => void handleSubmit(onValidSubmit)()}
        />

        <SocialAuthBar
          enabledProviders={enabledOAuth}
          disabled={isSubmitting || ssoBusy}
          onProviderSignIn={handleOAuth}
        />

        <SSOSignInButton
          ssoEnabled={ssoEnabled}
          disabled={isSubmitting || ssoBusy}
          onSSO={handleSso}
        />

        <div className="relative py-1">
          <Separator className="bg-white/[0.06]" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            or email
          </span>
        </div>

        <form
          className="space-y-4"
          onSubmit={handleSubmit(onValidSubmit)}
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="login-tenant-domain" className="text-foreground">
              Workspace domain hint <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Controller
              name="tenantDomain"
              control={control}
              render={({ field }) => (
                <Input
                  id="login-tenant-domain"
                  placeholder="acme.co"
                  autoComplete="organization"
                  disabled={isSubmitting}
                  className="h-11 border-white/[0.06] bg-surface-inner"
                  {...field}
                />
              )}
            />
            {errors.tenantDomain ? (
              <p className="text-xs text-destructive">{errors.tenantDomain.message}</p>
            ) : null}
          </div>

          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <EmailField
                id="login-email"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
                disabled={isSubmitting}
              />
            )}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="login-password" className="text-foreground">
                Password
              </Label>
              <Link
                to="/password-reset"
                className="text-xs font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <PasswordField
                  id="login-password"
                  hideLabel
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.password?.message}
                  disabled={isSubmitting}
                />
              )}
            />
          </div>

          <Controller
            name="rememberMe"
            control={control}
            render={({ field }) => (
              <RememberMeToggle
                id="login-remember"
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v)}
                disabled={isSubmitting}
              />
            )}
          />

          <Button
            type="submit"
            variant="cta"
            className="h-12 w-full text-sm font-semibold transition-transform duration-150 motion-safe:hover:scale-[1.02]"
            disabled={isSubmitting || ssoBusy}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New tenant?{" "}
          <Link
            to="/auth/signup-invite"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create workspace
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
