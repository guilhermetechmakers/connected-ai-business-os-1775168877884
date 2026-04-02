import { Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UnifiedEntity } from "@/types/unified";
import { KPIBlock } from "@/components/unified-data/kpi-block";

export type DepartmentOverviewCardProps = {
  departmentName: string;
  leadLabel?: string;
  kpis: UnifiedEntity[];
  isLoading?: boolean;
  className?: string;
};

export function DepartmentOverviewCard({
  departmentName,
  leadLabel,
  kpis,
  isLoading,
  className,
}: DepartmentOverviewCardProps) {
  const kpiList = Array.isArray(kpis) ? kpis : [];

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" aria-hidden />
        <div>
          <CardTitle className="text-lg">{departmentName}</CardTitle>
          {leadLabel ? (
            <p className="text-sm text-muted-foreground">Lead · {leadLabel}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {kpiList.length === 0 ? (
              <p className="text-sm text-muted-foreground sm:col-span-3">
                Connect integrations to hydrate department KPIs from unified entities.
              </p>
            ) : (
              kpiList.slice(0, 3).map((k) => {
                const raw = k.payload;
                const payload =
                  raw && typeof raw === "object" && !Array.isArray(raw)
                    ? (raw as Record<string, unknown>)
                    : {};
                const label =
                  typeof payload.label === "string"
                    ? payload.label
                    : k.entityType;
                const value =
                  typeof payload.value === "string" ||
                  typeof payload.value === "number"
                    ? String(payload.value)
                    : "—";
                const delta =
                  typeof payload.delta === "string" ? payload.delta : undefined;
                return (
                  <KPIBlock
                    key={k.id}
                    label={label}
                    value={value}
                    delta={delta}
                    trend="neutral"
                  />
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
