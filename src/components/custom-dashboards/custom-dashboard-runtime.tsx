import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CustomDashboardQueryPlanStep } from "@/types/dashboard";

type RuntimeDiagnostic = {
  level: "info" | "error" | "warning";
  message: string;
  timestamp: string;
};

type VisualSection =
  | { type: "kpi_cards"; title?: string; items?: Array<{ label: string; value: string | number; hint?: string }> }
  | { type: "pie"; title?: string; data?: Array<{ name: string; value: number }> }
  | { type: "bar"; title?: string; data?: Array<Record<string, unknown>>; xKey?: string; yKeys?: string[] }
  | { type: "line"; title?: string; data?: Array<Record<string, unknown>>; xKey?: string; yKeys?: string[] }
  | {
    type: "table";
    title?: string;
    columns?: Array<{ key: string; label: string }>;
    rows?: Array<Record<string, unknown>>;
    limit?: number;
  };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractVisualPlan(snapshotData: Record<string, unknown>): VisualSection[] {
  const plan = asRecord(snapshotData.visualPlan);
  const sections = Array.isArray(plan.sections) ? plan.sections : [];
  return sections
    .map((item) => (item && typeof item === "object" ? (item as VisualSection) : null))
    .filter((item): item is VisualSection => Boolean(item));
}

function buildFallbackSections(snapshotData: Record<string, unknown>, sources: string[]): VisualSection[] {
  const datasets = Array.isArray(snapshotData.datasets) ? snapshotData.datasets : [];
  const summary = asRecord(snapshotData.summary);

  const totalSteps = asNumber(summary.stepCount) ?? datasets.length;
  const successCount = asNumber(summary.successCount) ?? datasets.filter((d) => asRecord(d).status === "succeeded").length;
  const errorCount = asNumber(summary.errorCount) ?? Math.max(totalSteps - successCount, 0);

  const providerCounts = new Map<string, number>();
  const tableRows: Array<Record<string, unknown>> = [];

  for (const raw of datasets) {
    const ds = asRecord(raw);
    const provider = typeof ds.providerKey === "string" && ds.providerKey ? ds.providerKey : "unknown";
    providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1);

    const result = asRecord(ds.result);
    const candidates = Array.isArray(result.items)
      ? result.items
      : Array.isArray(result.results)
        ? result.results
        : Array.isArray(result.records)
          ? result.records
          : [];

    for (const row of candidates.slice(0, 8)) {
      if (row && typeof row === "object" && !Array.isArray(row)) {
        tableRows.push(row as Record<string, unknown>);
      }
    }
  }

  const providerPie = Array.from(providerCounts.entries()).map(([name, value]) => ({ name, value }));
  const firstRow = tableRows[0] ?? {};
  const tableColumns = Object.keys(firstRow)
    .slice(0, 6)
    .map((key) => ({ key, label: key.replace(/_/g, " ") }));

  return [
    {
      type: "kpi_cards",
      title: "Snapshot overview",
      items: [
        { label: "Query steps", value: totalSteps },
        { label: "Succeeded", value: successCount },
        { label: "Errors", value: errorCount },
        { label: "Sources", value: sources.length },
      ],
    },
    ...(providerPie.length > 0 ? [{ type: "pie", title: "Datasets by provider", data: providerPie } as VisualSection] : []),
    ...(tableRows.length > 0
      ? [{ type: "table", title: "Latest rows", columns: tableColumns, rows: tableRows, limit: 8 } as VisualSection]
      : []),
  ];
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "[object]";
}

