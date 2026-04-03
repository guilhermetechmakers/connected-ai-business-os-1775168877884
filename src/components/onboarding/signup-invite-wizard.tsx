import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { DomainSuggestions } from "@/components/onboarding/domain-suggestions";
import { LiveIndicator } from "@/components/onboarding/live-indicator";
import { OnboardingNextStepCard } from "@/components/onboarding/onboarding-next-step-card";
import { SignupConfirmDialog } from "@/components/onboarding/signup-confirm-dialog";
import { CurrencySelector } from "@/components/onboarding/currency-selector";
import { TimezoneSelector } from "@/components/onboarding/timezone-selector";
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
import { useDomainSuggestionsQuery } from "@/hooks/use-domain-suggestions";
import { invokeAuthApiEnvelope } from "@/lib/auth-api";
import {
  signupInviteFormSchema,
  signupInviteStepSchemas,
  type SignupInviteFormValues,
} from "@/lib/signup-invite-schema";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 4;

const STEP_TITLES = [
  "Workspace & access",
  "Admin identity",
  "Company defaults",
  "Review & legal",
] as const;

const SIGNUP_SUGGESTED_INTEGRATIONS = [
  { key: "slack", label: "Slack" },
  { key: "hubspot", label: "HubSpot" },
  { key: "google_calendar", label: "Google Calendar" },
  { key: "quickbooks", label: "QuickBooks" },
  { key: "salesforce", label: "Salesforce" },
] as const;

export type SignupInviteWizardProps = {
  variant?: "signup" | "onboarding";
};

