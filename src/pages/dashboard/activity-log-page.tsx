import { format } from "date-fns";
import { ChevronDown, Download, Filter } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActivityLogQuery } from "@/hooks/use-workflows";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ActivityLogEntryRow } from "@/types/workflows";
import { cn } from "@/lib/utils";

const EVENT_OPTIONS = [
  { value: "all", label: "All event types" },
  { value: "user_action", label: "User actions" },
  { value: "workflow_run", label: "Workflow runs" },
  { value: "integration_sync", label: "Integration sync" },
  { value: "ai_action", label: "AI actions" },
  { value: "system_alert", label: "System alerts" },
];

function toCsv(rows: ActivityLogEntryRow[]): string {
  const list = Array.isArray(rows) ? rows : [];
  const headers = [
    "id",
    "created_at",
    "event_type",
    "actor_user_id",
    "related_entity",
    "related_id",
    "department_id",
    "payload",
  ];
  const lines = [
    headers.join(","),
    ...list.map((r) => {
      const row = r as unknown as Record<string, unknown>;
      return headers
        .map((h) => {
          const v =
            h === "payload"
              ? JSON.stringify(r.payload ?? {})
              : String(row[h] ?? "");
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(",");
    }),
  ];
  return lines.join("\n");
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActivityLogPage() {
  const [actionType, setActionType] = useState<string | undefined>(undefined);
  const [userId, setUserId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(40);

  const filters = useMemo(
    () => ({
      actionType: actionType && actionType !== "all" ? actionType : undefined,
      userId: userId.trim() || undefined,
      departmentId: departmentId.trim() || undefined,
      from: from.trim() || undefined,
      to: to.trim() || undefined,
      limit,
    }),
    [actionType, userId, departmentId, from, to, limit],
  );

  const { data: rows = [], isLoading, refetch } = useActivityLogQuery({
    ...filters,
    offset: 0,
    enabled: isSupabaseConfigured,
  });

  const handleExport = (kind: "csv" | "json") => {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      toast.message("Nothing to export yet");
      return;
    }
    if (kind === "csv") {
      downloadText(
        `activity-log-${format(new Date(), "yyyyMMdd-HHmm")}.csv`,
        toCsv(list),
      );
      toast.success("Exported CSV");
    } else {
      downloadText(
        `activity-log-${format(new Date(), "yyyyMMdd-HHmm")}.json`,
        JSON.stringify(list, null, 2),
      );
      toast.success("Exported JSON");
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <AnimatedPage className="space-y-8">
        <PageHeader
          title="Activity log"
          description="Tenant-scoped audit stream requires Supabase configuration and the workflows-api Edge Function."
        />
        <div className="rounded-xl border border-border/80 bg-card/90 p-6 text-sm text-muted-foreground">
          Set <code className="text-primary">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-primary">VITE_SUPABASE_ANON_KEY</code>, then
          deploy <code className="text-primary">workflows-api</code> to query{" "}
          <code className="text-primary">activity_logs</code> with RLS.
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Activity log"
        description="Chronological, filterable audit of user actions, workflow runs, integrations, AI, and system alerts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="cta"
              size="sm"
              onClick={() => handleExport("csv")}
            >
              <Download className="mr-1 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExport("json")}
            >
              Export JSON
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-card">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4 text-primary" />
          Filters
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>Event type</Label>
            <Select
              value={actionType ?? "all"}
              onValueChange={(v) => setActionType(v)}
            >
              <SelectTrigger className="bg-input border-border/60">
                <SelectValue placeholder="Event type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="actor">Actor user ID</Label>
            <Input
              id="actor"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="UUID"
              className="bg-input border-border/60 font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept">Department ID</Label>
            <Input
              id="dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="UUID"
              className="bg-input border-border/60 font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">From (ISO)</Label>
            <Input
              id="from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="2026-04-01T00:00:00Z"
              className="bg-input border-border/60 font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To (ISO)</Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="2026-04-30T23:59:59Z"
              className="bg-input border-border/60 font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lim">Page size</Label>
            <Select
              value={String(limit)}
              onValueChange={(v) => setLimit(Number(v))}
            >
              <SelectTrigger id="lim" className="bg-input border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="40">40</SelectItem>
                <SelectItem value="80">80</SelectItem>
                <SelectItem value="120">120</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Timeline
        </p>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <ul className="space-y-2">
            {(rows ?? []).map((row) => (
              <li key={row.id}>
                <Collapsible className="group rounded-xl border border-border/70 bg-surface-inner/60 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card">
                  <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">
                        {format(new Date(row.created_at), "PPpp")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {row.event_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Actor:{" "}
                        <span className="font-mono text-foreground/90">
                          {row.actor_user_id ?? "system"}
                        </span>
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-border/60 px-4 pb-4 pt-2">
                    <dl className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-foreground">Related</dt>
                        <dd className="font-mono">
                          {row.related_entity ?? "—"} · {row.related_id ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-foreground">
                          Department
                        </dt>
                        <dd className="font-mono">{row.department_id ?? "—"}</dd>
                      </div>
                    </dl>
                    <pre
                      className={cn(
                        "mt-3 max-h-48 overflow-auto rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-[11px] text-muted-foreground",
                      )}
                    >
                      {JSON.stringify(row.payload ?? {}, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            ))}
          </ul>
        )}
        {!isLoading && (rows ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/60 p-10 text-center text-sm text-muted-foreground">
            No events match these filters. Adjust filters or generate workflow
            activity to populate the stream.
          </div>
        ) : null}
        {!isLoading && (rows ?? []).length >= limit ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setLimit((l) => l + 40)}
          >
            Load more
          </Button>
        ) : null}
      </div>
    </AnimatedPage>
  );
}
