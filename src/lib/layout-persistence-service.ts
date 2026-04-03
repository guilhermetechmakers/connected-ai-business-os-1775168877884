/**
 * Tenant- and user-scoped dashboard layout persistence (Supabase + `dashboard-api` Edge Function).
 * Layout rows are keyed by `(company_id, user_id, dashboard_kind, name)` — isolated per tenant.
 */
import {
  ensureDashboardLayout,
  getDashboardLayout,
  saveDashboardLayout,
} from "@/api/dashboard";
import type { DashboardKind, DashboardLayoutJson } from "@/types/dashboard";

export type LayoutSavePayload = {
  dashboardKind: DashboardKind;
  name?: string;
  layoutJson: DashboardLayoutJson;
  instances: {
    id: string;
    widgetDefinitionId?: string | null;
    widgetType: string;
    config?: Record<string, unknown>;
    isVisible?: boolean;
  }[];
};

export const layoutPersistenceService = {
  async ensure(dashboardKind: DashboardKind, name = "Default") {
    return ensureDashboardLayout(dashboardKind, name);
  },

  async get(dashboardKind: DashboardKind, name = "Default") {
    return getDashboardLayout(dashboardKind, name);
  },

  async save(payload: LayoutSavePayload) {
    return saveDashboardLayout({
      dashboardKind: payload.dashboardKind,
      name: payload.name ?? "Default",
      layoutJson: payload.layoutJson,
      instances: payload.instances,
    });
  },
};
