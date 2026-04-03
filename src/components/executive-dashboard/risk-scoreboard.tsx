import { AlertTriangle } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ExecutiveRiskIssue } from "@/types/executive-dashboard";

const SEVERITY_ORDER: Record<ExecutiveRiskIssue["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_COLOR: Record<ExecutiveRiskIssue["severity"], string> = {
  critical: "rgb(220, 80, 80)",
  high: "rgb(245, 158, 11)",
  medium: "rgb(154, 208, 255)",
  low: "rgb(0, 210, 122)",
};

export type RiskScoreboardProps = {
  risks: ExecutiveRiskIssue[];
  isLoading?: boolean;
  onIssueSelect?: (risk: ExecutiveRiskIssue) => void;
  selectedId?: string | null;
  className?: string;
};

export function RiskScoreboard({
  risks,
  isLoading,
  onIssueSelect,
  selectedId,
  className,
}: RiskScoreboardProps) {
  const list = Array.isArray(risks) ? [...risks] : [];
  list.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  const chartData = list.slice(0, 8).map((r, i) => ({
    id: r.id,
    title: `${i + 1}. ${r.title.length > 32 ? `${r.title.slice(0, 30)}…` : r.title}`,
    score: SEVERITY_ORDER[r.severity] * 25,
    severity: r.severity,
  }));

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="h-44 w-full rounded-xl border border-border/50 bg-surface-inner/40 p-2"
        role="img"
        aria-label="Risk severity distribution"
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
              <XAxis type="number" hide domain={[0, 100]} />
              <YAxis type="category" dataKey="title" width={100} tick={{ fill: "rgb(143, 160, 176)", fontSize: 10 }} />
              <Tooltip
                cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                contentStyle={{
                  background: "rgb(15 23 32)",
                  border: "1px solid rgb(21 78 120 / 0.4)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "rgb(247 250 255)" }}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} aria-label="Risk score by issue">
                {chartData.map((entry) => (
                  <Cell key={entry.id} fill={SEVERITY_COLOR[entry.severity]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No risk rows to chart
          </div>
        )}
      </div>

      <ul className="space-y-2" role="list" aria-label="Top risk issues">
        {list.slice(0, 6).map((r) => {
          const active = selectedId === r.id;
          return (
            <li key={r.id}>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-150",
                  active ? "border-primary/40 bg-primary/10" : "border-border/40 bg-transparent hover:bg-muted/40",
                )}
                onClick={() => onIssueSelect?.(r)}
              >
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: SEVERITY_COLOR[r.severity] }}
                  aria-hidden
                />
                <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-sm text-foreground">{r.title}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.severity}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
