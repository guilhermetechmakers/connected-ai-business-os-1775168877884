import { invokeModulesApi } from "@/lib/modules-api";
import type {
  InternalModuleDepartmentBindingRow,
  InternalModuleDetail,
  InternalModuleRow,
  InternalModuleVersionRow,
  MarketplaceTemplateRow,
  ModuleDataBinding,
  ModulePermissionRow,
  ModuleVersionSnapshot,
} from "@/types/modules";

function asDataBindings(raw: unknown): ModuleDataBinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((b) => ({
      bindingName: String(b.bindingName ?? ""),
      sourceContext: String(b.sourceContext ?? ""),
      targetEntity: String(b.targetEntity ?? ""),
      fieldMappings:
        b.fieldMappings && typeof b.fieldMappings === "object" && !Array.isArray(b.fieldMappings)
          ? (b.fieldMappings as Record<string, string>)
          : {},
    }))
    .filter((b) => b.bindingName.length > 0);
}

function asPermissionRows(raw: unknown): ModulePermissionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((p) => ({
      roleId: String(p.roleId ?? ""),
      actions: Array.isArray(p.actions) ? p.actions.map(String) : [],
      scope: typeof p.scope === "string" ? p.scope : "module",
    }))
    .filter((p) => p.roleId.length > 0);
}

function asStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String) : [];
}

function normalizeModuleRow(
  row: InternalModuleRow & { active_version?: string | null },
): InternalModuleRow & { active_version?: string | null } {
  return {
    ...row,
    tags: asStringArray(row.tags),
    tenant_scope: asStringArray(row.tenant_scope).length
      ? asStringArray(row.tenant_scope)
      : ["current_tenant"],
    data_bindings: asDataBindings(row.data_bindings),
    permissions: asPermissionRows(row.permissions),
    active_version:
      row.active_version !== undefined && row.active_version !== null
        ? row.active_version
        : undefined,
  };
}

function parseVersionSnapshot(raw: unknown): ModuleVersionSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      name: "",
      description: "",
      ui_entry: "",
      data_bindings: [],
      permissions: [],
      tags: [],
      tenant_scope: ["current_tenant"],
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    name: String(o.name ?? ""),
    description: String(o.description ?? ""),
    ui_entry: String(o.ui_entry ?? ""),
    data_bindings: asDataBindings(o.data_bindings),
    permissions: asPermissionRows(o.permissions),
    tags: asStringArray(o.tags),
    tenant_scope: asStringArray(o.tenant_scope).length
      ? asStringArray(o.tenant_scope)
      : ["current_tenant"],
  };
}

function normalizeVersionRow(row: InternalModuleVersionRow): InternalModuleVersionRow {
  return {
    ...row,
    snapshot: parseVersionSnapshot(row.snapshot),
    binding_diff:
      row.binding_diff && typeof row.binding_diff === "object" && !Array.isArray(row.binding_diff)
        ? (row.binding_diff as Record<string, unknown>)
        : {},
  };
}

/** Coerce API/JSON `data_bindings` to typed rows (runtime-safe). */
export function normalizeModuleDataBindings(raw: unknown): ModuleDataBinding[] {
  return asDataBindings(raw);
}

export function normalizeModulePermissions(raw: unknown): ModulePermissionRow[] {
  return asPermissionRows(raw);
}

export function summarizeBindings(bindings: ModuleDataBinding[]): string {
  const b = Array.isArray(bindings) ? bindings : [];
  if (b.length === 0) return "No bindings";
  return (
    b
      .slice(0, 3)
      .map((x) => x.bindingName)
      .join(", ") + (b.length > 3 ? ` +${b.length - 3}` : "")
  );
}

export async function fetchInternalModules(params?: {
  search?: string;
  status?: string;
  tag?: string;
}): Promise<InternalModuleRow[]> {
  const { data, error } = await invokeModulesApi<InternalModuleRow[]>({
    op: "modules.list",
    search: params?.search,
    status: params?.status,
    tag: params?.tag,
  });
  if (error) return [];
  const list = Array.isArray(data) ? data : [];
  return list.map((m) => normalizeModuleRow(m));
}

