import { format } from "date-fns";
import { Activity, Download } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Json } from "@/types/database";
import { restFetchActivities } from "@/api/tenant-user-profile-rest";
import { toast } from "sonner";

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
  return [...sec, ...act].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 48);
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

function parseActivityApiRows(raw: unknown): ActivityLogRow[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((row) => ({
        event_type: typeof row.event_type === "string" ? row.event_type : "event",
        actor_user_id: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
        payload: (row.payload ?? {}) as Json,
        created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
      }));
  }
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const inner = Array.isArray(o.data) ? o.data : Array.isArray(o.entries) ? o.entries : [];
  if (!Array.isArray(inner)) return [];
  return inner
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((row) => ({
      event_type: typeof row.event_type === "string" ? row.event_type : "event",
      actor_user_id: typeof row.actor_user_id === "string" ? row.actor_user_id : null,
      payload: (row.payload ?? {}) as Json,
      created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    }));
}

export function ActivitySnapshot({
  securityEvents,
  profileActivity,
  tenantId,
  userId,
}: {
  securityEvents: SecurityEventRow[];
  profileActivity?: ActivityLogRow[];
  tenantId?: string;
  userId?: string;
}) {
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [eventType, setEventType] = useState<string>("all");
  const [apiActivity, setApiActivity] = useState<ActivityLogRow[]>([]);
  const deferredType = useDeferredValue(eventType);

  const merged = useMemo(
    () => mergeTimeline(securityEvents, [...(profileActivity ?? []), ...apiActivity]),
    [securityEvents, profileActivity, apiActivity],
  );

  const rangeCutoff = useMemo(() => {
    const now = Date.now();
    const day = 86400000;
    if (range === "all") return 0;
    if (range === "7d") return now - 7 * day;
    if (range === "30d") return now - 30 * day;
    return now - 90 * day;
  }, [range]);

  const filtered = useMemo(() => {
    return merged.filter((row) => {
      const t = new Date(row.at).getTime();
      if (rangeCutoff > 0 && t < rangeCutoff) return false;
      if (deferredType !== "all" && row.label !== deferredType) return false;
      return true;
    });
  }, [merged, rangeCutoff, deferredType]);

  const chartData = useMemo(
    () => bucketLast7Days(securityEvents, profileActivity ?? []),
    [securityEvents, profileActivity],
  );

  const eventTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const m of merged) set.add(m.label);
    return ["all", ...[...set].sort()].filter(Boolean);
  }, [merged]);

  async function pullFromTenantApi() {
    if (!tenantId || !userId) {
      toast.error("Tenant context not ready");
      return;
    }
    try {
      const raw = await restFetchActivities(tenantId, {
        userId,
        range,
        eventType: eventType === "all" ? undefined : eventType,
      });
      const rows = parseActivityApiRows(raw);
      setApiActivity(Array.isArray(rows) ? rows : []);
      toast.success(rows.length ? "Loaded tenant activity" : "No extra rows for this filter");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load activity");
    }
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      range,
      eventTypeFilter: eventType,
      items: filtered,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profile-activity-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export started");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/50 bg-surface-inner/30 p-3">
        <div className="space-y-1.5">
          <Label htmlFor="activity-range" className="text-xs text-muted-foreground">
            Time range
          </Label>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger id="activity-range" className="h-9 w-[140px] bg-surface-inner" aria-label="Activity time range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-event-type" className="text-xs text-muted-foreground">
            Event type
          </Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger id="activity-event-type" className="h-9 min-w-[160px] bg-surface-inner" aria-label="Filter by event type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {(eventTypeOptions ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === "all" ? "All types" : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 pb-0.5">
          {tenantId && userId ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void pullFromTenantApi()}>
              Merge tenant log
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="cta" className="gap-1.5" onClick={exportJson}>
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-success" aria-hidden />
            Recent actions
          </p>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events for this filter.</p>
          ) : (
            <ul
              className="max-h-72 space-y-2 overflow-y-auto pr-1 text-sm"
              aria-live="polite"
              aria-label="Filtered activity list"
            >
              {filtered.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-surface-inner/40 px-3 py-2"
                >
                  <span className="font-mono text-xs text-foreground">{row.label}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={
                        row.kind === "security" ? "text-primary" : "text-muted-foreground"
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
    </div>
  );
}
