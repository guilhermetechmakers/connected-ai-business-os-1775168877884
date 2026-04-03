/**
 * Global dashboard module — role preview, filters, AI bridge, and re-exports for the widget framework.
 *
 * Extending widgets: register a `dashboard_widget_definitions` row (type + visibility_rules + data_adapter_key),
 * add a `case` in `DashboardWidgetBody`, and optionally extend `dashboard/data-adapters.ts`.
 * Layouts persist per user/tenant via `layoutPersistenceService` / `useDashboardLayoutModel`.
 */
export { GlobalSearchBar } from "@/components/global-search/global-search-bar";

export { ActivityFeed, type ActivityFeedProps } from "@/components/global-dashboard/activity-feed";
export { AIWorkspaceAccessBridge } from "@/components/global-dashboard/ai-workspace-access-bridge";
export { AlertsPanel, type AlertsPanelProps } from "@/components/global-dashboard/alerts-panel";
export {
  DateRangeSelector,
  buildDateRangePreset,
} from "@/components/global-dashboard/date-range-selector";
export { GlobalDashboardHero } from "@/components/global-dashboard/global-dashboard-hero";
export { GlobalDashboardToolbar } from "@/components/global-dashboard/global-dashboard-toolbar";
export { KPICard, type KPICardProps } from "@/components/global-dashboard/kpi-card";
export {
  PermissionGuard,
  usePermissionGuard,
  type PermissionGuardProps,
} from "@/components/global-dashboard/permission-guard";
export { QuickActionsBar } from "@/components/global-dashboard/quick-actions-bar";
export {
  RoleSwitcher,
  insightRoleViewLabel,
  rolesForPreview,
  type RolePreviewMode,
  type RoleSwitcherProps,
} from "@/components/global-dashboard/role-switcher";
export { TrendChart, type TrendChartDatum, type TrendChartProps } from "@/components/global-dashboard/trend-chart";

export { DashboardGrid as WidgetGrid } from "@/components/dashboard/dashboard-grid";
export type { DashboardGridProps as WidgetGridProps } from "@/components/dashboard/dashboard-grid";
