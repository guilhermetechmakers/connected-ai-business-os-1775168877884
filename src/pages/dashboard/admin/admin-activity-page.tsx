import { AdminCrossTenantLogPanel, useIsPrivilegedTenantAdmin } from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Navigate } from "react-router-dom";

export default function AdminActivityPage() {
  const isPrivileged = useIsPrivilegedTenantAdmin();
  if (!isPrivileged) {
    return <Navigate to="/dashboard/admin/overview" replace />;
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Activity stream"
        description="Cross-tenant operational events with server-side filters when platform roles and service role are configured."
      />
      <AdminCrossTenantLogPanel variant="activity" />
    </AnimatedPage>
  );
}
