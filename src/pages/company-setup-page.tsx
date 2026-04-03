import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { CompanyProfileForm } from "@/components/onboarding/company-profile-form";
import { CurrencySelector } from "@/components/onboarding/currency-selector";
import {
  DepartmentsTemplateEditor,
  type DefaultDepartmentTemplate,
} from "@/components/onboarding/departments-template-editor";
import { IntegrationsSuggestions } from "@/components/onboarding/integrations-suggestions";
import { OnboardingActionBar } from "@/components/onboarding/onboarding-action-bar";
import { OnboardingProgressPanel } from "@/components/onboarding/onboarding-progress-panel";
import { OnboardingWizardStep } from "@/components/tenancy/onboarding-wizard-step";
import { PillTag } from "@/components/tenancy/pill-tag";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { useAuth } from "@/contexts/auth-context";
import {
  useApplyOnboardingCompanyMutation,
  useOnboardingIntegrationSuggestionsQuery,
  useOnboardingTemplatesQuery,
  useUpsertTenantConfigMutation,
} from "@/hooks/use-tenants-module";
import {
  companySetupFormSchema,
  type CompanySetupFormValues,
} from "@/lib/company-setup-form-schema";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { OnboardingTemplateRow } from "@/types/tenancy";
import { TimezoneSelector } from "@/components/onboarding/timezone-selector";

const DRAFT_STORAGE_KEY = "caibos.onboarding.company.v1";

const STEP_LABELS = [
  "Company profile",
  "Locale",
  "Departments",
  "Integrations",
  "Templates",
  "Review",
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

const DEFAULT_DEPARTMENT_TEMPLATES: DefaultDepartmentTemplate[] = [
  { id: "revenue", name: "Revenue", order: 0 },
  { id: "product", name: "Product", order: 1 },
  { id: "operations", name: "Operations", order: 2 },
  { id: "people", name: "People", order: 3 },
];

function templateIntegrationKeys(tpl: OnboardingTemplateRow | undefined): string[] {
  if (!tpl || !tpl.data || typeof tpl.data !== "object") return [];
  const d = tpl.data as Record<string, unknown>;
  const raw = d.integrations ?? d.suggestedIntegrations;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return [];
}

function buildInitialEnabledTemplates(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const t of DEFAULT_DEPARTMENT_TEMPLATES) {
    out[t.id] = true;
  }
  return out;
}

