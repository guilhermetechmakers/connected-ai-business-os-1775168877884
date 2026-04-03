import { BrandingPanel } from "@/components/settings/branding-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantSettingsQuery } from "@/hooks/use-tenant-settings";

export default function SettingsBrandingPage() {
  const tenantSettingsQuery = useTenantSettingsQuery();

  return (
    <div className="space-y-8">
      {tenantSettingsQuery.isLoading ? (
        <Skeleton className="h-56 w-full max-w-2xl rounded-xl bg-surface-inner" />
      ) : tenantSettingsQuery.isError ? (
        <p className="text-sm text-muted-foreground">
          Company JSON branding requires tenant administrator access.
        </p>
      ) : (
        <BrandingPanel settings={tenantSettingsQuery.data?.settings} />
      )}
    </div>
  );
}
