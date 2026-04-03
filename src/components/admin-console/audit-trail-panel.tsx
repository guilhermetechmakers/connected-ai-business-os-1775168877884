import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useAdminActivityTailQuery,
  useAdminPruneRetentionMutation,
} from "@/hooks/use-activity-logs";
import { useAuth } from "@/contexts/auth-context";
import {
  isPlatformAuditorProfile,
  isSuperAdminProfile,
} from "@/lib/admin-rbac";
import { format } from "date-fns";

export type AuditTrailPanelMode = "full" | "maintenance" | "forensic";

export interface AuditTrailPanelProps {
  mode?: AuditTrailPanelMode;
}

export function AuditTrailPanel({ mode = "full" }: AuditTrailPanelProps) {
  const { profile } = useAuth();
  const isSuper = isSuperAdminProfile(profile?.roles);
  const isAuditor = isPlatformAuditorProfile(profile?.roles);
  const canTail = isSuper || isAuditor;

  const auditQuery = useAdminActivityTailQuery(120, canTail);
  const pruneRetention = useAdminPruneRetentionMutation();
  const [query, setQuery] = useState("");
  const [aiOnly, setAiOnly] = useState(false);

  const auditRows = Array.isArray(auditQuery.data) ? auditQuery.data : [];

  const filtered = useMemo(() => {
    const qv = query.trim().toLowerCase();
    return (auditRows ?? []).filter((row) => {
      const payload = row.payload as Record<string, unknown> | undefined;
      const aiHint =
        row.ai_triggered === true ||
        (typeof payload?.ai === "boolean"
          ? payload.ai
          : typeof payload?.ai_triggered === "boolean"
            ? payload.ai_triggered
            : false);
      if (aiOnly && !aiHint) return false;
      if (!qv) return true;
      const blob =
        `${row.event_type} ${row.company_id} ${JSON.stringify(row.payload ?? {})}`.toLowerCase();
      return blob.includes(qv);
    });
  }, [auditRows, query, aiOnly]);

  const showMaintenance = mode === "full" || mode === "maintenance";
  const showForensic = mode === "full" || mode === "forensic";

  return (
    <div className="space-y-6">
      {showMaintenance ? (
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Retention prune</CardTitle>
            <p className="text-sm text-muted-foreground">
              Deletes activity log rows older than each tenant&apos;s{" "}
              <code className="rounded bg-muted px-1 text-xs">
                activity_log_retention_days
              </code>{" "}
              (default 365). Uses the service role; irreversible.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="border-primary/30"
              disabled={!isSuper || pruneRetention.isPending}
              onClick={() => {
                void pruneRetention.mutateAsync().then((r) => {
                  if (r) {
                    toast.success(
                      `Pruned ${r.rowsDeleted} row(s) across ${r.tenantsProcessed} tenant(s).`,
                    );
                  } else {
                    toast.error("Prune failed or unauthorized.");
                  }
                });
              }}
            >
              {pruneRetention.isPending ? "Pruning…" : "Run retention prune"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showForensic ? (
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Forensic audit trail</CardTitle>
            <p className="text-sm text-muted-foreground">
              Cross-tenant <code className="text-xs">admin_action</code> events (service
              role). Database view <code className="text-xs">audit_trail_forensic</code>{" "}
              mirrors activity logs for compliance exports.
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex-1 space-y-2">
                <Label htmlFor="audit-q">Search</Label>
                <Input
                  id="audit-q"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tenant, action, payload…"
                  className="bg-input border-border/60"
                />
              </div>
              <div className="flex items-center gap-2 pt-6 sm:pt-8">
                <Switch id="audit-ai" checked={aiOnly} onCheckedChange={setAiOnly} />
                <Label htmlFor="audit-ai">AI-tagged payloads only</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {auditQuery.isLoading ? (
              <Skeleton className="h-32 w-full bg-surface-inner" />
            ) : (
              <ul className="space-y-2">
                {(filtered ?? []).map((row) => (
                  <li
                    key={row.id}
                    className="rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2 text-sm"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {(() => {
                        try {
                          return format(new Date(row.created_at), "PPpp");
                        } catch {
                          return row.created_at;
                        }
                      })()}{" "}
                      · {row.company_id}
                    </p>
                    <p className="mt-1 text-primary">{row.event_type}</p>
                    <pre className="mt-2 max-h-24 overflow-auto text-[11px] text-muted-foreground">
                      {JSON.stringify(row.payload ?? {}, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
            {!auditQuery.isLoading && filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No admin actions logged yet, or nothing matches filters.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
