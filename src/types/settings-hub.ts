export type SettingsPermissionCatalogItem = {
  key: string;
  label: string;
};

const CRUD_ACTIONS = [
  { suffix: "read", label: "Read" },
  { suffix: "create", label: "Create" },
  { suffix: "edit", label: "Edit" },
  { suffix: "delete", label: "Delete" },
] as const;

const APP_SECTION_CATALOG = [
  { slug: "dashboard", label: "Dashboard" },
  { slug: "users", label: "Users" },
  { slug: "roles", label: "Roles" },
  { slug: "settings", label: "Settings" },
  { slug: "integrations", label: "Integrations" },
  { slug: "workflows", label: "Workflows" },
  { slug: "reports", label: "Reports" },
  { slug: "notifications", label: "Notifications" },
  { slug: "activity_logs", label: "Activity logs" },
  { slug: "search", label: "Search" },
  { slug: "ai_workspace", label: "AI workspace" },
  { slug: "department_workspace", label: "Department workspace" },
  { slug: "executive_dashboard", label: "Executive dashboard" },
  { slug: "modules", label: "Modules" },
  { slug: "marketing", label: "Marketing" },
  { slug: "tenant_company", label: "Company profile" },
] as const;

const API_TOOL_CATALOG = [
  { slug: "api.tools", label: "API tools" },
  { slug: "api.keys", label: "API keys" },
  { slug: "api.webhooks", label: "Webhooks" },
  { slug: "api.connectors", label: "API connectors" },
  { slug: "api.audit", label: "API audit logs" },
] as const;

const GLOBAL_PERMISSION_CATALOG: SettingsPermissionCatalogItem[] = [
  { key: "tenant.admin.full_access", label: "Full tenant administration access" },
  { key: "tenant.settings.read", label: "Read tenant settings" },
  { key: "tenant.settings.edit", label: "Edit tenant settings" },
  { key: "tenant.feature_flags.manage", label: "Manage feature flags" },
  { key: "tenant.audit.read", label: "Read tenant audit trails" },
  { key: "tenant.audit.export", label: "Export tenant audit trails" },
  { key: "roles.assign", label: "Assign roles to users" },
  { key: "roles.permissions.manage", label: "Manage role permissions" },
  { key: "ai.actions.execute", label: "Execute AI-suggested actions" },
];

function buildCrudCatalog(
  sections: ReadonlyArray<{ slug: string; label: string }>,
): SettingsPermissionCatalogItem[] {
  return sections.flatMap((section) =>
    CRUD_ACTIONS.map((action) => ({
      key: `${section.slug}.${action.suffix}`,
      label: `${action.label} ${section.label}`,
    })),
  );
}

/**
 * Permission keys available to the tenant RBAC editor.
 *
 * Includes broad CRUD coverage for every app section and API tool domains,
 * plus high-level admin permissions used by operations/security teams.
 */
export const SETTINGS_PERMISSION_CATALOG: SettingsPermissionCatalogItem[] = [
  ...GLOBAL_PERMISSION_CATALOG,
  ...buildCrudCatalog(APP_SECTION_CATALOG),
  ...buildCrudCatalog(API_TOOL_CATALOG),
];
