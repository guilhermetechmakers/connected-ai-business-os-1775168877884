import { Loader2, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { CustomDashboardRuntime } from "@/components/custom-dashboards/custom-dashboard-runtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useCustomDashboardDetailQuery,
  useCustomDashboardsFeatureQuery,
  useDeleteCustomDashboardMutation,
  useRefreshCustomDashboardMutation,
  useUpdateCustomDashboardMetaMutation,
} from "@/hooks/use-custom-dashboards";
import { useSettingsRolesQuery } from "@/hooks/use-settings-hub";
import type { CustomDashboardQueryPlanStep, CustomDashboardVisibilityMode } from "@/types/dashboard";

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "n/a";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
}

function normalizeQueryPlan(raw: unknown): CustomDashboardQueryPlanStep[] {
  if (!Array.isArray(raw)) return [];
  const normalized: CustomDashboardQueryPlanStep[] = [];
  for (const step of raw) {
    if (!step || typeof step !== "object") continue;
    const row = step as Record<string, unknown>;
    if (typeof row.toolId !== "string" || row.toolId.length === 0) continue;

    const next: CustomDashboardQueryPlanStep = {
      toolId: row.toolId,
      args: row.args && typeof row.args === "object" ? (row.args as Record<string, unknown>) : {},
    };

    if (typeof row.provider === "string" && row.provider.length > 0) {
      next.provider = row.provider;
    }
    if (typeof row.label === "string" && row.label.length > 0) {
      next.label = row.label;
    }

    normalized.push(next);
  }
  return normalized;
}

