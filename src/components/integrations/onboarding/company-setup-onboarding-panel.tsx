import { Sparkles } from "lucide-react";

import { IntegrationsSuggestions } from "@/components/onboarding/integrations-suggestions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { OnboardingIntegrationSuggestion } from "@/types/onboarding-domain";

export interface CompanySetupOnboardingPanelProps {
  companyDisplayName: string;
  timezone: string;
  currency: string;
  departmentCount: number;
  suggestedIntegrations: OnboardingIntegrationSuggestion[];
  isSuggestionsLoading: boolean;
  selectedProviders: string[];
  onToggleProvider: (provider: string, on: boolean) => void;
  /** Merge all suggested provider keys into selected priorities. */
  onApplySuggestions: () => void;
}

export function CompanySetupOnboardingPanel({
  companyDisplayName,
  timezone,
  currency,
  departmentCount,
  suggestedIntegrations,
  isSuggestionsLoading,
  selectedProviders,
  onToggleProvider,
  onApplySuggestions,
}: CompanySetupOnboardingPanelProps) {
  const items = Array.isArray(suggestedIntegrations) ? suggestedIntegrations : [];

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            Tenant snapshot
          </CardTitle>
          <CardDescription>
            Integration suggestions use this operating context. Quick-add applies all suggested
            connectors to your setup priorities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Display name
              </dt>
              <dd className="mt-1 text-foreground">{companyDisplayName || "—"}</dd>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Timezone · Currency
              </dt>
              <dd className="mt-1 text-foreground">
                {timezone} · {currency}
              </dd>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2 sm:col-span-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Departments
              </dt>
              <dd className="mt-1 text-foreground">{departmentCount} configured</dd>
            </div>
          </dl>
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-primary/35"
            disabled={items.length === 0}
            onClick={onApplySuggestions}
          >
            Quick-add all suggested integrations
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 font-display text-base font-semibold text-foreground">
          Suggested connectors
        </h3>
        <IntegrationsSuggestions
          items={items}
          isLoading={isSuggestionsLoading}
          selectedProviders={selectedProviders}
          onToggleProvider={onToggleProvider}
        />
      </div>
    </div>
  );
}
