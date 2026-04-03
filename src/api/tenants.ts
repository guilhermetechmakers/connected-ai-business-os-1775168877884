import { invokeTenantsApi } from "@/lib/tenants-api";
import type {
  OnboardingTemplateRow,
  TenantCompanyRecord,
  TenantConfigRow,
  TenantIntegrationMonitorRow,
} from "@/types/tenancy";

function asTenantList(raw: unknown): TenantCompanyRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is TenantCompanyRecord => !!x && typeof x === "object");
}

export async function fetchTenantsAdminList(params?: {
  search?: string;
  tenantStatus?: TenantCompanyRecord["tenant_status"];
  region?: string;
  plan?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tenants: TenantCompanyRecord[]; total: number }> {
  const { data, error } = await invokeTenantsApi<{
    data?: unknown;
    total?: number;
  }>({
    op: "tenants.admin.list",
    search: params?.search,
    tenantStatus: params?.tenantStatus,
    region: params?.region,
    plan: params?.plan,
    limit: params?.limit,
    offset: params?.offset,
  });
  if (error || !data || typeof data !== "object") {
    return { tenants: [], total: 0 };
  }
  const o = data as { data?: unknown; total?: number };
  const tenants = asTenantList(o.data);
  const total = typeof o.total === "number" ? o.total : tenants.length;
  return { tenants, total };
}

export async function fetchTenantAdminDetail(
  companyId: string,
): Promise<TenantCompanyRecord | null> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "tenants.admin.get",
    companyId,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = (data as { data?: unknown }).data;
  if (!row || typeof row !== "object") return null;
  return row as TenantCompanyRecord;
}

export async function createTenantAdminModule(payload: {
  name: string;
  region?: string;
  plan?: string;
  timezone?: string;
  currency?: string;
  domain?: string;
  legalName?: string;
  displayName?: string;
  country?: string;
  maxUsers?: number;
  maxIntegrations?: number;
}): Promise<TenantCompanyRecord | null> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "tenants.admin.create",
    name: payload.name,
    region: payload.region,
    plan: payload.plan,
    timezone: payload.timezone,
    currency: payload.currency,
    domain: payload.domain,
    legalName: payload.legalName,
    displayName: payload.displayName,
    country: payload.country,
    maxUsers: payload.maxUsers,
    maxIntegrations: payload.maxIntegrations,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = (data as { data?: unknown }).data;
  if (!row || typeof row !== "object") return null;
  return row as TenantCompanyRecord;
}

export async function patchTenantAdminModule(payload: {
  companyId: string;
  name?: string;
  region?: string;
  plan?: string;
  timezone?: string;
  currency?: string;
  domain?: string | null;
  tenantStatus?: TenantCompanyRecord["tenant_status"];
  legalName?: string | null;
  displayName?: string | null;
  country?: string | null;
}): Promise<TenantCompanyRecord | null> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "tenants.admin.patch",
    companyId: payload.companyId,
    name: payload.name,
    region: payload.region,
    plan: payload.plan,
    timezone: payload.timezone,
    currency: payload.currency,
    domain: payload.domain,
    tenantStatus: payload.tenantStatus,
    legalName: payload.legalName,
    displayName: payload.displayName,
    country: payload.country,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = (data as { data?: unknown }).data;
  if (!row || typeof row !== "object") return null;
  return row as TenantCompanyRecord;
}

export async function deprovisionTenantAdmin(
  companyId: string,
): Promise<boolean> {
  const { data, error } = await invokeTenantsApi<unknown>({
    op: "tenants.admin.deprovision",
    companyId,
  });
  return !error && data !== null;
}

export async function bulkDeprovisionTenantsAdmin(
  companyIds: string[],
): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const { data, error } = await invokeTenantsApi<{
    data?: unknown;
  }>({
    op: "tenants.admin.bulkDeprovision",
    companyIds,
  });
  if (error || !data || typeof data !== "object") return [];
  const inner = (data as { data?: unknown }).data;
  if (!Array.isArray(inner)) return [];
  return inner as { id: string; ok: boolean; error?: string }[];
}

