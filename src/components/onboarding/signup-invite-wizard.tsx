import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/auth-context";
import { invokeAuthApi } from "@/lib/auth-api";

const schema = z
  .object({
    tenantName: z.string().max(200).optional(),
    industry: z.string().max(120).optional(),
    domainHint: z.string().optional(),
    fullName: z.string().min(2, "Name required"),
    email: z.string().email(),
    password: z.string().min(10, "Use at least 10 characters"),
    inviteToken: z.string().optional(),
    acceptTerms: z.boolean().refine((v) => v, {
      message: "Accept terms to continue",
    }),
  })
  .refine(
    (d) =>
      Boolean(d.inviteToken?.trim()) ||
      (d.tenantName !== undefined && d.tenantName.trim().length >= 2),
    { message: "Company name required", path: ["tenantName"] },
  );

export type SignupInviteFormValues = z.infer<typeof schema>;

interface SignupInviteWizardProps {
  variant?: "signup" | "onboarding";
}

export function SignupInviteWizard({ variant = "signup" }: SignupInviteWizardProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteFromUrl = params.get("invite") ?? "";
  const { signUp, isConfigured } = useAuth();
  const [invitePreview, setInvitePreview] = useState<{
    companyName: string | null;
    email: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SignupInviteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantName: "",
      industry: "",
      domainHint: "",
      fullName: "",
      email: "",
      password: "",
      inviteToken: inviteFromUrl,
      acceptTerms: false,
    },
  });

  useEffect(() => {
    const token = inviteFromUrl.trim();
    if (!token || !isConfigured) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await invokeAuthApi<{
          email: string;
          companyId: string;
          companyName: string | null;
        }>({ op: "invitations.resolve", token }, { skipAuthHeader: true });
        if (cancelled) return;
        setInvitePreview({
          email: data.email,
          companyName: data.companyName,
        });
        form.setValue("email", data.email);
        if (data.companyName) {
          form.setValue("tenantName", data.companyName);
        }
      } catch {
        if (!cancelled) {
          setInvitePreview(null);
          toast.error("Invite could not be loaded", {
            description: "Check the token or ask your admin for a new invite.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteFromUrl, isConfigured, form]);

  const onSubmit = async (values: SignupInviteFormValues) => {
    if (!isConfigured) {
      toast.error("Supabase is not configured");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await signUp({
        tenantName:
          values.tenantName?.trim() || invitePreview?.companyName || "Workspace",
        industry: values.industry?.trim() || undefined,
        domainHint: values.domainHint?.trim() || undefined,
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        inviteToken: values.inviteToken?.trim() || undefined,
        acceptTerms: values.acceptTerms,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Signup failed");
        return;
      }
      toast.success("Workspace created", {
        description: "Verify your email to activate the account.",
      });
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pwd = form.watch("password");
  const strength = Math.min(100, (pwd?.length ?? 0) * 8);

  const isOnboarding = variant === "onboarding";

  return (
    <Card
      className={`w-full max-w-xl border-border/80 bg-card/95 shadow-card transition-transform duration-150 hover:-translate-y-1 ${isOnboarding ? "border-primary/20" : ""}`}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display text-2xl">
              {isOnboarding ? "Sign up / invite acceptance" : "Create your workspace"}
            </CardTitle>
            <CardDescription>
              {isOnboarding
                ? "Unified flow: new tenant creation or invite token for the initial admin."
                : "Tenant creation or invite acceptance for the initial admin."}
            </CardDescription>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            <p>Step 1 of 3</p>
            <Progress value={33} className="mt-2 h-1 w-28" />
          </div>
        </div>
        {invitePreview ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Invited to{" "}
            <Badge variant="secondary" className="font-normal">
              {invitePreview.companyName ?? "workspace"}
            </Badge>
            <span className="text-[10px]">({invitePreview.email})</span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="tenantName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant / company name</FormLabel>
                    <FormControl>
                      <Input
                        className="bg-surface-inner"
                        disabled={Boolean(invitePreview)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Technology"
                        className="bg-surface-inner"
                        disabled={Boolean(invitePreview)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="domainHint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suggested domain (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="acme.connected.ai"
                        className="bg-surface-inner"
                        disabled={Boolean(invitePreview)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="inviteToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invite token</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Paste invite token if you have one"
                        className="bg-surface-inner"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave blank to create a new tenant as the owner.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin full name</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" {...field} />
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
                        className="bg-surface-inner"
                        readOnly={Boolean(invitePreview)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" className="bg-surface-inner" {...field} />
                  </FormControl>
                  <Progress value={strength} className="h-1" aria-hidden />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border border-border/60 bg-surface-inner/60 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Accept terms & data processing</FormLabel>
                    <FormDescription>
                      You agree to our <Link to="/terms">Terms</Link> and{" "}
                      <Link to="/privacy">Privacy</Link> policies.
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="cta"
              className="w-full transition-transform duration-150 hover:scale-[1.02]"
              disabled={isSubmitting || !isConfigured}
            >
              {isSubmitting ? "Creating…" : "Continue to email verification"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