export function CustomDashboardRuntime({
  codeTsx: _codeTsx,
  snapshotData,
  queryPlan,
  sources,
  titleHint,
  embedded = false,
  className,
  iframeClassName,
}: {
  codeTsx: string;
  snapshotData: Record<string, unknown>;
  queryPlan: CustomDashboardQueryPlanStep[];
  sources: string[];
  titleHint?: string;
  embedded?: boolean;
  className?: string;
  iframeClassName?: string;
}) {
  const diagnostics = useMemo<RuntimeDiagnostic[]>(() => {
    const out: RuntimeDiagnostic[] = [];
    if (!snapshotData || Object.keys(snapshotData).length === 0) {
      out.push({
        level: "warning",
        message: "No snapshot data available yet. Refresh the dashboard to pull integration data.",
        timestamp: new Date().toISOString(),
      });
    }
    if (queryPlan.length === 0) {
      out.push({
        level: "info",
        message: "No query plan recorded. The AI likely returned a direct summary.",
        timestamp: new Date().toISOString(),
      });
    }
    return out;
  }, [queryPlan.length, snapshotData]);

  const sections = useMemo(() => {
    const explicit = extractVisualPlan(snapshotData);
    if (explicit.length > 0) return explicit;
    return buildFallbackSections(snapshotData, sources);
  }, [snapshotData, sources]);

  return (
    <Card className={cn("border-border/70 bg-card/90", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titleHint || "Custom dashboard"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn("grid gap-3", embedded ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2") }>
          {sections.map((section, idx) => {
            if (section.type === "kpi_cards") {
              const items = Array.isArray(section.items) ? section.items : [];
              return (
                <div key={`section-${idx}`} className="rounded-xl border border-border/60 bg-background/40 p-3 lg:col-span-2">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title || "KPIs"}</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {items.map((item) => (
                      <div key={item.label} className="rounded-lg border border-border/50 bg-card/70 p-2">
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                        <p className="text-xl font-semibold text-foreground">{cellText(item.value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (section.type === "pie") {
              const data = Array.isArray(section.data) ? section.data : [];
              return (
                <div key={`section-${idx}`} className={cn("rounded-xl border border-border/60 bg-background/40 p-3", iframeClassName)}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title || "Pie chart"}</p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} />
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }

            if (section.type === "bar" || section.type === "line") {
              const data = Array.isArray(section.data) ? section.data : [];
              const xKey = typeof section.xKey === "string" ? section.xKey : "label";
              const yKeys = Array.isArray(section.yKeys) && section.yKeys.length > 0 ? section.yKeys : ["value"];
              return (
                <div key={`section-${idx}`} className="rounded-xl border border-border/60 bg-background/40 p-3 lg:col-span-2">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title || "Trend"}</p>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      {section.type === "bar" ? (
                        <BarChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey={xKey} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {yKeys.map((key) => <Bar key={key} dataKey={key} fill="#3b82f6" />)}
                        </BarChart>
                      ) : (
                        <LineChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey={xKey} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {yKeys.map((key) => <Line key={key} type="monotone" dataKey={key} stroke="#22c55e" />)}
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            }

            const rows = Array.isArray(section.rows) ? section.rows : [];
            const limit = typeof section.limit === "number" && section.limit > 0 ? section.limit : 10;
            const selectedRows = rows.slice(0, limit);
            const columns = Array.isArray(section.columns) && section.columns.length > 0
              ? section.columns
              : Object.keys(selectedRows[0] ?? {}).slice(0, 6).map((key) => ({ key, label: key }));

            return (
              <div key={`section-${idx}`} className="rounded-xl border border-border/60 bg-background/40 p-3 lg:col-span-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{section.title || "Table"}</p>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50 text-left text-muted-foreground">
                        {columns.map((column) => <th key={column.key} className="px-2 py-1.5 font-medium">{column.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className="border-b border-border/30">
                          {columns.map((column) => (
                            <td key={`${rowIndex}-${column.key}`} className="px-2 py-1.5 text-foreground/90">
                              {cellText((row as Record<string, unknown>)[column.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1 text-[11px]">
          {diagnostics.map((diag) => (
            <div
              key={`${diag.timestamp}-${diag.message}`}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2 py-1.5",
                diag.level === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
                diag.level === "warning" && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                diag.level === "info" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              )}
            >
              {diag.level === "error" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />}
              <span>{diag.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