export default function CompanySetupPage() {
  const navigate = useNavigate();
  const { session, tenant } = useAuth();
  const [step, setStep] = useState(0);
  const [integrationKeys, setIntegrationKeys] = useState<string[]>([
    "slack",
    "hubspot",
  ]);
  const [enabledTemplateIds, setEnabledTemplateIds] = useState<Record<string, boolean>>(
    buildInitialEnabledTemplates,
  );

  const templatesQuery = useOnboardingTemplatesQuery("onboarding", true);
  const templates = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];
  const suggestionsQuery = useOnboardingIntegrationSuggestionsQuery(true);
  const suggestions = Array.isArray(suggestionsQuery.data) ? suggestionsQuery.data : [];

  const applyMutation = useApplyOnboardingCompanyMutation();
  const upsertDraftMutation = useUpsertTenantConfigMutation();

  const form = useForm<CompanySetupFormValues>({
    resolver: zodResolver(companySetupFormSchema),
    defaultValues: {
      legalName: "",
      displayName: "",
      country: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      region: "",
      postalCode: "",
      website: "",
      logoUrl: "",
      taxId: "",
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

  const persistDraftLocal = useCallback(
    (
      values: Partial<CompanySetupFormValues>,
      stepIndex: number,
      keys: string[],
      tplEnabled: Record<string, boolean>,
    ) => {
      try {
        const payload = {
          step: stepIndex,
          values,
          integrationKeys: keys,
          enabledTemplateIds: tplEnabled,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore quota */
      }
    },
    [],
  );

  const draftLoadedRef = useRef(false);

  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        step?: number;
        values?: Partial<CompanySetupFormValues>;
        integrationKeys?: string[];
        enabledTemplateIds?: Record<string, boolean>;
      };
      if (typeof parsed.step === "number" && parsed.step >= 0 && parsed.step < TOTAL_STEPS) {
        setStep(parsed.step);
      }
      if (parsed.values && typeof parsed.values === "object") {
        form.reset({ ...form.getValues(), ...parsed.values });
      }
      if (Array.isArray(parsed.integrationKeys)) {
        setIntegrationKeys(parsed.integrationKeys);
      }
      if (parsed.enabledTemplateIds && typeof parsed.enabledTemplateIds === "object") {
        setEnabledTemplateIds({ ...buildInitialEnabledTemplates(), ...parsed.enabledTemplateIds });
      }
    } catch {
      /* ignore */
    }
  }, [form]);

  const saveDraft = useCallback(async () => {
    const values = form.getValues();
    persistDraftLocal(values, step, integrationKeys, enabledTemplateIds);
    if (isSupabaseConfigured && session) {
      await upsertDraftMutation.mutateAsync({
        configKey: "onboarding.wizard.draft",
        configValue: {
          step,
          formSnapshot: values,
          integrationKeys,
          enabledTemplateIds,
        },
      });
    }
    toast.success("Draft saved", {
      description: "Resume anytime from this device or your tenant config.",
    });
  }, [
    form,
    step,
    integrationKeys,
    enabledTemplateIds,
    persistDraftLocal,
    session,
    upsertDraftMutation,
  ]);

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

  const mergeDepartmentNames = (values: CompanySetupFormValues): string[] => {
    const fromTemplates = DEFAULT_DEPARTMENT_TEMPLATES.filter(
      (t) => enabledTemplateIds[t.id] !== false,
    ).map((t) => t.name);
    const fromFields = (values.departments ?? [])
      .map((d) => d.name.trim())
      .filter((n) => n.length > 0);
    return Array.from(new Set([...fromTemplates, ...fromFields]));
  };

  const submitFinal = form.handleSubmit(async (values) => {
    const departmentNames = mergeDepartmentNames(values);
    if (departmentNames.length === 0) {
      toast.error("Add at least one department");
      return;
    }
    const res = await applyMutation.mutateAsync({
      legalName: values.legalName.trim(),
      displayName: values.displayName.trim(),
      country: values.country?.trim() || undefined,
      timezone: values.timezone,
      currency: values.currency,
      departmentNames,
      templateId: values.templateId,
      suggestedIntegrationKeys: integrationKeys,
      addressLine1: values.addressLine1?.trim() || undefined,
      addressLine2: values.addressLine2?.trim() || undefined,
      city: values.city?.trim() || undefined,
      region: values.region?.trim() || undefined,
      postalCode: values.postalCode?.trim() || undefined,
      website: values.website?.trim() || undefined,
      logoUrl: values.logoUrl?.trim() || undefined,
      taxId: values.taxId?.trim() || undefined,
    });
    if (!res) {
      toast.error("Could not save company setup", {
        description: "Sign in with a company admin account and try again.",
      });
      return;
    }
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    toast.success("Company setup complete", {
      description: `${res.departmentsCreated} new department(s) added. Next: connect integrations.`,
    });
    navigate("/onboarding/integrations?welcome=1", { replace: true });
  });

  const needsAuth = isSupabaseConfigured && !session;

  const fieldsByStep: (keyof CompanySetupFormValues)[][] = useMemo(
    () => [
      [
        "legalName",
        "displayName",
        "addressLine1",
        "addressLine2",
        "city",
        "region",
        "postalCode",
        "country",
        "website",
        "logoUrl",
        "taxId",
      ],
      ["timezone", "currency"],
      ["departments"],
      [],
      [],
      [],
    ],
    [],
  );

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < TOTAL_STEPS - 1) {
      const toValidate = fieldsByStep[step] ?? [];
      const ok =
        toValidate.length === 0 ||
        (await form.trigger(toValidate as never));
      if (ok) setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
      return;
    }
    void submitFinal();
  };

  return (
    <PublicChrome>
      <AnimatedPage className="relative overflow-hidden px-6 py-16 lg:px-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          aria-hidden
        >
          <div className="absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgb(7,18,40)_0%,rgb(11,26,42)_45%,transparent_70%)] blur-2xl" />
        </div>
        <div className="relative mx-auto max-w-6xl space-y-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <div className="space-y-4 lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Onboarding
              </p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Company <span className="text-primary">setup</span>
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                Configure your tenant profile, operating context, departments, and
                integration priorities. Save a draft anytime—progress is restored on
                return.
              </p>
              <div className="flex flex-wrap gap-2">
                <PillTag variant="accent">Tenant-scoped</PillTag>
                <PillTag>RLS enforced</PillTag>
                {tenant?.name ? (
                  <PillTag variant="success">{tenant.name}</PillTag>
                ) : null}
              </div>
            </div>
            <OnboardingProgressPanel
              stepLabels={[...STEP_LABELS]}
              currentStep={step}
            />
          </div>

          {needsAuth ? (
            <Card className="border-border/80 bg-card/95">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Sign in to save company setup to your tenant.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="cta" asChild>
                    <Link to="/login">Go to login</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/onboarding/signup">Create workspace</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Form {...form}>
              <form onSubmit={onFormSubmit} className="space-y-6" noValidate>
                {step === 0 ? (
                  <OnboardingWizardStep
                    step={1}
                    total={TOTAL_STEPS}
                    title="Company profile"
                    description="Legal entity, address, brand, and tax identifiers feed executive dashboards and compliance."
                  >
                    <CompanyProfileForm control={form.control} />
                  </OnboardingWizardStep>
                ) : null}

                {step === 1 ? (
                  <OnboardingWizardStep
                    step={2}
                    total={TOTAL_STEPS}
                    title="Timezone & currency"
                    description="Operating context for schedules, billing views, and workflow SLAs."
                  >
                    <div className="grid gap-6 md:grid-cols-2">
                      <TimezoneSelector<CompanySetupFormValues>
                        control={form.control}
                        name="timezone"
                      />
                      <CurrencySelector<CompanySetupFormValues>
                        control={form.control}
                        name="currency"
                      />
                    </div>
                  </OnboardingWizardStep>
                ) : null}

                {step === 2 ? (
                  <OnboardingWizardStep
                    step={3}
                    total={TOTAL_STEPS}
                    title="Departments"
                    description="Enable template workspaces and add custom departments. Duplicates are merged on save."
                  >
                    <DepartmentsTemplateEditor
                      fields={fields}
                      append={append}
                      remove={remove}
                      watchDepartmentName={(i) => form.watch(`departments.${i}.name`)}
                      setDepartmentName={(i, v) =>
                        form.setValue(`departments.${i}.name`, v)
                      }
                      defaultTemplates={DEFAULT_DEPARTMENT_TEMPLATES}
                      enabledTemplateIds={enabledTemplateIds}
                      onToggleTemplate={(id, checked) =>
                        setEnabledTemplateIds((prev) => ({ ...prev, [id]: checked }))
                      }
                    />
                  </OnboardingWizardStep>
                ) : null}

                {step === 3 ? (
                  <OnboardingWizardStep
                    step={4}
                    total={TOTAL_STEPS}
                    title="Core integrations"
                    description="Prioritize connectors for the integration wizard. Status reflects live tenant connections."
                  >
                    <IntegrationsSuggestions
                      items={suggestions}
                      isLoading={suggestionsQuery.isLoading}
                      selectedProviders={integrationKeys}
                      onToggleProvider={toggleIntegration}
                    />
                  </OnboardingWizardStep>
                ) : null}

                {step === 4 ? (
                  <OnboardingWizardStep
                    step={5}
                    total={TOTAL_STEPS}
                    title="Onboarding templates"
                    description="Optional accelerants from your platform catalog."
                  >
                    <div className="space-y-3">
                      {templatesQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      ) : templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No templates published yet. Continue with your selections.
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
                    {selectedTemplate ? (
                      <p className="text-xs text-muted-foreground">
                        Template recommends:{" "}
                        {templateIntegrationKeys(selectedTemplate).join(", ") || "—"}
                      </p>
                    ) : null}
                  </OnboardingWizardStep>
                ) : null}

                {step === 5 ? (
                  <OnboardingWizardStep
                    step={6}
                    total={TOTAL_STEPS}
                    title="Review & confirm"
                    description="Writes company profile, onboarding profile JSON, departments, and integration priorities."
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
                        <strong className="text-foreground">Address:</strong>{" "}
                        {[form.watch("addressLine1"), form.watch("city"), form.watch("country")]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </li>
                      <li>
                        <strong className="text-foreground">Website:</strong>{" "}
                        {form.watch("website") || "—"}
                      </li>
                      <li>
                        <strong className="text-foreground">Locale:</strong>{" "}
                        {form.watch("timezone")} · {form.watch("currency")}
                      </li>
                      <li>
                        <strong className="text-foreground">Departments:</strong>{" "}
                        {mergeDepartmentNames(form.getValues()).join(", ")}
                      </li>
                      <li>
                        <strong className="text-foreground">Integrations:</strong>{" "}
                        {integrationKeys.length > 0 ? integrationKeys.join(", ") : "—"}
                      </li>
                    </ul>
                  </OnboardingWizardStep>
                ) : null}

                <OnboardingActionBar
                  showBack={step > 0}
                  onBack={() => setStep((s) => Math.max(0, s - 1))}
                  isLastStep={step === TOTAL_STEPS - 1}
                  onSaveDraft={() => void saveDraft()}
                  isSubmitting={applyMutation.isPending}
                  continueLabel={
                    step === TOTAL_STEPS - 1
                      ? applyMutation.isPending
                        ? "Saving…"
                        : "Complete onboarding"
                      : "Continue"
                  }
                />
              </form>
            </Form>
          )}
        </div>
      </AnimatedPage>
    </PublicChrome>
  );
}
