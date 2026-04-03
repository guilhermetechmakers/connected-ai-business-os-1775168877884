import { Navigate } from "react-router-dom";

import { AuditTrailPanel, useIsSuperAdmin } from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminMaintenancePage() {
  const isSuper = useIsSuperAdmin();
  if (!isSuper) {
    return <Navigate to="/dashboard/admin/overview" replace />;
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Maintenance"
        description="Destructive retention jobs and platform hygiene. Restricted to super admins."
      />
      <AuditTrailPanel mode="maintenance" />
    </AnimatedPage>
  );
}
