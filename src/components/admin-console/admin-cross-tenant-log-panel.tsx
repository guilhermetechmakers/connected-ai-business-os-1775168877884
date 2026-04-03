import { format } from "date-fns";
import { Filter, Search } from "lucide-react";
import { useState } from "react";

import { LiveStatusChip } from "@/components/admin-console/live-status-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminActivitySearchQuery,
  useAdminAuditSearchQuery,
} from "@/hooks/use-activity-logs";
import { cn } from "@/lib/utils";

import { useIsPrivilegedTenantAdmin } from "./admin-role";

type AdminCrossTenantLogPanelProps = {
  variant: "activity" | "audit";
};

export function AdminCrossTenantLogPanel({
  variant,
}: AdminCrossTenantLogPanelProps) {
  const isPrivileged = useIsPrivilegedTenantAdmin();
  const [draftSearch, setDraftSearch] = useState("");
  const [draftCompany, setDraftCompany] = useState("");
  const [draftActor, setDraftActor] = useState("");
  const [aiOnly, setAiOnly] = useState(false);

  const [applied, setApplied] = useState({
    search: "",
    companyId: "",
    actorUserId: "",
    aiTriggeredOnly: false,
  });

  const activityQ = useAdminActivitySearchQuery({
    search: applied.search || undefined,
    companyId: applied.companyId.trim() || undefined,
    actorUserId: applied.actorUserId.trim() || undefined,
    aiTriggeredOnly: applied.aiTriggeredOnly || undefined,
    limit: 50,
    offset: 0,
    enabled: variant === "activity" && isPrivileged,
  });

  const auditQ = useAdminAuditSearchQuery({
    search: applied.search || undefined,
    companyId: applied.companyId.trim() || undefined,
    actorUserId: applied.actorUserId.trim() || undefined,
    aiTriggeredOnly: applied.aiTriggeredOnly || undefined,
    limit: 50,
    offset: 0,
    enabled: variant === "audit" && isPrivileged,
  });

  const q = variant === "activity" ? activityQ : auditQ;
  const entries = Array.isArray(q.data?.entries) ? q.data.entries : [];
  const total = typeof q.data?.total === "number" ? q.data.total : entries.length;

  const applyFilters = () => {
    setApplied({
      search: draftSearch.trim(),
      companyId: draftCompany.trim(),
      actorUserId: draftActor.trim(),
      aiTriggeredOnly: aiOnly,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/90">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              {variant === "activity"
                ? "Cross-tenant activity"
                : "Audit trail (compliance)"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {variant === "activity"
                ? "Search all tenant activity logs (service role)."
                : "Forensic view with default governance event types."}
            </p>
          </div>
          <LiveStatusChip
            variant={q.isError ? "error" : q.isFetching ? "idle" : "live"}
            label={q.isError ? "query error" : q.isFetching ? "loading" : "live search"}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`act-search-${variant}`}>Search (event type)</Label>
              <Input
                id={`act-search-${variant}`}
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                placeholder="e.g. admin_action"
                className="bg-input border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`act-company-${variant}`}>Tenant company ID</Label>
              <Input
                id={`act-company-${variant}`}
                value={draftCompany}
                onChange={(e) => setDraftCompany(e.target.value)}
                placeholder="UUID"
                className="font-mono text-xs bg-input border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`act-actor-${variant}`}>Actor user ID</Label>
              <Input
                id={`act-actor-${variant}`}
                value={draftActor}
                onChange={(e) => setDraftActor(e.target.value)}
                placeholder="UUID"
                className="font-mono text-xs bg-input border-border/60"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`act-ai-${variant}`}
                checked={aiOnly}
                onCheckedChange={(c) => setAiOnly(c === true)}
              />
              <Label htmlFor={`act-ai-${variant}`} className="text-sm font-normal">
                AI-triggered only
              </Label>
            </div>
            <Button
              type="button"
              variant="cta"
              size="sm"
              className="gap-2"
              onClick={() => applyFilters()}
            >
              <Search className="h-4 w-4" aria-hidden />
              Apply filters
            </Button>
            <span className="text-xs text-muted-foreground">
              <Filter className="mr-1 inline h-3 w-3" aria-hidden />
              {total} match(es)
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-40 w-full bg-surface-inner" />
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rows for this query.</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs text-muted-foreground">
                      {(() => {
                        try {
                          return format(new Date(row.created_at), "PPpp");
                        } catch {
                          return row.created_at;
                        }
                      })()}
                    </p>
                    <span className="text-xs text-muted-foreground">·</span>
                    <p className="font-mono text-xs text-muted-foreground">
                      {row.company_id}
                    </p>
                    {row.ai_triggered ? (
                      <span
                        className={cn(
                          "rounded-full border border-success/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success",
                        )}
                      >
                        AI
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-primary">{row.event_type}</p>
                  <pre className="mt-2 max-h-28 overflow-auto text-[11px] text-muted-foreground">
                    {JSON.stringify(row.payload ?? {}, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
