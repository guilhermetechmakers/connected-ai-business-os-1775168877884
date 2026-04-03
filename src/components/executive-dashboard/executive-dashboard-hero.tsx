import { AIExecutiveBriefCard } from "@/components/executive-dashboard/ai-executive-brief-card";
import { HeroKPIBar } from "@/components/executive-dashboard/hero-kpi-bar";
import { cn } from "@/lib/utils";
import type { ExecutiveDashboardSnapshot } from "@/types/executive-dashboard";

export type ExecutiveDashboardHeroProps = {
  tenantName: string | null;
  snapshot: ExecutiveDashboardSnapshot;
  isLoading?: boolean;
  canRefreshBrief: boolean;
  className?: string;
};

export function ExecutiveDashboardHero({
  tenantName,
  snapshot,
  isLoading,
  canRefreshBrief,
  className,
}: ExecutiveDashboardHeroProps) {
  const kpis = Array.isArray(snapshot.kpis) ? snapshot.kpis : [];

  return (
    <section
      className={cn("grid gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-10", className)}
      aria-labelledby="executive-dashboard-hero-heading"
    >
      <div className="space-y-6 lg:col-span-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Executive dashboard · decision-grade canvas
        </p>
        <h1
          id="executive-dashboard-hero-heading"
          className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-5xl lg:text-6xl xl:text-7xl"
        >
          <span className="bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent">
            Executive
          </span>{" "}
          signal for{" "}
          {tenantName ? <span className="text-primary">{tenantName}</span> : "your organization"}.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Top-line KPIs, risk posture, and cross-department intensity in one scannable layout. Widgets
          below persist per tenant and role through the dashboard framework.
        </p>
        <HeroKPIBar kpis={kpis} isLoading={isLoading} />
      </div>
      <div className="lg:col-span-5">
        <AIExecutiveBriefCard canRefresh={canRefreshBrief} className="min-h-[280px] lg:min-h-full" />
      </div>
    </section>
  );
}
