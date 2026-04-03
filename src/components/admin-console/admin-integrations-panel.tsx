import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AdminIntegrationsPanelProps = {
  tenantCount: number;
  overviewRows: number;
};

export function AdminIntegrationsPanel({
  tenantCount,
  overviewRows,
}: AdminIntegrationsPanelProps) {
  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle>Cross-tenant integrations</CardTitle>
        <p className="text-sm text-muted-foreground">
          Per-tenant connectors and legacy integrations are monitored from the Tenants
          section. Expand a row to open the live connector registry for that company.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-surface-inner p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Tenants in scope
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">{tenantCount}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface-inner p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Overview samples
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">{overviewRows}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Rows powering the health chart (capped at 25).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
