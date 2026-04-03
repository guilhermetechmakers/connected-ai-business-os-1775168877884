import { Navigate } from "react-router-dom";

import { ProvisionTenantPanel, useIsSuperAdmin } from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";

export default function AdminProvisionPage() {
  const isSuper = useIsSuperAdmin();
  if (!isSuper) {
    return <Navigate to="/dashboard/admin/overview" replace />;
  }
  return (
    <AnimatedPage className="space-y-6">
      <ProvisionTenantPanel />
    </AnimatedPage>
  );
}
