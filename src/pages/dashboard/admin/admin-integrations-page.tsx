import {
  AdminIntegrationsPanel,
  IntegrationsAdminPanel,
  useIsPrivilegedTenantAdmin,
} from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";
import {
  useAdminIntegrationOverviewQuery,
  useAdminTenantsQuery,
} from "@/hooks/use-integrations";
import { useTenantsAdminListQuery } from "@/hooks/use-tenants-module";

export default function AdminIntegrationsPage() {
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

  return (
    <AnimatedPage className="space-y-6">
      <AdminIntegrationsPanel
        tenantCount={tenantCount}
        overviewRows={overview.length}
      />
      <IntegrationsAdminPanel />
    </AnimatedPage>
  );
}