export function SignupInviteWizard({ variant = "signup" }: SignupInviteWizardProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteFromUrl = (params.get("invite") ?? "").trim();
  const { signUp, isConfigured } = useAuth();
  const [invitePreview, setInvitePreview] = useState<{
    companyName: string | null;
    email: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<SignupInviteFormValues>({
    resolver: zodResolver(signupInviteFormSchema),
    defaultValues: {
      entryMode: inviteFromUrl ? "invite" : "signup",
      tenantName: "",
      domainHint: "",
      inviteToken: inviteFromUrl,
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      timeZone: "America/New_York",
      currency: "USD",
      departments: [
        { name: "Revenue" },
        { name: "Product" },
        { name: "Operations" },
      ],
      integrationKeys: ["slack", "hubspot"],
      acceptTerms: false,
    },
    mode: "onChange",
  });

  const entryMode = form.watch("entryMode");
  const tenantName = form.watch("tenantName");
  const domainHint = form.watch("domainHint");

  const domainQuery = useDomainSuggestionsQuery(
    tenantName ?? "",
    entryMode === "signup" && step === 0,
  );
  const suggestionList = Array.isArray(domainQuery.data) ? domainQuery.data : [];

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "departments",
  });

  useEffect(() => {
    const token = inviteFromUrl;
    if (!token || !isConfigured) return;
    let cancelled = false;
    void (async () => {
      try {
        const env = await invokeAuthApiEnvelope<{
          email: string;
          companyId: string;
          companyName: string | null;
        }>({ op: "invitations.resolve", token }, { skipAuthHeader: true });
        if (cancelled) return;
        if (env.error || !env.data) {
          setInvitePreview(null);
          toast.error("Invite could not be loaded", {
            description: env.error?.message ?? "Check the token or ask your admin for a new invite.",
          });
          return;
        }
        const data = env.data;
        setInvitePreview({
          email: data.email,
          companyName: data.companyName,
        });
        form.setValue("email", data.email);
        form.setValue("entryMode", "invite");
        form.setValue("inviteToken", token);
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

  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  const isOnboarding = variant === "onboarding";

  const wTenant = form.watch("tenantName");
  const wDomain = form.watch("domainHint");
  const wFirst = form.watch("firstName");
  const wLast = form.watch("lastName");
  const wEmail = form.watch("email");
  const wTz = form.watch("timeZone");
  const wCur = form.watch("currency");
  const wDepts = form.watch("departments");
  const wInts = form.watch("integrationKeys");
  const wMode = form.watch("entryMode");

  const summaryLines = useMemo(() => {
    const depts = Array.isArray(wDepts) ? wDepts : [];
    const names = depts
      .map((d) => d?.name?.trim())
      .filter((n): n is string => Boolean(n && n.length > 0));
    const ints = Array.isArray(wInts) ? wInts : [];
    return [
      wMode === "signup"
        ? `New workspace: ${wTenant?.trim() || "—"}`
        : `Invite acceptance for: ${invitePreview?.companyName ?? wTenant?.trim() ?? "workspace"}`,
      wDomain?.trim() ? `Domain hint: ${wDomain.trim()}` : "Domain hint: (not set)",
      `Admin: ${wFirst} ${wLast} · ${wEmail}`,
      `Locale: ${wTz} · ${wCur}`,
      `Departments: ${names.length ? names.join(", ") : "—"}`,
      `Suggested integrations: ${ints.length ? ints.join(", ") : "—"}`,
    ];
  }, [
    invitePreview,
    wCur,
    wDepts,
    wDomain,
    wEmail,
    wFirst,
    wInts,
    wLast,
    wMode,
    wTenant,
    wTz,
  ]);

  async function runSignup(values: SignupInviteFormValues) {
    if (!isConfigured) {
      toast.error("Supabase is not configured");
      return;
    }
    setIsSubmitting(true);
    try {
      const departments = (values.departments ?? [])
        .map((d) => d.name.trim())
        .filter((n) => n.length > 0);
      const integrations = Array.isArray(values.integrationKeys) ? values.integrationKeys : [];

      const result = await signUp({
        tenantName:
          values.tenantName?.trim() || invitePreview?.companyName || "Workspace",
        domainHint: values.domainHint?.trim() || undefined,
        fullName: `${values.firstName} ${values.lastName}`.trim(),
        email: values.email,
        password: values.password,
        inviteToken: values.inviteToken?.trim() || undefined,
        acceptTerms: values.acceptTerms,
        companyProfile: {
          timeZone: values.timeZone,
          currency: values.currency,
          departments,
          integrations,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "Signup failed");
        return;
      }
      toast.success(
        values.entryMode === "invite" ? "Invitation accepted" : "Workspace created",
        {
          description: "Verify your email to continue company setup.",
        },
      );
      const next = encodeURIComponent("/onboarding/company");
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}&next=${next}`);
    } finally {
      setIsSubmitting(false);
      setConfirmOpen(false);
    }
  }

  const goNext = async () => {
    const schema = signupInviteStepSchemas[step];
    if (!schema) return;
    const r = schema.safeParse(form.getValues());
    if (!r.success) {
      for (const iss of r.error.issues) {
        const p = iss.path[0];
        if (typeof p === "string") {
          form.setError(p as keyof SignupInviteFormValues, { message: iss.message });
        }
      }
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const pwd = form.watch("password");
  const strength = Math.min(100, (pwd?.length ?? 0) * 8);

  const onFinalSubmit = form.handleSubmit(async (values) => {
    if (values.entryMode === "invite") {
      setConfirmOpen(true);
      return;
    }
    await runSignup(values);
  });

  return (
    <>
      <Card
        className={cn(
          "w-full border-border/80 bg-card/95 shadow-card transition-all duration-150 hover:shadow-card-hover",
          isOnboarding && "border-secondary/30",
        )}
      >
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="font-display text-2xl md:text-3xl">
                  {isOnboarding ? "Sign up / invite acceptance" : "Create your workspace"}
                </CardTitle>
                <LiveIndicator label="Onboarding" />
              </div>
              <CardDescription className="max-w-prose text-base">
                {isOnboarding
                  ? "Provision a new tenant or accept an invite as the initial admin. All data stays tenant-scoped."
                  : "Multi-step onboarding: workspace details, admin account, company defaults, then review."}
              </CardDescription>
            </div>
            <div
              className="w-full max-w-xs space-y-2 text-right sm:w-auto"
              role="status"
              aria-live="polite"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {STEP_TITLES[step] ?? "Progress"}
              </p>
              <Progress value={progressPct} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                Step {step + 1} of {TOTAL_STEPS}
              </p>
            </div>
          </div>

          {invitePreview ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-xs text-muted-foreground">
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
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (step < TOTAL_STEPS - 1) return;
                void onFinalSubmit(e);
              }}
            >
              <div
                key={step}
                className="animate-fade-in-up space-y-6"
              >
                {step === 0 ? (
                  <div className="space-y-6">
                    {!inviteFromUrl ? (
                      <FormField
                        control={form.control}
                        name="entryMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>How are you joining?</FormLabel>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant={field.value === "signup" ? "cta" : "outline"}
                                className="rounded-full transition-transform duration-150 hover:scale-[1.02]"
                                onClick={() => {
                                  field.onChange("signup");
                                  form.setValue("inviteToken", "");
                                }}
                              >
                                New workspace
                              </Button>
                              <Button
                                type="button"
                                variant={field.value === "invite" ? "cta" : "outline"}
                                className="rounded-full transition-transform duration-150 hover:scale-[1.02]"
                                onClick={() => field.onChange("invite")}
                              >
                                Accept invite
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}

                    {entryMode === "signup" ? (
                      <>
                        <FormField
                          control={form.control}
                          name="tenantName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company / tenant name</FormLabel>
                              <FormControl>
                                <Input className="bg-surface-inner focus-visible:glow-ring-focus" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="domainHint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Suggested workspace domain</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="acme.connected.ai"
                                  className="bg-surface-inner"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Used as a DNS hint for your tenant; must be unique across workspaces.
                              </FormDescription>
                              <DomainSuggestions
                                baseLabel={tenantName ?? ""}
                                suggestions={suggestionList}
                                selected={domainHint || undefined}
                                onSelect={(d) => form.setValue("domainHint", d, { shouldValidate: true })}
                                isLoading={domainQuery.isFetching}
                                disabled={Boolean(invitePreview)}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    ) : (
                      <FormField
                        control={form.control}
                        name="inviteToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Invite token</FormLabel>
                            <FormControl>
                              <Input
                                className="bg-surface-inner"
                                readOnly={Boolean(inviteFromUrl)}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Paste the token from your administrator if it&apos;s not in the URL.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name</FormLabel>
                          <FormControl>
                            <Input className="bg-surface-inner" autoComplete="given-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last name</FormLabel>
                          <FormControl>
                            <Input className="bg-surface-inner" autoComplete="family-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Work email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              className="bg-surface-inner"
                              readOnly={Boolean(invitePreview)}
                              autoComplete="email"
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              className="bg-surface-inner"
                              autoComplete="new-password"
                              {...field}
                            />
                          </FormControl>
                          <Progress value={strength} className="h-1" aria-hidden />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              className="bg-surface-inner"
                              autoComplete="new-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <TimezoneSelector control={form.control} name="timeZone" label="Time zone" />
                      <CurrencySelector control={form.control} name="currency" label="Default currency" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>Initial departments</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => append({ name: "" })}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add
                        </Button>
                      </div>
                      <ul className="space-y-2" role="list">
                        {(fields ?? []).map((f, index) => (
                          <li key={f.id} className="flex gap-2">
                            <FormField
                              control={form.control}
                              name={`departments.${index}.name`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input
                                      className="bg-surface-inner"
                                      placeholder="Department name"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              disabled={fields.length <= 1}
                              onClick={() => remove(index)}
                              aria-label={`Remove department ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <FormField
                      control={form.control}
                      name="integrationKeys"
                      render={({ field }) => {
                        const selected = Array.isArray(field.value) ? field.value : [];
                        return (
                          <FormItem>
                            <FormLabel>Suggested core integrations</FormLabel>
                            <FormDescription>
                              Stored as recommendations for the integration wizard — nothing connects yet.
                            </FormDescription>
                            <div className="flex flex-wrap gap-2">
                              {(SIGNUP_SUGGESTED_INTEGRATIONS ?? []).map(({ key, label }) => {
                                const on = selected.includes(key);
                                return (
                                  <Button
                                    key={key}
                                    type="button"
                                    size="sm"
                                    variant={on ? "secondary" : "outline"}
                                    className={cn(
                                      "rounded-full text-xs transition-transform duration-150",
                                      on && "border-primary/40 bg-primary/10 text-primary",
                                    )}
                                    onClick={() => {
                                      const next = on
                                        ? selected.filter((k) => k !== key)
                                        : [...selected, key];
                                      field.onChange(next);
                                    }}
                                  >
                                    {label}
                                  </Button>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-6">
                    <OnboardingNextStepCard
                      currentStepIndex={step}
                      totalSteps={TOTAL_STEPS}
                      summaryLines={summaryLines}
                      nextLabel="Email verification, then company setup (profile, logo, integrations)."
                    />
                    <FormField
                      control={form.control}
                      name="acceptTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-xl border border-border/60 bg-surface-inner/60 p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(v) => field.onChange(v === true)}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Accept terms & data processing</FormLabel>
                            <FormDescription>
                              You agree to our <Link to="/terms" className="text-primary underline-offset-4 hover:underline">Terms</Link>{" "}
                              and{" "}
                              <Link to="/privacy" className="text-primary underline-offset-4 hover:underline">Privacy</Link> policies.
                            </FormDescription>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={step === 0 || isSubmitting}
                  onClick={goBack}
                >
                  Back
                </Button>
                <div className="flex flex-wrap gap-2">
                  {step < TOTAL_STEPS - 1 ? (
                    <Button
                      type="button"
                      variant="cta"
                      className="rounded-full px-8 transition-transform duration-150 hover:scale-[1.02]"
                      onClick={() => void goNext()}
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="cta"
                      className="rounded-full px-8 transition-transform duration-150 hover:scale-[1.02]"
                      disabled={isSubmitting || !isConfigured}
                    >
                      {isSubmitting
                        ? "Creating…"
                        : form.watch("entryMode") === "invite"
                          ? "Accept invite"
                          : "Create workspace"}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <SignupConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        workspaceLabel={invitePreview?.companyName ?? form.watch("tenantName") ?? "workspace"}
        email={form.watch("email")}
        isLoading={isSubmitting}
        onConfirm={() => {
          void form.handleSubmit((v) => runSignup(v))();
        }}
      />
    </>
  );
}
