import { format } from "date-fns";
import { ClipboardList, Download } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettingsAuditQuery } from "@/hooks/use-settings-hub";
import type { SettingsAuditRow } from "@/lib/settings-hub-api";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: SettingsAuditRow[]) {
  const header = "id,created_at,action,actor_user_id,changes_json\n";
  const body = (rows ?? [])
    .map((r) =>
      [
        r.id,
        r.created_at,
        r.action,
        r.actor_user_id ?? "",
        JSON.stringify(r.changes ?? {}).replaceAll('"', '""'),
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AuditTrailView() {
  const q = useSettingsAuditQuery(120);
  const entries = Array.isArray(q.data) ? q.data : [];

  const chartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries ?? []) {
      const a = typeof e.action === "string" ? e.action : "unknown";
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([action, count]) => ({ action, count }));
  }, [entries]);

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
              Settings audit trail
            </CardTitle>
            <CardDescription>
              Entries from <code className="text-xs">settings_audit_log</code> for this tenant.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={entries.length === 0}
              onClick={() => downloadJson("settings-audit.json", entries)}
            >
              <Download className="mr-2 h-4 w-4" />
              JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={entries.length === 0}
              onClick={() => downloadCsv("settings-audit.csv", entries)}
            >
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl bg-surface-inner" />
          ) : q.isError ? (
            <p className="text-sm text-destructive">
              {q.error instanceof Error ? q.error.message : "Could not load audit log"}
            </p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="action"
                    tick={{ fill: "rgb(143 160 176)", fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis tick={{ fill: "rgb(143 160 176)", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgb(15 23 32)",
                      border: "1px solid rgb(21 78 120 / 0.3)",
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: "rgb(247 250 255)" }}
                  />
                  <Bar dataKey="count" fill="rgb(154 208 255)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl bg-surface-inner" />
          ) : (
            <ScrollArea className="h-72 pr-3">
              <ul className="space-y-3 text-sm">
                {(entries ?? []).map((e) => (
                  <li
                    key={e.id}
                    className="rounded-xl border border-border/60 bg-surface-inner px-3 py-2 transition-all duration-150 hover:border-primary/25"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-primary">{e.action}</span>
                      <time className="text-xs text-muted-foreground" dateTime={e.created_at}>
                        {format(new Date(e.created_at), "PPpp")}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Actor: {e.actor_user_id ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
