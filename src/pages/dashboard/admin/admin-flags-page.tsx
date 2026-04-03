import { Navigate } from "react-router-dom";

import { FeatureFlagPanel, useIsSuperAdmin } from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";

export default function AdminFlagsPage() {
  const isSuper = useIsSuperAdmin();
  if (!isSuper) {
    return <Navigate to="/dashboard/admin/overview" replace />;
  }
  return (
    <AnimatedPage className="space-y-6">
      <FeatureFlagPanel />
    </AnimatedPage>
  );
}
