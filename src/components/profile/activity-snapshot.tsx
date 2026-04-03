import { format } from "date-fns";
import { Activity } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Json } from "@/types/database";

export type SecurityEventRow = {
  event_type: string;
  payload: Json;
  created_at: string;
};

export type ActivityLogRow = {
  event_type: string;
  actor_user_id: string | null;
  payload: Json;
  created_at: string;
};

function mergeTimeline(
  security: SecurityEventRow[],
  activity: ActivityLogRow[],
): Array<{ id: string; label: string; at: string; kind: "security" | "audit" }> {
  const sec = (Array.isArray(security) ? security : []).map((e, i) => ({
    id: `s-${e.event_type}-${e.created_at}-${i}`,
    label: e.event_type,
    at: e.created_at,
    kind: "security" as const,
  }));
  const act = (Array.isArray(activity) ? activity : []).map((e, i) => ({
    id: `a-${e.event_type}-${e.created_at}-${i}`,
    label: e.event_type,
    at: e.created_at,
    kind: "audit" as const,
  }));
  return [...sec, ...act].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 24);
}

function bucketLast7Days(
  security: SecurityEventRow[],
  activity: ActivityLogRow[],
): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  const bump = (iso: string) => {
    const key = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const e of Array.isArray(security) ? security : []) {
    if (typeof e.created_at === "string") bump(e.created_at);
  }
  for (const e of Array.isArray(activity) ? activity : []) {
    if (typeof e.created_at === "string") bump(e.created_at);
  }
  const out: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      day: `${d.getMonth() + 1}/${d.getDate()}`,
      count: counts.get(key) ?? 0,
    });
  }
  return out;
}

export function ActivitySnapshot({
  securityEvents,
  profileActivity,
}: {
  securityEvents: SecurityEventRow[];
  profileActivity?: ActivityLogRow[];
}) {
  const merged = mergeTimeline(securityEvents, profileActivity ?? []);
  const chartData = bucketLast7Days(securityEvents, profileActivity ?? []);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-success" aria-hidden />
          Recent actions
        </p>
        {merged.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent profile or security events.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
            {merged.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-surface-inner/40 px-3 py-2"
              >
                <span className="font-mono text-xs text-foreground">{row.label}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={
                      row.kind === "security"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {row.kind === "security" ? "Security" : "Audit"}
                  </span>
                  {format(new Date(row.at), "PPp")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-border/60 bg-surface-inner/30 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          7-day volume
        </p>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
