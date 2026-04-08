import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { DashboardFrameworkShell } from "@/components/dashboard/dashboard-framework-shell";
import { AIWorkspaceAccessBridge } from "@/components/global-dashboard/ai-workspace-access-bridge";
import {
  buildDateRangePreset,
  GlobalDashboardHero,
  GlobalDashboardToolbar,
  insightRoleViewLabel,
  rolesForPreview,
  type RolePreviewMode,
} from "@/components/global-dashboard";
import { useAuth } from "@/contexts/auth-context";

export default function GlobalDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, tenant, demoSession } = useAuth();
  const profileRoles = Array.isArray(profile?.roles) ? profile.roles : [];
  const layoutName = (() => {
    const raw = searchParams.get("layout");
    if (!raw) return "Default";
    const clean = raw.trim().slice(0, 120);
    return clean.length > 0 ? clean : "Default";
  })();

  const [rolePreview, setRolePreview] = useState<RolePreviewMode>("actual");
  const [dateRange, setDateRange] = useState(() => buildDateRangePreset("7d"));
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [dashSearch, setDashSearch] = useState("");

  const visibilityRoles = useMemo(
    () => rolesForPreview(rolePreview, profileRoles),
    [rolePreview, profileRoles],
  );

  const insightRoleView = insightRoleViewLabel(rolePreview);
  const datePreset = dateRange.preset === "custom" ? "7d" : dateRange.preset;

  const leading = (
    <div className="space-y-8">
      <GlobalDashboardHero
        tenantName={tenant?.name ?? demoSession?.tenantName ?? null}
        dateRange={dateRange}
      />
      <GlobalDashboardToolbar
        rolePreview={rolePreview}
        onRolePreviewChange={setRolePreview}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        departmentId={departmentId}
        onDepartmentIdChange={setDepartmentId}
        dashSearch={dashSearch}
        onDashSearchChange={setDashSearch}
        onSearchSubmit={() => {
          const t = dashSearch.trim();
          navigate(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
        }}
      />
      <AIWorkspaceAccessBridge roleView={insightRoleView} datePreset={datePreset} />
    </div>
  );

  return (
    <DashboardFrameworkShell
      kind="global"
      layoutName={layoutName}
      title="Global dashboard"
      description="Aggregated KPIs, alerts, and quick actions across connected systems — scoped to your tenant and role. Drag widgets while editing; changes debounce-save to your layout."
      omitHeader
      leadingContent={leading}
      visibilityRoles={visibilityRoles}
      rolePreviewActive={rolePreview !== "actual"}
      dataContextExtras={{ dateRange, departmentId }}
      roleHint={
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Role preview lens:{" "}
          <span className="text-primary">
            {rolePreview === "actual" ? "Your assigned roles" : rolePreview.replace("_", " ")}
          </span>
          {" · "}
          Widget visibility recalculates from registry rules
        </p>
      }
    />
  );
}
