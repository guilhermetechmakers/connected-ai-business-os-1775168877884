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

import { LiveStatusChip } from "@/components/admin-console/live-status-chip";
import { NotificationBadge } from "@/components/admin-console/notification-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_PRIMARY = "#9AD0FF";
const CHART_SUCCESS = "#00D27A";

export type OverviewChartRow = {
  name: string;
  healthy: number;
  connectors: number;
};

export type AdminOverviewPanelProps = {
  isForbidden: boolean;
  isLoading: boolean;
  chartData: OverviewChartRow[];
  activeIntegrationHints?: number;
};

export function AdminOverviewPanel({
  isForbidden,
  isLoading,
  chartData,
  activeIntegrationHints = 0,
}: AdminOverviewPanelProps) {
  return (
    <div className="space-y-6">
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
            <p className="font-semibold text-foreground">Limited admin visibility</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Live cross-tenant data requires{" "}
              <code className="rounded bg-muted px-1 text-xs">super_admin</code>,{" "}
              <code className="rounded bg-muted px-1 text-xs">compliance_auditor</code>
              , or <code className="rounded bg-muted px-1 text-xs">auditor</code> on
              your profile and{" "}
              <code className="rounded bg-muted px-1 text-xs">
                SUPABASE_SERVICE_ROLE_KEY
              </code>{" "}
              on Edge Functions. Demo data may still appear when Supabase is not
              configured.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-surface-inner/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <NotificationBadge count={activeIntegrationHints} pulse />
          <span className="text-sm text-muted-foreground">
            Connector activity signal
          </span>
        </div>
        <LiveStatusChip
          variant={isForbidden ? "idle" : "live"}
          label={isForbidden ? "degraded visibility" : "admin API reachable"}
        />
      </div>

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
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-xl bg-surface-inner" />
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No overview rows yet. Connect integrations per tenant to populate this
                chart.
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
    </div>
  );
}
