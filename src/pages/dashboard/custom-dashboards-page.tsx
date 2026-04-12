import { LayoutTemplate, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomDashboardsFeatureQuery,
  useCustomDashboardsListQuery,
} from "@/hooks/use-custom-dashboards";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function visibilityLabel(mode: string): string {
  if (mode === "company") return "Company";
  if (mode === "roles") return "Shared roles";
  return "Private";
}

export default function CustomDashboardsPage() {
  const featureQ = useCustomDashboardsFeatureQuery();
  const listQ = useCustomDashboardsListQuery(120);
  const dashboards = Array.isArray(listQ.data) ? listQ.data : [];

  return (
    <AnimatedPage className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Custom dashboards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated dashboards saved for reuse, refresh, and role sharing.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/chat">Generate from AI chat</Link>
        </Button>
      </div>

      {featureQ.isLoading ? (
        <Skeleton className="h-24 rounded-2xl bg-surface-inner" />
      ) : !featureQ.enabled ? (
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Feature disabled</CardTitle>
            <CardDescription>
              Enable tenant feature flag <code className="text-xs">custom_dashboards_v1</code> in Settings, then open Flags.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : listQ.isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-36 rounded-2xl bg-surface-inner" />
          ))}
        </div>
      ) : dashboards.length === 0 ? (
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">No custom dashboards yet</CardTitle>
            <CardDescription>
              Ask AI to build one from your connected integrations, then save it from the artifact card.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {dashboards.map((dashboard) => (
            <Card key={dashboard.id} className="border-border/80 bg-card/90">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LayoutTemplate className="h-4 w-4 text-primary" aria-hidden />
                  {dashboard.title}
                </CardTitle>
                {dashboard.description ? (
                  <CardDescription>{dashboard.description}</CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>Visibility: {visibilityLabel(dashboard.visibility_mode)}</span>
                  <span>Updated: {formatDateTime(dashboard.updated_at)}</span>
                  <span>Last refresh: {formatDateTime(dashboard.latest_run_at)}</span>
                </div>
                {Array.isArray(dashboard.integration_sources) && dashboard.integration_sources.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {dashboard.integration_sources.map((source) => (
                      <span
                        key={`${dashboard.id}-${source}`}
                        className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-foreground/80"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-1 text-[11px]">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    No integration source metadata.
                  </p>
                )}
                <Button size="sm" asChild>
                  <Link to={`/dashboard/custom-dashboards/${dashboard.id}`}>Open dashboard</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AnimatedPage>
  );
}
