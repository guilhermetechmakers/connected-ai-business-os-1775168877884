import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { fetchTenantDepartmentsDirectory } from "@/lib/department-workspace-api";
import { toDepartmentWorkspaceListItem } from "@/lib/department-workspace-list";
import type { DepartmentWorkspaceListItem } from "@/types/department-workspace";

const DEMO_DEPARTMENTS: DepartmentWorkspaceListItem[] = [
  {
    id: "demo-sales",
    name: "Sales",
    leadName: "Jordan Lee",
    leadUserId: null,
    headcount: 18,
    status: "active",
    type: "Sales",
    metrics: {
      openTasks: 12,
      newMessages: 6,
      activeMembers: 18,
      lastActivity: new Date().toISOString(),
      kpis: 4,
      documents: 9,
    },
    userRole: "Manager",
    aiAvailable: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "demo-ops",
    name: "Operations",
    leadName: "Sam Rivera",
    leadUserId: null,
    headcount: 24,
    status: "active",
    type: "Ops",
    metrics: {
      openTasks: 7,
      newMessages: 2,
      activeMembers: 24,
      lastActivity: new Date().toISOString(),
      kpis: 6,
      documents: 14,
    },
    userRole: "Member",
    aiAvailable: true,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "demo-hr",
    name: "People & HR",
    leadName: "Alex Morgan",
    leadUserId: null,
    headcount: 9,
    status: "paused",
    type: "HR",
    metrics: {
      openTasks: 3,
      newMessages: 0,
      activeMembers: 9,
      lastActivity: new Date().toISOString(),
      kpis: 2,
      documents: 5,
    },
    userRole: "Guest",
    aiAvailable: false,
    lastUpdated: new Date().toISOString(),
  },
];

export function useDepartments(tenantId: string | null | undefined) {
  const { isConfigured } = useAuth();
  const key = tenantId ?? "none";

  return useQuery({
    queryKey: ["departments", "workspace-list", key],
    enabled: !isConfigured || Boolean(tenantId),
    queryFn: async (): Promise<DepartmentWorkspaceListItem[]> => {
      if (!isConfigured) {
        return Array.isArray(DEMO_DEPARTMENTS) ? [...DEMO_DEPARTMENTS] : [];
      }
      if (!tenantId) {
        return [];
      }
      const rows = await fetchTenantDepartmentsDirectory();
      const list = Array.isArray(rows) ? rows : [];
      return list.map((r) => toDepartmentWorkspaceListItem(r));
    },
  });
}