function normalizeSnapshot(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export default function CustomDashboardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const featureQ = useCustomDashboardsFeatureQuery();
  const detailQ = useCustomDashboardDetailQuery(id);
  const rolesQ = useSettingsRolesQuery();
  const updateMeta = useUpdateCustomDashboardMetaMutation();
  const refreshMutation = useRefreshCustomDashboardMutation();
  const deleteMutation = useDeleteCustomDashboardMutation();

  const dashboard = detailQ.data?.dashboard ?? null;
  const runs = Array.isArray(detailQ.data?.runs) ? detailQ.data?.runs : [];
  const availableRoles = Array.isArray(rolesQ.data) ? rolesQ.data : [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibilityMode, setVisibilityMode] = useState<CustomDashboardVisibilityMode>("roles");
  const [sharedRoles, setSharedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!dashboard) return;
    setTitle(dashboard.title ?? "");
    setDescription(dashboard.description ?? "");
    setVisibilityMode(
      dashboard.visibility_mode === "company" || dashboard.visibility_mode === "private"
        ? dashboard.visibility_mode
        : "roles",
    );
    setSharedRoles(Array.isArray(dashboard.shared_roles) ? dashboard.shared_roles : []);
  }, [dashboard]);

  const queryPlan = useMemo(
    () => normalizeQueryPlan(dashboard?.query_plan),
    [dashboard?.query_plan],
  );
  const snapshotData = useMemo(
    () => normalizeSnapshot(dashboard?.snapshot_data),
    [dashboard?.snapshot_data],
  );
  const sources = useMemo(
    () => (Array.isArray(dashboard?.integration_sources) ? dashboard.integration_sources : []),
    [dashboard?.integration_sources],
  );

  if (!id) return <Navigate to="/dashboard/custom-dashboards" replace />;

  if (featureQ.isLoading) {
    return <Skeleton className="h-48 rounded-2xl bg-surface-inner" />;
  }

  if (!featureQ.enabled) {
    return (
      <AnimatedPage className="space-y-4">
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Feature disabled</CardTitle>
            <CardDescription>
              Enable <code className="text-xs">custom_dashboards_v1</code> in tenant flags to use this section.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/dashboard/settings/flags">Open feature flags</Link>
            </Button>
          </CardContent>
        </Card>
      </AnimatedPage>
    );
  }

  if (detailQ.isLoading) {
    return (
      <AnimatedPage className="space-y-3">
        <Skeleton className="h-12 rounded-xl bg-surface-inner" />
        <Skeleton className="h-[560px] rounded-2xl bg-surface-inner" />
      </AnimatedPage>
    );
  }

  if (!dashboard) {
    return (
      <AnimatedPage>
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Dashboard not found</CardTitle>
            <CardDescription>
              It may have been deleted or you may not have access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/dashboard/custom-dashboards">Back to catalog</Link>
            </Button>
          </CardContent>
        </Card>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{dashboard.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last refresh: {formatDateTime(dashboard.latest_run_at)} | Updated: {formatDateTime(dashboard.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void refreshMutation.mutateAsync(dashboard.id).then((result) => {
                if (!result) {
                  toast.error("Could not refresh dashboard data.");
                  return;
                }
                if (result.status === "failed") {
                  const first = Array.isArray(result.errors) && result.errors.length > 0
                    ? result.errors[0]
                    : "Refresh returned errors.";
                  toast.error(first);
                } else {
                  toast.success("Dashboard snapshot refreshed.");
                }
              });
            }}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Refresh data
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              const confirmed = window.confirm("Delete this custom dashboard? This cannot be undone.");
              if (!confirmed) return;
              void deleteMutation.mutateAsync(dashboard.id).then((res) => {
                if (!res.ok) {
                  toast.error("Could not delete dashboard.");
                  return;
                }
                toast.success("Dashboard deleted.");
                navigate("/dashboard/custom-dashboards", { replace: true });
              });
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <CustomDashboardRuntime
          codeTsx={dashboard.code_tsx}
          snapshotData={snapshotData}
          queryPlan={queryPlan}
          sources={sources}
          titleHint={dashboard.title}
        />

        <div className="space-y-4">
          <Card className="border-border/80 bg-card/90">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                Sharing and metadata
              </CardTitle>
              <CardDescription>
                Control title, description, and role-based visibility.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cd-title">Title</Label>
                <Input id="cd-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cd-description">Description</Label>
                <Textarea
                  id="cd-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <div className="grid gap-1.5 rounded-lg border border-border/70 p-2">
                  {([
                    ["private", "Private (creator only)"],
                    ["roles", "Shared roles"],
                    ["company", "Company-wide"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="radio"
                        name="visibility_mode"
                        value={value}
                        checked={visibilityMode === value}
                        onChange={() => setVisibilityMode(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {visibilityMode === "roles" ? (
                <div className="space-y-2">
                  <Label>Shared roles</Label>
                  <div className="max-h-44 space-y-1 overflow-auto rounded-lg border border-border/70 p-2">
                    {availableRoles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No tenant roles available.</p>
                    ) : (
                      availableRoles.map((role) => {
                        const checked = sharedRoles.includes(role.name.toLowerCase());
                        return (
                          <label key={role.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                setSharedRoles((prev) => {
                                  const next = new Set(prev);
                                  const roleName = role.name.toLowerCase();
                                  if (next.has(roleName)) next.delete(roleName);
                                  else next.add(roleName);
                                  return Array.from(next);
                                });
                              }}
                            />
                            <span>{role.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  void updateMeta.mutateAsync({
                    dashboardId: dashboard.id,
                    title: title.trim(),
                    description: description.trim() || null,
                    visibilityMode,
                    sharedRoles,
                  }).then((row) => {
                    if (!row) {
                      toast.error("Could not save metadata.");
                      return;
                    }
                    toast.success("Dashboard metadata saved.");
                  });
                }}
                disabled={updateMeta.isPending}
              >
                {updateMeta.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save settings"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent runs</CardTitle>
              <CardDescription>Latest refresh/generation run history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              {runs.length === 0 ? (
                <p>No runs yet.</p>
              ) : (
                runs.slice(0, 8).map((run) => (
                  <div key={run.id} className="rounded-md border border-border/60 bg-background/50 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {run.trigger_type} | {run.status}
                      </span>
                      <span>{formatDateTime(run.created_at)}</span>
                    </div>
                    {run.error_message ? (
                      <p className="mt-1 text-destructive">{run.error_message}</p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}
