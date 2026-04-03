import { TenantCompanySettingsForm } from "@/components/settings/tenant-company-settings-form";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";

export default function SettingsCompanyPage() {
  const tenantSettingsQuery = useTenantSettingsQuery();

  return (
    <div className="space-y-6">
      <TenantCompanySettingsForm
        tenant={tenantSettingsQuery.data}
        isLoading={tenantSettingsQuery.isLoading}
        loadError={tenantSettingsQuery.isError}
      />
    </div>
  );
}
