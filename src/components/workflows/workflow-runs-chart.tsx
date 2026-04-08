import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WorkflowRunRow } from "@/types/workflows";

export interface WorkflowRunsChartProps {
  runs: WorkflowRunRow[];
}

export function WorkflowRunsChart({ runs }: WorkflowRunsChartProps) {
  const list = Array.isArray(runs) ? runs : [];
  const counts = list.reduce<Record<string, number>>((acc, r) => {
    const k = r.status ?? "unknown";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const data = Object.entries(counts).map(([status, count]) => ({
    status,
    count,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/60 bg-surface-inner/50 text-sm text-muted-foreground">
        No runs yet — execute a workflow to populate this chart.
      </div>
    );
  }

  return (
    <div className="h-56 w-full rounded-xl border border-border/80 bg-card/80 p-4 shadow-card">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Runs by status
      </p>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgb(255 255 255 / 0.06)" vertical={false} />
          <XAxis
            dataKey="status"
            tick={{ fill: "rgb(143 160 176)", fontSize: 11 }}
            axisLine={{ stroke: "rgb(255 255 255 / 0.08)" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "rgb(143 160 176)", fontSize: 11 }}
            axisLine={{ stroke: "rgb(255 255 255 / 0.08)" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgb(var(--card))",
              border: "1px solid rgb(var(--border) / 0.7)",
              borderRadius: "12px",
              color: "rgb(var(--foreground))",
            }}
            labelStyle={{ color: "rgb(var(--primary))" }}
          />
          <Bar
            dataKey="count"
            fill="rgb(var(--primary))"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
