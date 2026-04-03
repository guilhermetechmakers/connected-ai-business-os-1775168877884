import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminSystemTemplatesQuery } from "@/hooks/use-activity-logs";
import {
  useCreateTenantModuleMutation,
  useUpsertTenantConfigMutation,
} from "@/hooks/use-tenants-module";
import { cn } from "@/lib/utils";

const STEPS = [
  "Basic info",
  "Quotas",
  "Region & plan",
  "Templates",
  "Integrations",
  "Review",
] as const;

const SUGGESTED_INTEGRATIONS = [
  { key: "slack", label: "Slack" },
  { key: "hubspot", label: "HubSpot" },
  { key: "salesforce", label: "Salesforce" },
  { key: "google", label: "Google Workspace" },
  { key: "quickbooks", label: "QuickBooks" },
] as const;

export function AdminTenantProvisionWizard({
  className,
}: {
  className?: string;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [domain, setDomain] = useState("");
  const [maxUsers, setMaxUsers] = useState("250");
  const [maxIntegrations, setMaxIntegrations] = useState("25");
  const [region, setRegion] = useState("us");
  const [plan, setPlan] = useState("trial");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState("");
  const [selectedTemplateKeys, setSelectedTemplateKeys] = useState<string[]>(
    [],
  );
  const [integrationKeys, setIntegrationKeys] = useState<string[]>([
    "slack",
    "hubspot",
  ]);

  const templatesQuery = useAdminSystemTemplatesQuery(true);
  const templates = Array.isArray(templatesQuery.data) ? templatesQuery.data : [];

  const createTenant = useCreateTenantModuleMutation();
  const upsertConfig = useUpsertTenantConfigMutation();

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  const toggleTemplateKey = (key: string, checked: boolean) => {
    setSelectedTemplateKeys((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (checked) return [...cur, key];
      return cur.filter((k) => k !== key);
    });
  };

  const toggleIntegration = (key: string, checked: boolean) => {
    setIntegrationKeys((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (checked) return [...cur, key];
      return cur.filter((k) => k !== key);
    });
  };

  const canAdvance =
    step === 0
      ? name.trim().length >= 2
      : step === 1
        ? Number(maxUsers) > 0 && Number(maxIntegrations) > 0
        : true;

  const submit = async () => {
    const mu = Number(maxUsers);
    const mi = Number(maxIntegrations);
    const created = await createTenant.mutateAsync({
      name: name.trim(),
      region,
      plan,
      timezone,
      currency,
      domain: domain.trim() || undefined,
      legalName: legalName.trim() || undefined,
      displayName: displayName.trim() || name.trim(),
      country: country.trim() || undefined,
      maxUsers: Number.isFinite(mu) ? mu : undefined,
      maxIntegrations: Number.isFinite(mi) ? mi : undefined,
    });
    if (!created?.id) {
      toast.error("Provisioning failed");
      return;
    }
    const cfgPayload = {
      quotas: { maxUsers: mu, maxIntegrations: mi },
      systemTemplateKeys: selectedTemplateKeys,
      suggestedIntegrations: integrationKeys,
      region,
      plan,
    };
    await upsertConfig.mutateAsync({
      companyId: created.id,
      configKey: "tenant.provision_wizard",
      configValue: cfgPayload,
    });
    toast.success(`Tenant ${created.name} provisioned`);
    setStep(0);
    setName("");
    setLegalName("");
    setDisplayName("");
    setDomain("");
    setSelectedTemplateKeys([]);
    setIntegrationKeys(["slack", "hubspot"]);
  };

  return (
    <Card className={cn("border-border/80 bg-card/90", className)}>
      <CardHeader>
        <CardTitle>Provisioning wizard</CardTitle>
        <p className="text-sm text-muted-foreground">
          Guided flow: company profile, quotas, templates, and integration
          hints. Confirms with audit-backed tenant creation.
        </p>
        <div className="pt-2">
          <Progress value={progress} className="h-1.5 bg-surface-inner" />
          <p className="mt-2 text-xs text-muted-foreground">
            {STEPS[step]} · {progress}% complete
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="wiz-name">Company name</Label>
              <Input
                id="wiz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-input border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wiz-legal">Legal name</Label>
              <Input
                id="wiz-legal"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="bg-input border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wiz-display">Display name</Label>
              <Input
                id="wiz-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-input border-border/60"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="wiz-domain">Domain hint</Label>
              <Input
                id="wiz-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="bg-input border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wiz-country">Country</Label>
              <Input
                id="wiz-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. US"
                className="bg-input border-border/60"
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wiz-mu">Seat quota (max users)</Label>
              <Input
                id="wiz-mu"
                type="number"
                min={1}
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                className="bg-input border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wiz-mi">Integration quota</Label>
              <Input
                id="wiz-mi"
                type="number"
                min={1}
                value={maxIntegrations}
                onChange={(e) => setMaxIntegrations(e.target.value)}
                className="bg-input border-border/60"
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="bg-input border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">US</SelectItem>
                  <SelectItem value="eu">EU</SelectItem>
                  <SelectItem value="apac">APAC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="bg-input border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="bg-input border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-input border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Attach system template keys to seed module metadata for this
              tenant (stored in tenant config on confirm).
            </p>
            {templatesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading templates…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No system templates yet. Continue — you can add templates from
                the Templates tab.
              </p>
            ) : (
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-surface-inner/40 p-3">
                {templates.map((t) => {
                  const key = t.template_key;
                  const checked = selectedTemplateKeys.includes(key);
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/30"
                    >
                      <Checkbox
                        id={`tpl-${t.id}`}
                        checked={checked}
                        onCheckedChange={(c) =>
                          toggleTemplateKey(key, c === true)
                        }
                      />
                      <label
                        htmlFor={`tpl-${t.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <span className="font-mono text-xs text-primary">
                          {key}
                        </span>
                        <span className="ml-2 text-foreground">{t.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {SUGGESTED_INTEGRATIONS.map((item) => (
              <label
                key={item.key}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-surface-inner/40 p-3 transition-all duration-150 hover:border-primary/30 hover:-translate-y-0.5"
              >
                <Checkbox
                  checked={integrationKeys.includes(item.key)}
                  onCheckedChange={(c) =>
                    toggleIntegration(item.key, c === true)
                  }
                />
                <span className="text-sm font-medium">{item.label}</span>
              </label>
            ))}
          </div>
        ) : null}

        {step === 5 ? (
          <ul className="space-y-2 rounded-xl border border-border/60 bg-surface-inner/40 p-4 text-sm">
            <li>
              <strong className="text-foreground">Name:</strong> {name}
            </li>
            <li>
              <strong className="text-foreground">Plan / region:</strong>{" "}
              {plan} · {region}
            </li>
            <li>
              <strong className="text-foreground">Quotas:</strong> {maxUsers}{" "}
              users · {maxIntegrations} integrations
            </li>
            <li>
              <strong className="text-foreground">Templates:</strong>{" "}
              {selectedTemplateKeys.length} selected
            </li>
            <li>
              <strong className="text-foreground">Integration hints:</strong>{" "}
              {integrationKeys.join(", ") || "—"}
            </li>
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button
            type="button"
            variant="outline"
            className="border-border/60"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              variant="cta"
              disabled={!canAdvance}
              onClick={() =>
                setStep((s) => Math.min(STEPS.length - 1, s + 1))
              }
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="cta"
              disabled={createTenant.isPending || upsertConfig.isPending}
              onClick={() => void submit()}
            >
              <Check className="mr-1 h-4 w-4" />
              {createTenant.isPending ? "Provisioning…" : "Confirm & provision"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
