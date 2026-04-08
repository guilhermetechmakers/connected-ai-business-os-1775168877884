/** Canonical permission keys for tenant RBAC UI (aligned with Edge Function enforcement). */
export const SETTINGS_PERMISSION_CATALOG: { key: string; label: string; group: string }[] = [
  { key: "company.read", label: "View company profile", group: "Company" },
  { key: "company.write", label: "Edit company profile", group: "Company" },
  { key: "users.read", label: "View users", group: "Users" },
  { key: "users.write", label: "Manage users & invites", group: "Users" },
  { key: "roles.read", label: "View roles", group: "Roles" },
  { key: "roles.write", label: "Edit roles & assignments", group: "Roles" },
  { key: "integrations.read", label: "View integrations", group: "Integrations" },
  { key: "integrations.write", label: "Configure integrations & sync", group: "Integrations" },
  { key: "ai.read", label: "Use AI chat", group: "AI" },
  { key: "ai.actions", label: "Execute AI-suggested actions", group: "AI" },
  { key: "reports.read", label: "View reports", group: "Reports" },
  { key: "reports.write", label: "Create & schedule reports", group: "Reports" },
  { key: "settings.audit", label: "View settings audit trail", group: "Governance" },
  { key: "settings.flags", label: "Manage tenant feature flags", group: "Governance" },
  { key: "builder.keys", label: "Manage scoped API keys", group: "Builders" },
];

export function groupPermissionsCatalog() {
  const groups: Record<string, typeof SETTINGS_PERMISSION_CATALOG> = {};
  for (const item of SETTINGS_PERMISSION_CATALOG) {
    const g = item.group;
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }
  return groups;
}
