import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import { GlobalSearchBar } from "@/components/global-search/global-search-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchUnifiedEntities } from "@/api/unified-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { DashboardDateRange } from "@/types/dashboard";
import type { Json } from "@/types/database";
import type { UnifiedEntityRow } from "@/types/unified";
import { cn } from "@/lib/utils";

import { DateRangeSelector } from "@/components/global-dashboard/date-range-selector";
import { QuickActionsBar } from "@/components/global-dashboard/quick-actions-bar";
import {
  RoleSwitcher,
  type RolePreviewMode,
} from "@/components/global-dashboard/role-switcher";

function readDepartmentName(payload: Json, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const p = payload as Record<string, unknown>;
  const n = p.name ?? p.title;
  return typeof n === "string" && n.trim() ? n : fallback;
}

export type GlobalDashboardToolbarProps = {
  rolePreview: RolePreviewMode;
  onRolePreviewChange: (v: RolePreviewMode) => void;
  dateRange: DashboardDateRange;
  onDateRangeChange: (v: DashboardDateRange) => void;
  departmentId: string | null;
  onDepartmentIdChange: (id: string | null) => void;
  dashSearch: string;
  onDashSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  className?: string;
};

export function GlobalDashboardToolbar({
  rolePreview,
  onRolePreviewChange,
  dateRange,
  onDateRangeChange,
  departmentId,
  onDepartmentIdChange,
  dashSearch,
  onDashSearchChange,
  onSearchSubmit,
  className,
}: GlobalDashboardToolbarProps) {
  const deptQ = useQuery({
    queryKey: ["global-dashboard-departments"],
    queryFn: () => fetchUnifiedEntities({ entityType: "Department", limit: 40 }),
    enabled: isSupabaseConfigured,
    staleTime: 60_000,
  });

  const deptRowsRaw = deptQ.data;
  const deptRows: UnifiedEntityRow[] = Array.isArray(deptRowsRaw) ? deptRowsRaw : [];

  return (
    <div
      className={cn(
        "space-y-6 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-card backdrop-blur-sm md:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Role preview
          </p>
          <RoleSwitcher value={rolePreview} onChange={onRolePreviewChange} />
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end xl:flex-col xl:items-end">
          <DateRangeSelector value={dateRange} onChange={onDateRangeChange} />
          <QuickActionsBar />
        </div>
      </div>

      <div className="grid gap-4 border-t border-border/40 pt-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            Department scope
          </p>
          <Select
            value={departmentId ?? "all"}
            onValueChange={(v) => onDepartmentIdChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-full border-border/60 bg-surface-inner" aria-label="Department filter">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {(deptRows ?? []).map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {readDepartmentName(row.payload, "Department")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Global search
          </p>
          <GlobalSearchBar
            value={dashSearch}
            onChange={onDashSearchChange}
            onSubmit={onSearchSubmit}
            variant="compact"
            aria-label="Quick global search from dashboard"
          />
        </div>
      </div>
    </div>
  );
}
