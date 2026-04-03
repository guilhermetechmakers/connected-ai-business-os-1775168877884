import { Plug } from "lucide-react";

import { LiveStatusChip } from "@/components/admin-console/live-status-chip";
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
import { useAdminIntegrationOverviewQuery } from "@/hooks/use-integrations";

export function IntegrationsAdminPanel() {
  const overviewQuery = useAdminIntegrationOverviewQuery();
  const overview = Array.isArray(overviewQuery.data) ? overviewQuery.data : [];

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Plug className="h-5 w-5 text-primary" aria-hidden />
        <div>
          <CardTitle>Integration registry</CardTitle>
          <p className="text-sm text-muted-foreground">
            Per-tenant connector counts and health snapshots. Configure credentials in tenant
            settings or onboarding flows.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {overviewQuery.isLoading ? (
          <Skeleton className="h-40 w-full bg-surface-inner" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/60">
                <TableHead>Tenant</TableHead>
                <TableHead>Connectors</TableHead>
                <TableHead>Healthy</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(overview ?? []).map((row) => {
                const total = row.connectorCount ?? 0;
                const ok = row.healthy ?? 0;
                const variant =
                  total === 0 ? "idle" : ok === total ? "live" : "syncing";
                const label =
                  total === 0 ? "Idle" : ok === total ? "All healthy" : "Degraded";
                return (
                  <TableRow
                    key={row.companyId}
                    className="border-border/60 transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="font-medium text-foreground">
                      {row.name}
                    </TableCell>
                    <TableCell>{total}</TableCell>
                    <TableCell>{ok}</TableCell>
                    <TableCell>
                      <LiveStatusChip variant={variant} label={label} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!overviewQuery.isLoading && overview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No integration overview yet. Connect a connector to see per-tenant status.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