export async function fetchInternalModuleDetail(
  id: string,
): Promise<InternalModuleDetail | null> {
  const { data, error } = await invokeModulesApi<{
    module: InternalModuleRow;
    versions: InternalModuleVersionRow[];
    departmentBindings: InternalModuleDepartmentBindingRow[];
  }>({
    op: "modules.get",
    id,
  });
  if (error || !data?.module) return null;
  const versions = Array.isArray(data.versions) ? data.versions : [];
  const departmentBindings = Array.isArray(data.departmentBindings)
    ? data.departmentBindings
    : [];
  return {
    module: normalizeModuleRow(data.module),
    versions: versions.map((v) => normalizeVersionRow(v)),
    departmentBindings,
  };
}

/** @deprecated Use fetchInternalModuleDetail */
export async function fetchModuleDetail(
  moduleId: string,
): Promise<InternalModuleDetail | null> {
  return fetchInternalModuleDetail(moduleId);
}

export async function fetchModuleVersions(
  moduleId: string,
): Promise<InternalModuleVersionRow[]> {
  const { data, error } = await invokeModulesApi<InternalModuleVersionRow[]>({
    op: "modules.versions.list",
    moduleId,
  });
  if (error) return [];
  const list = Array.isArray(data) ? data : [];
  return list.map((v) => normalizeVersionRow(v));
}

export async function fetchMarketplaceTemplates(): Promise<
  MarketplaceTemplateRow[]
