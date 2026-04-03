import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";

import {
  ActivityLogExportButtons,
  buildAppliedFiltersFromForm,
} from "@/components/activity-log/activity-log-export-buttons";
import {
  ActivityLogFilterBar,
  type ActivityLogFilterValues,
} from "@/components/activity-log/activity-log-filter-bar";
import { LogCard } from "@/components/activity-log/log-card";
import { RedactionToggle } from "@/components/activity-log/redaction-toggle";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useTenantActivityLogsQuery } from "@/hooks/use-activity-logs";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ActivityLogEntry } from "@/types/activity-log";

const emptyFilters: ActivityLogFilterValues = {
  eventTypes: [],
  actorUserId: "",
  departmentId: "",
  workflowRunId: "",
  connectorId: "",
  integrationId: "",
  aiActionId: "",
  from: "",
  to: "",
  search: "",
};

function groupEntriesByDate(entries: ActivityLogEntry[]) {
  const list = Array.isArray(entries) ? entries : [];
  const map = new Map<string, ActivityLogEntry[]>();
  for (const e of list) {
    let key = "Unknown date";
    try {
      key = format(parseISO(e.created_at), "EEEE, MMMM d, yyyy");
    } catch {
      key = e.created_at?.slice(0, 10) ?? key;
    }
    const bucket = map.get(key) ?? [];
    bucket.push(e);
    map.set(key, bucket);
  }
  return [...map.entries()];
}

function payloadRecord(
  v: unknown,
): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

export default function ActivityLogPage() {
  const { profile } = useAuth();
  const [draft, setDraft] = useState<ActivityLogFilterValues>(emptyFilters);
  const [applied, setApplied] = useState<ActivityLogFilterValues>(emptyFilters);
  const [limit, setLimit] = useState(50);
  const [showRedacted, setShowRedacted] = useState(false);

  const canViewFullPayloadClient = useMemo(() => {
    const r = (profile?.roles ?? []).map((x) => String(x).toLowerCase());
    return r.some((x) =>
      ["admin", "owner", "super_admin", "compliance_auditor", "auditor"].includes(x),
    );
  }, [profile?.roles]);

  const appliedExport = useMemo(
    () => buildAppliedFiltersFromForm(applied),
    [applied],
  );

  const eventTypesForQuery =
    Array.isArray(applied.eventTypes) && applied.eventTypes.length > 0
      ? applied.eventTypes
      : undefined;

  const { data, isLoading, isError, refetch } = useTenantActivityLogsQuery({
    eventTypes: eventTypesForQuery,
    dateFrom: appliedExport.dateFrom,
    dateTo: appliedExport.dateTo,
    actorUserId: appliedExport.actorUserId,
    workflowRunId: appliedExport.workflowRunId,
    departmentId: appliedExport.departmentId,
    connectorId: appliedExport.connectorId,
    integrationId: appliedExport.integrationId,
    aiActionId: appliedExport.aiActionId?.trim() || undefined,
    search: appliedExport.search,
    limit,
    offset: 0,
    includeRedactedOnly: canViewFullPayloadClient && showRedacted,
    enabled: isSupabaseConfigured,
  });

  const entries = useMemo(() => {
    const raw = data?.entries;
    return Array.isArray(raw) ? raw : [];
  }, [data?.entries]);

  const canViewFullPayload =
    Boolean(data?.canViewFullPayload) || canViewFullPayloadClient;

  const grouped = useMemo(() => groupEntriesByDate(entries), [entries]);

  if (!isSupabaseConfigured) {
    return (
      <AnimatedPage className="space-y-8">
        <PageHeader
          title="Activity log"
          description="Tenant-scoped audit stream requires Supabase configuration and the activity-logs-api Edge Function."
        />
        <div className="rounded-xl border border-border/80 bg-card/90 p-6 text-sm text-muted-foreground">
          Set <code className="text-primary">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-primary">VITE_SUPABASE_ANON_KEY</code>, then
          deploy <code className="text-primary">activity-logs-api</code> to
          query <code className="text-primary">activity_logs</code> with RLS.
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Activity log"
        description="Immutable, tenant-scoped audit trail with filters, payload redaction, and CSV/JSON export."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Refresh
            </Button>
            <ActivityLogExportButtons
              appliedFilters={appliedExport}
              disabled={isLoading}
            />
          </div>
        }
      />

      <RedactionToggle
        canToggle={canViewFullPayload}
        showRedacted={showRedacted}
        onShowRedactedChange={setShowRedacted}
      />

      <ActivityLogFilterBar
        values={draft}
        onChange={setDraft}
        onApply={() => {
          setApplied({ ...draft });
          setLimit(50);
        }}
      />

      {isError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          Unable to load activity logs. Check your session and Edge Function
          deployment.
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Timeline
            </p>
            <p className="text-sm text-muted-foreground">
              {typeof data?.total === "number"
                ? `Showing ${entries.length} of ${data.total}+ events`
                : `${entries.length} events`}
              {profile?.roles?.length
                ? ` · Role: ${profile.roles.join(", ")}`
                : null}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl bg-surface-inner" />
            <Skeleton className="h-16 w-full rounded-xl bg-surface-inner" />
            <Skeleton className="h-16 w-full rounded-xl bg-surface-inner" />
          </div>
        ) : (
          grouped.map(([label, rows]) => {
            const rowList = Array.isArray(rows) ? rows : [];
            return (
              <section key={label} aria-labelledby={`log-date-${label}`}>
                <h2
                  id={`log-date-${label}`}
                  className="mb-3 text-sm font-semibold text-foreground"
                >
                  {label}
                </h2>
                <ul className="space-y-2">
                  {rowList.map((row) => (
                    <li key={row.id}>
                      <LogCard
                        entry={row}
                        displayPayload={payloadRecord(row.payload)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        {!isLoading && entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/60 p-10 text-center text-sm text-muted-foreground">
            No events match these filters. Adjust filters or generate workflow
            and integration activity to populate the stream.
          </div>
        ) : null}

        {!isLoading && entries.length >= limit ? (
          <Button
            type="button"
            variant="outline"
            className="w-full transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transform-none"
            onClick={() => setLimit((l) => l + 50)}
          >
            Load more
          </Button>
        ) : null}
      </div>
    </AnimatedPage>
  );
}
