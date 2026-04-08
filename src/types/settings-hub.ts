/** Permission keys for the tenant RBAC editor (UI catalog). */
export const SETTINGS_PERMISSION_CATALOG: { key: string; label: string }[] = [
  { key: "tenant.settings.read", label: "View tenant settings" },
  { key: "tenant.settings.write", label: "Edit tenant settings" },
  { key: "users.read", label: "View users" },
  { key: "users.write", label: "Manage users" },
  { key: "integrations.read", label: "View integrations" },
  { key: "integrations.write", label: "Manage integrations & credentials" },
  { key: "workflows.run", label: "Run workflows" },
  { key: "ai.workspace.use", label: "Use AI chat" },
  { key: "ai.actions.execute", label: "Execute AI-suggested actions" },
  { key: "reports.export", label: "Export reports" },
  { key: "audit.read", label: "View audit trails" },
];