> {
  const { data, error } = await invokeModulesApi<MarketplaceTemplateRow[]>({
    op: "templates.list",
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function fetchModulePermissions(
  moduleId: string,
): Promise<ModulePermissionRow[]> {
  const { data, error } = await invokeModulesApi<ModulePermissionRow[]>({
    op: "modules.permissions.get",
    moduleId,
  });
  if (error) return [];
  return asPermissionRows(data);
}

export async function createInternalModule(payload: {
  name: string;
  description?: string;
  ui_entry?: string;
  status?: string;
  tags?: string[];
  tenant_scope?: string[];
  data_bindings?: ModuleDataBinding[];
  permissions?: ModulePermissionRow[];
}): Promise<InternalModuleRow | null> {
  const { data, error } = await invokeModulesApi<InternalModuleRow>({
    op: "modules.create",
    name: payload.name,
    description: payload.description,
    ui_entry: payload.ui_entry,
    status: payload.status,
    tags: payload.tags ?? [],
    tenant_scope: payload.tenant_scope ?? ["current_tenant"],
    data_bindings: payload.data_bindings ?? [],
    permissions: (payload.permissions ?? []).map((p) => ({
      roleId: p.roleId,
      actions: p.actions ?? [],
      scope: p.scope ?? "module",
    })),
  });
  if (error || !data) return null;
  return normalizeModuleRow(data);
}

export async function updateInternalModule(payload: {
  id: string;
  name?: string;
  description?: string;
  ui_entry?: string;
  status?: string;
  tags?: string[];
  tenant_scope?: string[];
  data_bindings?: ModuleDataBinding[];
  permissions?: ModulePermissionRow[];
}): Promise<{ module: InternalModuleRow; migrationHint: string | null } | null> {
  const { data, error } = await invokeModulesApi<{
    module: InternalModuleRow;
    migrationHint: string | null;
  }>({
    op: "modules.update",
    id: payload.id,
    name: payload.name,
    description: payload.description,
    ui_entry: payload.ui_entry,
    status: payload.status,
    tags: payload.tags,
    tenant_scope: payload.tenant_scope,
    data_bindings: payload.data_bindings,
    permissions: payload.permissions,
  });
  if (error || !data?.module) return null;
  return {
    module: normalizeModuleRow(data.module),
    migrationHint: data.migrationHint ?? null,
  };
}

export async function deleteInternalModule(id: string): Promise<boolean> {
  const { data, error } = await invokeModulesApi<{ ok: boolean }>({
    op: "modules.delete",
    id,
  });
  if (error) return false;
  return Boolean(data && typeof data === "object" && "ok" in data && data.ok);
}

export async function publishModuleVersion(payload: {
  moduleId: string;
  versionTag: string;
  changelog?: string;
  migrationNotes?: string;
  bindingDiff?: Record<string, unknown>;
}): Promise<InternalModuleVersionRow | null> {
  const { data, error } = await invokeModulesApi<InternalModuleVersionRow>({
    op: "modules.versions.publish",
    moduleId: payload.moduleId,
    versionTag: payload.versionTag,
    changelog: payload.changelog,
    migrationNotes: payload.migrationNotes,
    bindingDiff: payload.bindingDiff ?? {},
  });
  if (error || !data) return null;
  return normalizeVersionRow(data);
}

/** @deprecated Use publishModuleVersion */
export async function createModuleVersion(payload: {
  moduleId: string;
  versionTag: string;
  changelog?: string;
  migrationNotes?: string;
  bindingDiff?: Record<string, unknown>;
}): Promise<InternalModuleVersionRow | null> {
  return publishModuleVersion(payload);
}

export async function rollbackModuleVersion(payload: {
  moduleId: string;
  versionId: string;
}): Promise<{
  ok: boolean;
  migrationPlan?: { steps: string[]; versionTag: string };
} | null> {
  const { data, error } = await invokeModulesApi<{
    ok: boolean;
    migrationPlan?: { steps: string[]; versionTag: string };
  }>({
    op: "modules.rollback",
    moduleId: payload.moduleId,
    versionId: payload.versionId,
  });
  if (error || !data) return null;
  return data;
}

/** @deprecated Use rollbackModuleVersion */
export async function rollbackModule(payload: {
  moduleId: string;
  versionId: string;
}): Promise<{ module: InternalModuleRow; migrationPlan: string } | null> {
  const res = await rollbackModuleVersion(payload);
  if (!res) return null;
  return {
    module: {} as InternalModuleRow,
    migrationPlan: (res.migrationPlan?.steps ?? []).join("\n"),
  };
}

export async function deployInternalModule(
  moduleId: string,
): Promise<InternalModuleRow | null> {
  const { data, error } = await invokeModulesApi<InternalModuleRow>({
    op: "modules.deploy",
    moduleId,
  });
  if (error || !data) return null;
  return normalizeModuleRow(data);
}

/** @deprecated Use deployInternalModule */
export async function deployModule(
  moduleId: string,
): Promise<InternalModuleRow | null> {
  return deployInternalModule(moduleId);
}

export async function installMarketplaceTemplate(payload: {
  templateId: string;
  name?: string;
}): Promise<InternalModuleRow | null> {
  const { data, error } = await invokeModulesApi<InternalModuleRow>({
    op: "templates.install",
    templateId: payload.templateId,
    name: payload.name,
  });
  if (error || !data) return null;
  return normalizeModuleRow(data);
}

/** @deprecated Use installMarketplaceTemplate */
export async function installModuleFromTemplate(payload: {
  templateId: string;
  name?: string;
}): Promise<InternalModuleRow | null> {
  return installMarketplaceTemplate(payload);
}

export async function setModuleDepartmentBindings(payload: {
  moduleId: string;
  bindings: { departmentId: string; accessLevel: "read" | "write" | "admin" }[];
}): Promise<boolean> {
  const { data, error } = await invokeModulesApi<{ ok: boolean }>({
    op: "modules.departments.set",
    moduleId: payload.moduleId,
    bindings: payload.bindings,
  });
  if (error) return false;
  return Boolean(data && typeof data === "object" && "ok" in data && data.ok);
}

/** @deprecated Use setModuleDepartmentBindings */
export async function putModuleDepartments(payload: {
  moduleId: string;
  bindings: Array<{ departmentId: string; accessLevel?: string }>;
}): Promise<boolean> {
  return setModuleDepartmentBindings({
    moduleId: payload.moduleId,
    bindings: (payload.bindings ?? []).map((b) => ({
      departmentId: b.departmentId,
      accessLevel: (b.accessLevel as "read" | "write" | "admin") ?? "read",
    })),
  });
}

/** Alias for marketplace catalog responses. */
export const fetchModuleTemplates = fetchMarketplaceTemplates;

export async function putModulePermissions(payload: {
  moduleId: string;
  permissions: ModulePermissionRow[];
}): Promise<boolean> {
  const { data, error } = await invokeModulesApi<{ ok: boolean }>({
    op: "modules.permissions.put",
    moduleId: payload.moduleId,
    permissions: (payload.permissions ?? []).map((p) => ({
      roleId: p.roleId,
      actions: p.actions ?? [],
      scope: p.scope ?? "module",
    })),
  });
  if (error) return false;
  return Boolean(data && typeof data === "object" && "ok" in data && data.ok);
}
