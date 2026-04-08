import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DashboardFrameworkShell } from "@/components/dashboard/dashboard-framework-shell";
import { ExecutiveDashboardHero, ExportScheduleBar } from "@/components/executive-dashboard";
import {
  buildDateRangePreset,
  DateRangeSelector,
  insightRoleViewLabel,
  RoleSwitcher,
  rolesForPreview,
  type RolePreviewMode,
} from "@/components/global-dashboard";
import { useAuth } from "@/contexts/auth-context";
import { useExecutiveDashboardSnapshot } from "@/hooks/use-executive-dashboard-snapshot";
import type { DashboardDateRange } from "@/types/dashboard";
import type { ExecutiveDashboardSnapshot } from "@/types/executive-dashboard";

function roleSet(roles: string[]): Set<string> {
  return new Set((roles ?? []).map((x) => String(x).toLowerCase()));
}

function hasAnyRole(roles: string[], keys: string[]): boolean {
  const r = roleSet(roles);
  return keys.some((k) => r.has(k.toLowerCase()));
}

const EMPTY_SNAPSHOT: ExecutiveDashboardSnapshot = {
  kpis: [],
  risks: [],
  departments: [],
  generatedAt: "",
};

export default function ExecutiveDashboardPage() {
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
  const [dateRange, setDateRange] = useState<DashboardDateRange>(() => buildDateRangePreset("7d"));

  const visibilityRoles = useMemo(
    () => rolesForPreview(rolePreview, profileRoles),
    [rolePreview, profileRoles],
  );

  const snapQ = useExecutiveDashboardSnapshot(dateRange);
  const snapshot = snapQ.data ?? EMPTY_SNAPSHOT;

  const canRefreshBrief = hasAnyRole(visibilityRoles, [
    "admin",
    "executive",
    "manager",
    "company admin",
    "owner",
  ]);
  const canExport = hasAnyRole(visibilityRoles, ["admin", "executive", "manager", "company admin", "owner"]);
  const canSchedule = canExport;

  const rolePreviewLabel = insightRoleViewLabel(rolePreview);

  const leadingContent = (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-surface-inner/50 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <RoleSwitcher value={rolePreview} onChange={setRolePreview} />
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      <ExecutiveDashboardHero
        tenantName={tenant?.name ?? demoSession?.tenantName ?? null}
        snapshot={snapshot}
        isLoading={snapQ.isLoading}
        canRefreshBrief={canRefreshBrief}
      />

      <ExportScheduleBar
        snapshot={snapshot}
        layoutId={null}
        canExport={canExport}
        canSchedule={canSchedule}
      />

      {rolePreview !== "actual" && rolePreviewLabel ? (
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Widget visibility lens: <span className="text-primary">{rolePreviewLabel}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <DashboardFrameworkShell
      kind="executive"
      layoutName={layoutName}
      title="Executive dashboard"
      description="Top-line KPIs, risk scoreboard, AI executive brief, and cross-department heatmap — tenant and role aware."
      omitHeader
      leadingContent={leadingContent}
      visibilityRoles={visibilityRoles}
      rolePreviewActive={rolePreview !== "actual"}
      dataContextExtras={{ dateRange, departmentId: null }}
      roleHint={null}
    />
  );
}
