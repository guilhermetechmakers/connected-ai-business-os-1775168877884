import {
  TenantManagementPanel,
  useIsPrivilegedTenantAdmin,
  useIsSuperAdmin,
} from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminTenantsPage() {
  const isSuper = useIsSuperAdmin();
  const isPrivileged = useIsPrivilegedTenantAdmin();

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Tenants"
        description="Provisioned companies, lifecycle controls, and per-tenant integration monitors."
      />
      <TenantManagementPanel isSuper={isSuper} isPrivileged={isPrivileged} />
    </AnimatedPage>
  );
}
