import type { Json } from "@/types/database";

export type ModuleStatus =
  | "draft"
  | "published"
  | "deprecated"
  | "archived";

export const MODULE_ACTIONS = [
  "View",
  "Edit",
  "Use",
  "DataRead",
  "DataWrite",
] as const;

export type ModuleActionId = (typeof MODULE_ACTIONS)[number];

/** Unified context binding row (persisted as JSON on `internal_modules`). */
export type ModuleDataBinding = {
  bindingName: string;
  sourceContext: string;
  targetEntity: string;
  fieldMappings: Record<string, string>;
};

/** RBAC row stored in `internal_modules.permissions` JSON array. */
export type ModulePermissionRow = {
  roleId: string;
  actions: string[];
  scope?: string;
};

export type InternalModuleRow = {
  id: string;
  company_id: string;
  name: string;
  description: string;
  ui_entry: string;
  status: string;
  tags: string[];
  tenant_scope: string[];
  data_bindings: ModuleDataBinding[] | Json;
  permissions: ModulePermissionRow[] | Json;
  active_version_id: string | null;
  last_deployed_at: string | null;
  health_status: string;
  marketplace_template_id: string | null;
  installed_from_template: boolean;
  created_at: string;
  updated_at: string;
  /** Populated on list responses (joined from active version). */
  active_version?: string | null;
};

export type ModuleVersionSnapshot = {
  name: string;
  description: string;
  ui_entry: string;
  data_bindings: ModuleDataBinding[];
  permissions: ModulePermissionRow[];
  tags: string[];
  tenant_scope: string[];
};

export type InternalModuleVersionRow = {
  id: string;
  module_id: string;
  version_tag: string;
  changelog: string;
  migration_notes: string | null;
  binding_diff: Record<string, unknown> | Json;
  snapshot: ModuleVersionSnapshot | Json;
  is_active: boolean;
  created_at: string;
};

export type InternalModuleDepartmentBindingRow = {
  id: string;
  department_id: string;
  access_level: string;
  created_at: string;
};

export type MarketplaceTemplateRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  preview_ui: string;
  bindings_template: ModuleDataBinding[] | Json;
  dependencies: unknown[] | Json;
  default_ui_entry: string;
  created_at: string;
};

export type InternalModuleDetail = {
  module: InternalModuleRow;
  versions: InternalModuleVersionRow[];
  departmentBindings: InternalModuleDepartmentBindingRow[];
};

export type RoleOption = { id: string; name: string };
export type DepartmentOption = { id: string; name: string };
