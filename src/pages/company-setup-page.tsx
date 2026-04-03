import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { DepartmentRow } from "@/components/tenancy/department-row";
import { OnboardingWizardStep } from "@/components/tenancy/onboarding-wizard-step";
import { PillTag } from "@/components/tenancy/pill-tag";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import {
  useApplyOnboardingCompanyMutation,
  useOnboardingTemplatesQuery,
} from "@/hooks/use-tenants-module";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { OnboardingTemplateRow } from "@/types/tenancy";

const TOTAL_STEPS = 5;

const departmentSchema = z.object({ name: z.string().min(1, "Required") });

const formSchema = z.object({
  legalName: z.string().min(2),
  displayName: z.string().min(2),
  country: z.string().max(120).optional(),
  timezone: z.string(),
  currency: z.string(),
  departments: z.array(departmentSchema).min(1, "Add at least one department"),
  templateId: z.string().uuid().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_INTEGRATIONS = [
  { key: "slack", label: "Slack" },
  { key: "hubspot", label: "HubSpot" },
  { key: "google", label: "Google Drive / Calendar" },
  { key: "quickbooks", label: "QuickBooks" },
] as const;

function templateIntegrationKeys(tpl: OnboardingTemplateRow | undefined): string[] {
  if (!tpl || !tpl.data || typeof tpl.data !== "object") return [];
  const d = tpl.data as Record<string, unknown>;
  const raw = d.integrations ?? d.suggestedIntegrations;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

export default function CompanySetupPage() {
  const navigate = useNavigate();
  const { session, tenant } = useAuth();
  const [step, setStep] = useState(0);
  const [integrationKeys, setIntegrationKeys] = useState<string[]>([
    "slack",
    "hubspot",
  ]);

  const templatesQuery = useOnboardingTemplatesQuery("onboarding", true);
  const templates = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];

  const applyMutation = useApplyOnboardingCompanyMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      legalName: "",
      displayName: "",
      country: "",
      timezone: "America/New_York",
      currency: "USD",
      departments: [{ name: "Revenue" }, { name: "Product" }, { name: "Operations" }],
      templateId: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "departments",
  });

  const templateId = form.watch("templateId");
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId],
  );

  const progress = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  const toggleIntegration = (key: string, on: boolean) => {
    setIntegrationKeys((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (on) return cur.includes(key) ? cur : [...cur, key];
      return cur.filter((k) => k !== key);
    });
  };

  const onApplyTemplate = (id: string | undefined) => {
    form.setValue("templateId", id);
    const tpl = templates.find((t) => t.id === id);
    const keys = templateIntegrationKeys(tpl);
    if (keys.length > 0) setIntegrationKeys(keys);
    const d =
      tpl?.data && typeof tpl.data === "object"
        ? (tpl.data as Record<string, unknown>)
        : {};
    const depts = d.defaultDepartments ?? d.departments;
    if (Array.isArray(depts) && depts.every((x) => typeof x === "string")) {
      form.setValue(
        "departments",
        (depts as string[]).map((name) => ({ name })),
      );
    }
  };

  const submitFinal = form.handleSubmit(async (values) => {
    const departmentNames = (values.departments ?? [])
      .map((d) => d.name.trim())
      .filter((n) => n.length > 0);
    const res = await applyMutation.mutateAsync({
      legalName: values.legalName.trim(),
      displayName: values.displayName.trim(),
      country: values.country?.trim() || undefined,
      timezone: values.timezone,
      currency: values.currency,
      departmentNames,
      templateId: values.templateId,
      suggestedIntegrationKeys: integrationKeys,
    });
    if (!res) {
      toast.error("Could not save company setup", {
        description: "Sign in with a company admin account and try again.",
      });
      return;
    }
    toast.success("Company setup complete", {
      description: `${res.departmentsCreated} new department(s) added.`,
    });
    navigate("/onboarding/integrations", { replace: true });
  });

  const needsAuth = isSupabaseConfigured && !session;

  return (
    <PublicChrome>
      <AnimatedPage className="px-6 py-16 lg:px-24">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="space-y-4 lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Onboarding
              </p>
              <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
                Company <span className="text-primary">setup</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                Configure your tenant profile, operating context, and department
                structure. Suggested integrations prepare the next connect step.
              </p>
              <div className="flex flex-wrap gap-2">
                <PillTag variant="accent">Tenant-scoped</PillTag>
                <PillTag>RLS enforced</PillTag>
                {tenant?.name ? (
                  <PillTag variant="success">{tenant.name}</PillTag>
                ) : null}
              </div>
            </div>
            <Card className="border-border/80 bg-card/95 shadow-card lg:col-span-5">
              <CardHeader>
                <CardTitle className="text-lg">Progress</CardTitle>
                <CardDescription>
                  Complete all steps before connecting integrations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={progress} className="h-2 bg-surface-inner" />
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "Company profile",
                    "Locale",
                    "Departments",
                    "Templates & connectors",
                    "Review",
                  ].map((label, i) => (
                    <li
                      key={label}
                      className={cn(
                        "flex items-center gap-2",
                        i === step && "font-medium text-primary",
                        i < step && "text-success",
                      )}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-[10px]">
                        {i < step ? "✓" : i + 1}
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {needsAuth ? (
            <Card className="border-border/80 bg-card/95">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Sign in to save company setup to your tenant.
                </p>
                <Button className="mt-4" variant="cta" asChild>
                  <Link to="/login">Go to login</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Form {...form}>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (step < TOTAL_STEPS - 1) {
                    const fieldsByStep: (keyof FormValues)[][] = [
                      ["legalName", "displayName", "country"],
                      ["timezone", "currency"],
                      ["departments"],
                      [],
                      [],
                    ];
                    const toValidate = fieldsByStep[step] ?? [];
                    const ok =
                      toValidate.length === 0 ||
                      (await form.trigger(toValidate as never));
                    if (ok) setStep((s) => s + 1);
                    return;
                  }
                  void submitFinal();
                }}
                className="space-y-6"
              >
                {step === 0 ? (
                  <OnboardingWizardStep
                    step={1}
                    total={TOTAL_STEPS}
                    title="Company profile"
                    description="Legal and display names establish your tenant record and executive dashboards."
                  >
                    <FormField
                      control={form.control}
                      name="legalName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal company name</FormLabel>
                          <FormControl>
                            <Input className="bg-surface-inner border-border/60" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display name</FormLabel>
                          <FormControl>
                            <Input className="bg-surface-inner border-border/60" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country (optional)</FormLabel>
                          <FormControl>
                            <Input
                              className="bg-surface-inner border-border/60"
                              placeholder="e.g. United States"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </OnboardingWizardStep>
                ) : null}

                {step === 1 ? (
                  <OnboardingWizardStep
                    step={2}
                    total={TOTAL_STEPS}
                    title="Timezone & currency"
                    description="Operating context for schedules, billing views, and workflow SLAs."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timezone</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-surface-inner border-border/60">
                                  <SelectValue placeholder="Select timezone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="America/New_York">
                                  America/New_York
                                </SelectItem>
                                <SelectItem value="Europe/London">
                                  Europe/London
                                </SelectItem>
                                <SelectItem value="Asia/Singapore">
                                  Asia/Singapore
                                </SelectItem>
                                <SelectItem value="UTC">UTC</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-surface-inner border-border/60">
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </OnboardingWizardStep>
                ) : null}

                {step === 2 ? (
                  <OnboardingWizardStep
                    step={3}
                    total={TOTAL_STEPS}
                    title="Departments"
                    description="Seed department workspaces; duplicates are skipped automatically."
                  >
                    <div className="space-y-2">
                      {fields.map((f, index) => (
                        <DepartmentRow
                          key={f.id}
                          index={index}
                          value={form.watch(`departments.${index}.name`)}
                          onChange={(v) =>
                            form.setValue(`departments.${index}.name`, v)
                          }
                          onRemove={() => remove(index)}
                          canRemove={fields.length > 1}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-primary/30"
                      onClick={() => append({ name: "" })}
                    >
                      Add department
                    </Button>
                  </OnboardingWizardStep>
                ) : null}

                {step === 3 ? (
                  <OnboardingWizardStep
                    step={4}
                    total={TOTAL_STEPS}
                    title="Templates & suggested integrations"
                    description="Apply an onboarding template to pre-fill departments and connector priorities."
                  >
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Templates (optional)
                      </p>
                      {templatesQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      ) : templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No templates published yet. Continue with defaults
                          below.
                        </p>
                      ) : (
                        <div className="grid gap-2">
                          <Button
                            type="button"
                            variant={!templateId ? "secondary" : "outline"}
                            className="justify-start border-border/60"
                            onClick={() => onApplyTemplate(undefined)}
                          >
                            No template
                          </Button>
                          {templates.map((t) => (
                            <Button
                              key={t.id}
                              type="button"
                              variant={templateId === t.id ? "cta" : "outline"}
                              className="justify-start border-border/60"
                              onClick={() => onApplyTemplate(t.id)}
                            >
                              {t.name}{" "}
                              <span className="ml-2 text-xs text-muted-foreground">
                                v{t.version}
                              </span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 border-t border-border/60 pt-4">
                      <p className="text-sm font-medium text-foreground">
                        Suggested integrations
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {DEFAULT_INTEGRATIONS.map((item) => (
                          <label
                            key={item.key}
                            className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-surface-inner/50 p-3 transition-all duration-150 hover:border-primary/30"
                          >
                            <Checkbox
                              checked={integrationKeys.includes(item.key)}
                              onCheckedChange={(c) =>
                                toggleIntegration(item.key, c === true)
                              }
                            />
                            <span className="text-sm">{item.label}</span>
                          </label>
                        ))}
                      </div>
                      {selectedTemplate ? (
                        <p className="text-xs text-muted-foreground">
                          Template also recommends:{" "}
                          {templateIntegrationKeys(selectedTemplate).join(", ") ||
                            "—"}
                        </p>
                      ) : null}
                    </div>
                  </OnboardingWizardStep>
                ) : null}

                {step === 4 ? (
                  <OnboardingWizardStep
                    step={5}
                    total={TOTAL_STEPS}
                    title="Review & confirm"
                    description="Writes company profile, seeds new departments, and stores integration suggestions for the connect wizard."
                  >
                    <ul className="rounded-xl border border-border/60 bg-surface-inner/40 p-4 text-sm text-muted-foreground">
                      <li>
                        <strong className="text-foreground">Legal:</strong>{" "}
                        {form.watch("legalName")}
                      </li>
                      <li>
                        <strong className="text-foreground">Display:</strong>{" "}
                        {form.watch("displayName")}
                      </li>
                      <li>
                        <strong className="text-foreground">Locale:</strong>{" "}
                        {form.watch("timezone")} · {form.watch("currency")}
                      </li>
                      <li>
                        <strong className="text-foreground">Departments:</strong>{" "}
                        {(form.watch("departments") ?? [])
                          .map((d) => d.name)
                          .join(", ")}
                      </li>
                      <li>
                        <strong className="text-foreground">Integrations:</strong>{" "}
                        {integrationKeys.join(", ")}
                      </li>
                    </ul>
                  </OnboardingWizardStep>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {step > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-border/60"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      Back
                    </Button>
                  ) : null}
                  {step < TOTAL_STEPS - 1 ? (
                    <Button type="submit" variant="cta">
                      Continue
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="cta"
                      disabled={applyMutation.isPending}
                    >
                      {applyMutation.isPending ? "Saving…" : "Finish setup"}
                    </Button>
                  )}
                  <Button type="button" variant="ghost" asChild>
                    <Link to="/onboarding/integrations">Skip to integrations</Link>
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </AnimatedPage>
    </PublicChrome>
  );
}
