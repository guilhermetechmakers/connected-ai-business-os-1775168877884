import { Building2, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TenantPayload } from "@/types/auth-api";
import type { OnboardingIntegrationSuggestion } from "@/types/onboarding-domain";
import { cn } from "@/lib/utils";

export type CompanySetupOnboardingPanelProps = {
  company: TenantPayload | null;
  suggestedIntegrations: OnboardingIntegrationSuggestion[];
  isLoadingSuggestions: boolean;
  onApplySuggestions: () => void;
  isApplying?: boolean;
};

export function CompanySetupOnboardingPanel({
  company,
  suggestedIntegrations,
  isLoadingSuggestions,
  onApplySuggestions,
  isApplying = false,
}: CompanySetupOnboardingPanelProps) {
  const items = Array.isArray(suggestedIntegrations)
    ? suggestedIntegrations
    : [];

  return (
    <Card className="border-border/70 bg-card/95 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          Company context
        </CardTitle>
        <CardDescription>
          Suggested connectors from your onboarding profile. Quick-add creates
          disconnected connectors you can authorize next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-surface-inner/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </dt>
            <dd className="font-medium text-foreground">
              {company?.name ?? "—"}
            </dd>
          </div>
          <div className="rounded-lg border border-border/50 bg-surface-inner/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Locale
            </dt>
            <dd className="font-medium text-foreground">
              {(company?.timezone ?? "—") + " · " + (company?.currency ?? "—")}
            </dd>
          </div>
        </dl>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
            Suggested integrations
          </p>
          {isLoadingSuggestions ? (
            <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
              <Skeleton className="h-16 rounded-lg bg-surface-inner" />
              <Skeleton className="h-16 rounded-lg bg-surface-inner" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No heuristics yet. Use the catalog below to connect manually.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2" role="list">
              {items.slice(0, 6).map((s) => (
                <li
                  key={s.provider}
                  className={cn(
                    "rounded-lg border border-border/50 bg-surface-inner/40 px-3 py-2 text-sm",
                  )}
                >
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {s.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          type="button"
          variant="cta"
          className="transition-transform duration-150 hover:scale-[1.02]"
          disabled={isApplying || items.length === 0}
          onClick={() => onApplySuggestions()}
        >
          {isApplying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          )}
          Quick-add suggested connectors
        </Button>
      </CardContent>
    </Card>
  );
}
