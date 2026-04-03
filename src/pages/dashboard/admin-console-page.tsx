import { AlertTriangle, Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import {
  useAdminActivityTailQuery,
  useAdminFeatureFlagsQuery,
  useAdminFlagsUpsertMutation,
  useAdminPruneRetentionMutation,
  useAdminSystemTemplatesQuery,
  useAdminTemplateDeleteMutation,
  useAdminTemplatesUpsertMutation,
  useAdminTenantCreateMutation,
} from "@/hooks/use-activity-logs";
import {
  useAdminIntegrationOverviewQuery,
  useAdminTenantsQuery,
} from "@/hooks/use-integrations";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CHART_PRIMARY = "#9AD0FF";
const CHART_SUCCESS = "#00D27A";

function isSuperAdminRole(roles: string[] | undefined): boolean {
  const r = Array.isArray(roles) ? roles : [];
  return r.map((x) => String(x).toLowerCase()).includes("super_admin");
}

export default function AdminConsolePage() {
  const { profile } = useAuth();
  const isSuper = isSuperAdminRole(profile?.roles);

  const tenantsQuery = useAdminTenantsQuery();
  const overviewQuery = useAdminIntegrationOverviewQuery();
  const templatesQuery = useAdminSystemTemplatesQuery(isSuper);
  const flagsQuery = useAdminFeatureFlagsQuery(undefined, isSuper);
  const auditQuery = useAdminActivityTailQuery(80, isSuper);

  const tenantCreate = useAdminTenantCreateMutation();
  const tplUpsert = useAdminTemplatesUpsertMutation();
  const tplDelete = useAdminTemplateDeleteMutation();
  const flagUpsert = useAdminFlagsUpsertMutation();
  const pruneRetention = useAdminPruneRetentionMutation();

  const [tenantName, setTenantName] = useState("");
  const [tenantDomain, setTenantDomain] = useState("");

  const [tplKey, setTplKey] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("module");
  const [tplDef, setTplDef] = useState("{}");

  const [flagKey, setFlagKey] = useState("");
  const [flagTenantId, setFlagTenantId] = useState("");
  const [flagEnabled, setFlagEnabled] = useState(false);

  const tenants = Array.isArray(tenantsQuery.data) ? tenantsQuery.data : [];
  const overview = Array.isArray(overviewQuery.data) ? overviewQuery.data : [];
  const templates = Array.isArray(templatesQuery.data)
    ? templatesQuery.data
    : [];
  const flags = Array.isArray(flagsQuery.data) ? flagsQuery.data : [];
  const auditRows = Array.isArray(auditQuery.data) ? auditQuery.data : [];

  const chartData = overview.map((row) => ({
    name: row.name.length > 12 ? `${row.name.slice(0, 12)}…` : row.name,
    healthy: row.healthy,
    connectors: row.connectorCount,
  }));

  const isForbidden =
    tenantsQuery.isError || overviewQuery.isError;

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Admin console"
        description="Platform operations: tenants, integration monitors, system templates, feature flags, and admin audit trail."
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-surface-inner/80 p-1">
          <TabsTrigger value="overview" className="rounded-lg">
            Overview
          </TabsTrigger>
          <TabsTrigger value="provision" className="rounded-lg" disabled={!isSuper}>
            Provision tenant
          </TabsTrigger>
          <TabsTrigger value="templates" className="rounded-lg" disabled={!isSuper}>
            Templates
          </TabsTrigger>
          <TabsTrigger value="flags" className="rounded-lg" disabled={!isSuper}>
            Feature flags
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg" disabled={!isSuper}>
            Admin audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {isForbidden ? (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-primary/25 bg-surface-inner p-4"
            >
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                aria-hidden
              />
              <div>
                <p className="font-semibold text-foreground">
                  Limited admin visibility
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live cross-tenant data requires{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    super_admin
                  </code>{" "}
                  on your profile and{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    SUPABASE_SERVICE_ROLE_KEY
                  </code>{" "}
                  on the Edge Function. Demo data may still appear when Supabase is
                  not configured.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-border/80 bg-card/90 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Integration health by tenant</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Connector counts vs healthy connectors (last 25 tenants)
                  </p>
                </div>
                <Shield className="h-5 w-5 text-primary" aria-hidden />
              </CardHeader>
              <CardContent className="h-[280px]">
                {overviewQuery.isLoading ? (
                  <Skeleton className="h-full w-full rounded-xl bg-surface-inner" />
                ) : chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No overview rows yet. Connect integrations per tenant to
                    populate this chart.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke="rgba(255,255,255,0.06)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#8FA0B0", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#8FA0B0", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0F1720",
                          border: "1px solid rgba(21,78,120,0.35)",
                          borderRadius: 12,
                        }}
                        labelStyle={{ color: "#F7FAFF" }}
                      />
                      <Bar
                        dataKey="healthy"
                        name="Healthy"
                        fill={CHART_SUCCESS}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="connectors"
                        name="Total connectors"
                        fill={CHART_PRIMARY}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle>Signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border/60 bg-surface-inner p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Templates
                  </p>
                  <p className="mt-2 text-foreground">
                    Module starter packs and workflow blueprints ship from this
                    console.
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface-inner p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Feature flags
                  </p>
                  <p className="mt-2 text-foreground">
                    Roll out connector adapters gradually with tenant-scoped
                    flags.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Tenants</CardTitle>
            </CardHeader>
            <CardContent>
              {tenantsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full bg-surface-inner" />
                  <Skeleton className="h-10 w-full bg-surface-inner" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Connectors</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenants.map((t) => {
                      const match = overview.find((o) => o.companyId === t.id);
                      const count = match?.connectorCount ?? 0;
                      const healthy = match?.healthy ?? 0;
                      const healthLabel =
                        count === 0
                          ? "idle"
                          : healthy === count
                            ? "green"
                            : "amber";
                      return (
                        <TableRow key={t.id} className="border-border/60">
                          <TableCell className="font-medium text-foreground">
                            {t.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(t.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{count}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                healthLabel === "green" &&
                                  "border-success/50 text-success",
                                healthLabel === "amber" &&
                                  "border-primary/50 text-primary",
                                healthLabel === "idle" &&
                                  "text-muted-foreground",
                              )}
                            >
                              {healthLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              disabled
                            >
                              Impersonate
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {!tenantsQuery.isLoading && tenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tenants returned. Assign super_admin or seed companies.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="provision" className="mt-6">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Create tenant</CardTitle>
              <p className="text-sm text-muted-foreground">
                Inserts a company row and logs an admin_action entry for the new
                tenant.
              </p>
            </CardHeader>
            <CardContent className="max-w-lg space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tn">Company name</Label>
                <Input
                  id="tn"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="bg-input border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="td">Domain hint (optional)</Label>
                <Input
                  id="td"
                  value={tenantDomain}
                  onChange={(e) => setTenantDomain(e.target.value)}
                  className="bg-input border-border/60"
                />
              </div>
              <Button
                type="button"
                variant="cta"
                disabled={tenantCreate.isPending || !tenantName.trim()}
                onClick={() => {
                  void tenantCreate
                    .mutateAsync({
                      name: tenantName.trim(),
                      domain: tenantDomain.trim() || undefined,
                    })
                    .then((res) => {
                      if (res) {
                        toast.success(`Tenant ${res.name} created`);
                        setTenantName("");
                        setTenantDomain("");
                      } else toast.error("Create failed");
                    });
                }}
              >
                {tenantCreate.isPending ? "Creating…" : "Create tenant"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-6 space-y-6">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Upsert template</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tk">Template key</Label>
                <Input
                  id="tk"
                  value={tplKey}
                  onChange={(e) => setTplKey(e.target.value)}
                  className="font-mono text-xs bg-input border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tn2">Display name</Label>
                <Input
                  id="tn2"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  className="bg-input border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tc">Category</Label>
                <Input
                  id="tc"
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value)}
                  className="bg-input border-border/60"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="tdj">Definition (JSON)</Label>
                <Textarea
                  id="tdj"
                  value={tplDef}
                  onChange={(e) => setTplDef(e.target.value)}
                  rows={6}
                  className="font-mono text-xs bg-input border-border/60"
                />
              </div>
              <Button
                type="button"
                variant="cta"
                disabled={tplUpsert.isPending}
                onClick={() => {
                  let parsed: Record<string, unknown> = {};
                  try {
                    parsed = JSON.parse(tplDef || "{}") as Record<string, unknown>;
                  } catch {
                    toast.error("Invalid JSON");
                    return;
                  }
                  void tplUpsert
                    .mutateAsync({
                      templateKey: tplKey.trim(),
                      name: tplName.trim(),
                      category: tplCategory.trim(),
                      definition: parsed,
                    })
                    .then((r) => {
                      if (r) toast.success("Template saved");
                      else toast.error("Save failed");
                    });
                }}
              >
                Save template
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Catalog</CardTitle>
            </CardHeader>
            <CardContent>
              {templatesQuery.isLoading ? (
                <Skeleton className="h-24 w-full bg-surface-inner" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead>Key</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id} className="border-border/60">
                        <TableCell className="font-mono text-xs">
                          {t.template_key}
                        </TableCell>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.version}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${t.template_key}`}
                            onClick={() => {
                              void tplDelete.mutateAsync(t.id).then((ok) => {
                                if (ok) toast.success("Deleted");
                                else toast.error("Delete failed");
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!templatesQuery.isLoading && templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="mt-6 space-y-6">
          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Upsert flag</CardTitle>
              <p className="text-sm text-muted-foreground">
                Leave tenant ID empty for a global flag.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fk">Flag key</Label>
                <Input
                  id="fk"
                  value={flagKey}
                  onChange={(e) => setFlagKey(e.target.value)}
                  className="bg-input border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fcid">Tenant company ID (optional)</Label>
                <Input
                  id="fcid"
                  value={flagTenantId}
                  onChange={(e) => setFlagTenantId(e.target.value)}
                  placeholder="UUID or empty"
                  className="font-mono text-xs bg-input border-border/60"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="fe"
                  checked={flagEnabled}
                  onCheckedChange={setFlagEnabled}
                />
                <Label htmlFor="fe">Enabled</Label>
              </div>
              <Button
                type="button"
                variant="cta"
                className="md:col-span-2"
                disabled={flagUpsert.isPending}
                onClick={() => {
                  const cid = flagTenantId.trim();
                  void flagUpsert
                    .mutateAsync({
                      flagKey: flagKey.trim(),
                      companyId: cid ? cid : null,
                      enabled: flagEnabled,
                      payload: {},
                    })
                    .then((r) => {
                      if (r) toast.success("Flag saved");
                      else toast.error("Save failed");
                    });
                }}
              >
                Save flag
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Existing flags</CardTitle>
            </CardHeader>
            <CardContent>
              {flagsQuery.isLoading ? (
                <Skeleton className="h-24 w-full bg-surface-inner" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead>Key</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Enabled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flags.map((f) => (
                      <TableRow key={f.id} className="border-border/60">
                        <TableCell className="font-mono text-xs">
                          {f.flag_key}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {f.company_id ?? "global"}
                        </TableCell>
                        <TableCell>{f.enabled ? "yes" : "no"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {!flagsQuery.isLoading && flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No flags yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-6">
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
                disabled={pruneRetention.isPending}
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

          <Card className="border-border/80 bg-card/90">
            <CardHeader>
              <CardTitle>Recent admin actions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cross-tenant admin_action events (service role read).
              </p>
            </CardHeader>
            <CardContent>
              {auditQuery.isLoading ? (
                <Skeleton className="h-32 w-full bg-surface-inner" />
              ) : (
                <ul className="space-y-2">
                  {auditRows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-lg border border-border/60 bg-surface-inner/50 px-3 py-2 text-sm"
                    >
                      <p className="font-mono text-xs text-muted-foreground">
                        {(() => {
                          try {
                            return format(
                              new Date(row.created_at),
                              "PPpp",
                            );
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
              {!auditQuery.isLoading && auditRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No admin actions logged yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
