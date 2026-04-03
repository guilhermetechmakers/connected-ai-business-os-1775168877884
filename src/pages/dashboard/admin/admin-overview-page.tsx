import { AdminOverviewPanel, useIsPrivilegedTenantAdmin } from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import {
  useAdminIntegrationOverviewQuery,
  useAdminTenantsQuery,
} from "@/hooks/use-integrations";
import { useTenantsAdminListQuery } from "@/hooks/use-tenants-module";

export default function AdminOverviewPage() {
  const isPrivileged = useIsPrivilegedTenantAdmin();
  const tenantsQuery = useAdminTenantsQuery();
  const overviewQuery = useAdminIntegrationOverviewQuery();
  const tenantsModuleQuery = useTenantsAdminListQuery({
    enabled: isPrivileged,
    limit: 80,
  });

  const moduleTenants = Array.isArray(tenantsModuleQuery.data?.tenants)
    ? tenantsModuleQuery.data.tenants
    : [];
  const legacyTenants = Array.isArray(tenantsQuery.data) ? tenantsQuery.data : [];
  const tenantCount =
    isPrivileged && moduleTenants.length > 0 ? moduleTenants.length : legacyTenants.length;

  const overview = Array.isArray(overviewQuery.data) ? overviewQuery.data : [];
  const chartData = (overview ?? []).map((row) => ({
    name: row.name.length > 12 ? `${row.name.slice(0, 12)}…` : row.name,
    healthy: row.healthy,
    connectors: row.connectorCount,
  }));

  const isForbidden = tenantsQuery.isError || overviewQuery.isError;
  const isLoading = overviewQuery.isLoading;
  const activeIntegrationHints = (overview ?? []).reduce(
    (acc, r) => acc + (r.healthy ?? 0),
    0,
  );

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Overview"
        description="Cross-tenant health, connector signals, and quick orientation for platform operators."
      />
      <AdminOverviewPanel
        isForbidden={isForbidden}
        isLoading={isLoading}
        chartData={chartData}
        activeIntegrationHints={tenantCount > 0 ? activeIntegrationHints : 0}
      />
    </AnimatedPage>
  );
}
