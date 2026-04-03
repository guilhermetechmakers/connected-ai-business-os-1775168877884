import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
  tenantDomain: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword, isConfigured } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const from =
    (location.state as { from?: string } | null)?.from && String((location.state as { from?: string }).from).startsWith("/")
      ? (location.state as { from: string }).from
      : "/dashboard";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", tenantDomain: "" },
  });

  const redirectTarget = `${window.location.origin}${from}`;

  const onSubmit = async (values: FormValues) => {
    if (!isConfigured) {
      toast.error("Supabase is not configured", {
        description: "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sign in.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await signInWithPassword({
        email: values.email,
        password: values.password,
        tenantDomain: values.tenantDomain?.trim() || undefined,
      });
      if (!result.ok) {
        if (result.code === "email_unverified") {
          toast.error("Verify your email first", { description: result.error });
          navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
          return;
        }
        toast.error(result.error ?? "Sign-in failed");
        return;
      }
      toast.success("Signed in");
      navigate(from, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const oauthSignIn = async (provider: "google" | "azure") => {
    if (!isConfigured) {
      toast.message("OAuth requires Supabase", {
        description: "Configure the Supabase project and enabled providers.",
      });
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTarget },
    });
    if (error) toast.error(error.message);
  };

  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-card transition-transform duration-150 hover:-translate-y-1">
          <CardHeader className="space-y-2">
            <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Tenant-aware sign-in with SSO-ready hooks. Use your work email for the correct
              workspace context.
            </CardDescription>
            {!isConfigured ? (
              <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                Demo: configure Supabase env vars to enable real authentication and dashboard
                protection.
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-surface-inner">
                <TabsTrigger value="password">Email</TabsTrigger>
                <TabsTrigger value="sso">SSO / OAuth</TabsTrigger>
              </TabsList>
              <TabsContent value="sso" className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  OAuth uses your Supabase project&apos;s enabled providers. SAML/OIDC is routed
                  through the auth Edge Function when configured.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full transition-transform duration-150 hover:scale-[1.02]"
                    onClick={() => void oauthSignIn("google")}
                  >
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full transition-transform duration-150 hover:scale-[1.02]"
                    onClick={() => void oauthSignIn("azure")}
                  >
                    Microsoft
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() =>
                    toast.message("Enterprise SSO", {
                      description:
                        "Map your IdP in tenant sso_settings and complete SAML ACS on the gateway.",
                    })
                  }
                >
                  Enterprise SAML / OIDC
                </Button>
              </TabsContent>
              <TabsContent value="password" className="space-y-4 pt-2">
                <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                  <Separator className="flex-1" />
                  password
                  <Separator className="flex-1" />
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="tenantDomain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant domain hint (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="acme.co"
                              autoComplete="organization"
                              className="bg-surface-inner"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              autoComplete="email"
                              placeholder="you@company.com"
                              className="bg-surface-inner"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Password</FormLabel>
                            <Link
                              to="/password-reset"
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Forgot password?
                            </Link>
                          </div>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="current-password"
                              className="bg-surface-inner"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full transition-transform duration-150 hover:scale-[1.02]"
                      variant="cta"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Signing in…" : "Sign in"}
                    </Button>
                  </form>
                </Form>
                <p className="text-center text-[11px] text-muted-foreground">
                  MFA: TOTP/WebAuthn hooks are available on the auth Edge Function (
                  <span className="font-mono">mfa.status</span>).
                </p>
              </TabsContent>
            </Tabs>
            <p className="text-center text-sm text-muted-foreground">
              New tenant?{" "}
              <Link to="/auth/signup-invite" className="font-medium text-primary hover:underline">
                Create workspace
              </Link>
            </p>
          </CardContent>
        </Card>
      </AnimatedPage>
    </PublicChrome>
  );
}