export async function fetchTenantIntegrationMonitor(
  companyId: string,
): Promise<TenantIntegrationMonitorRow | null> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "tenants.admin.integrationMonitor",
    companyId,
  });
  if (error || !data || typeof data !== "object") return null;
  const inner = (data as { data?: unknown }).data;
  if (!inner || typeof inner !== "object") return null;
  const o = inner as Record<string, unknown>;
  const connectors = Array.isArray(o.connectors) ? o.connectors : [];
  const integrations = Array.isArray(o.integrations) ? o.integrations : [];
  return {
    connectors: connectors as TenantIntegrationMonitorRow["connectors"],
    integrations: integrations as TenantIntegrationMonitorRow["integrations"],
  };
}

export async function fetchTenantConfigs(params?: {
  companyId?: string;
}): Promise<TenantConfigRow[]> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "tenants.config.list",
    companyId: params?.companyId,
  });
  if (error || !data || typeof data !== "object") return [];
  const list = (data as { data?: unknown }).data;
  return Array.isArray(list) ? (list as TenantConfigRow[]) : [];
}

export async function upsertTenantConfig(payload: {
  companyId?: string;
  configKey: string;
  configValue: Record<string, unknown>;
}): Promise<TenantConfigRow | null> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "tenants.config.upsert",
    companyId: payload.companyId,
    configKey: payload.configKey,
    configValue: payload.configValue,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = (data as { data?: unknown }).data;
  if (!row || typeof row !== "object") return null;
  return row as TenantConfigRow;
}

export async function fetchOnboardingTemplates(params?: {
  templateType?: "onboarding" | "system";
}): Promise<OnboardingTemplateRow[]> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "onboarding.templates.list",
    templateType: params?.templateType,
  });
  if (error || !data || typeof data !== "object") return [];
  const list = (data as { data?: unknown }).data;
  return Array.isArray(list) ? (list as OnboardingTemplateRow[]) : [];
}

export async function upsertOnboardingTemplateAdmin(payload: {
  id?: string;
  name: string;
  templateType?: "onboarding" | "system";
  version?: number;
  data?: Record<string, unknown>;
  isActive?: boolean;
  tenantId?: string | null;
}): Promise<OnboardingTemplateRow | null> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "onboarding.templates.upsert",
    id: payload.id,
    name: payload.name,
    templateType: payload.templateType ?? "onboarding",
    version: payload.version,
    data: payload.data ?? {},
    isActive: payload.isActive,
    tenantId: payload.tenantId,
  });
  if (error || !data || typeof data !== "object") return null;
  const row = (data as { data?: unknown }).data;
  if (!row || typeof row !== "object") return null;
  return row as OnboardingTemplateRow;
}

export async function deleteOnboardingTemplateAdmin(
  id: string,
): Promise<boolean> {
  const { data, error } = await invokeTenantsApi<unknown>({
    op: "onboarding.templates.delete",
    id,
  });
  return !error && data !== null;
}

export async function applyOnboardingCompany(payload: {
  legalName: string;
  displayName: string;
  country?: string;
  timezone: string;
  currency: string;
  departmentNames: string[];
  templateId?: string;
  suggestedIntegrationKeys?: string[];
}): Promise<{ departmentsCreated: number } | null> {
  const { data, error } = await invokeTenantsApi<{ data?: unknown }>({
    op: "onboarding.company.apply",
    legalName: payload.legalName,
    displayName: payload.displayName,
    country: payload.country,
    timezone: payload.timezone,
    currency: payload.currency,
    departmentNames: payload.departmentNames,
    templateId: payload.templateId,
    suggestedIntegrationKeys: payload.suggestedIntegrationKeys,
  });
  if (error || !data || typeof data !== "object") return null;
  const inner = (data as { data?: unknown }).data;
  if (!inner || typeof inner !== "object") return null;
  const d = inner as { departmentsCreated?: number };
  return {
    departmentsCreated:
      typeof d.departmentsCreated === "number" ? d.departmentsCreated : 0,
  };
}
