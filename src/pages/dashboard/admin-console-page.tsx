import { AlertTriangle, Shield } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminIntegrationOverviewQuery,
  useAdminTenantsQuery,
} from "@/hooks/use-integrations";
import { cn } from "@/lib/utils";

const CHART_PRIMARY = "#9AD0FF";
const CHART_SUCCESS = "#00D27A";

export default function AdminConsolePage() {
  const tenantsQuery = useAdminTenantsQuery();
  const overviewQuery = useAdminIntegrationOverviewQuery();

  const tenants = Array.isArray(tenantsQuery.data) ? tenantsQuery.data : [];
  const overview = Array.isArray(overviewQuery.data) ? overviewQuery.data : [];

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
        description="Platform operations: tenant provisioning, integration monitors, templates, and feature flags. Uses integrations Edge Function with super_admin RBAC."
        actions={
          <Button variant="cta" size="sm" type="button">
            Provision tenant
          </Button>
        }
      />

      {isForbidden ? (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-primary/25 bg-surface-inner p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-semibold text-foreground">Limited admin visibility</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Live cross-tenant data requires{" "}
              <code className="rounded bg-muted px-1 text-xs">super_admin</code> on
              your profile and{" "}
              <code className="rounded bg-muted px-1 text-xs">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              on the Edge Function. Demo data may still appear when Supabase is not
              configured.
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
                No overview rows yet. Connect integrations per tenant to populate
                this chart.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
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
                  <Bar dataKey="healthy" name="Healthy" fill={CHART_SUCCESS} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="connectors" name="Total connectors" fill={CHART_PRIMARY} radius={[6, 6, 0, 0]} />
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
                Module starter packs and workflow blueprints ship from this console.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-surface-inner p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Feature flags
              </p>
              <p className="mt-2 text-foreground">
                Roll out connector adapters gradually with tenant-scoped flags.
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
                    count === 0 ? "idle" : healthy === count ? "green" : "amber";
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
                            healthLabel === "green" && "border-success/50 text-success",
                            healthLabel === "amber" && "border-primary/50 text-primary",
                            healthLabel === "idle" && "text-muted-foreground",
                          )}
                        >
                          {healthLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" type="button">
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
    </AnimatedPage>
  );
}
