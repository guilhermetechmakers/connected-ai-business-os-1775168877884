import { Navigate } from "react-router-dom";

import {
  AdminCrossTenantLogPanel,
  AuditTrailPanel,
  useIsPrivilegedTenantAdmin,
} from "@/components/admin-console";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminAuditPage() {
  const isPrivileged = useIsPrivilegedTenantAdmin();
  if (!isPrivileged) {
    return <Navigate to="/dashboard/admin/overview" replace />;
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Audit trail"
        description="Immutable admin actions, retention controls, SQL-backed audit projection, and cross-tenant search."
      />
      <AuditTrailPanel mode="forensic" />
      <AdminCrossTenantLogPanel variant="audit" />
    </AnimatedPage>
  );
}
