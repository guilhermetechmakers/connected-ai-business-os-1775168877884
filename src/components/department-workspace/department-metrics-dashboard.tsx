import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { UnifiedEntity } from "@/types/unified";
import { payloadTitle } from "@/types/unified";

export type DepartmentMetricsDashboardProps = {
  kpis: UnifiedEntity[];
  isLoading?: boolean;
  className?: string;
};

function numericFromPayload(entity: UnifiedEntity): number | null {
  const p = entity.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const o = p as Record<string, unknown>;
  const raw = o.value ?? o.score ?? o.current;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function DepartmentMetricsDashboard({
  kpis,
  isLoading = false,
  className,
}: DepartmentMetricsDashboardProps) {
  const safe = Array.isArray(kpis) ? kpis : [];
  const data = safe
    .map((k) => {
      const v = numericFromPayload(k);
      if (v === null) return null;
      return {
        name: payloadTitle(k.payload).slice(0, 24),
        value: v,
      };
    })
    .filter((x): x is { name: string; value: number } => x !== null);

  return (
    <Card className={cn("border-border/80 bg-card/90", className)}>
      <CardHeader>
        <CardTitle className="text-base">KPI snapshot</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-xl" />
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No numeric KPI values found. Use unified KPI entities with a `value`, `score`, or
            `current` field.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                interval={0}
                angle={-18}
                textAnchor="end"
                height={56}
              />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar
                dataKey="value"
                fill="#9AD0FF"
                radius={[6, 6, 0, 0]}
                name="Value"
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
