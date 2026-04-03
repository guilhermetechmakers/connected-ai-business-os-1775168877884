import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type TenantDataPolicyRow = {
  id: string;
  company_id: string;
  retention_period_days: number;
  export_allowed: boolean;
  purge_scheduled: boolean;
  audit_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SettingsAuditRow = {
  id: string;
  company_id: string;
  actor_user_id: string | null;
  action: string;
  changes: Record<string, unknown>;
  created_at: string;
};

export type SettingsRoleRow = {
  id: string;
  company_id: string;
  name: string;
  description: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
};

export type TenantFeatureFlagRow = {
  id: string;
  flag_key: string;
  company_id: string | null;
  enabled: boolean;
  rollout: number;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BuilderApiKeyPublicRow = {
  id: string;
  company_id: string;
  profile_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  created_at: string;
};

export type BuilderApiKeyCreatedRow = BuilderApiKeyPublicRow & { secret: string };

type InvokeResult<T> = { data: T | null; error: string | null };

function parseInvokePayload(raw: unknown): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Empty response" };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.error === "string") {
    return { ok: false, error: o.error };
  }
  return { ok: true, body: o };
}

async function invokeSettingsRaw(
  body: Record<string, unknown>,
): Promise<InvokeResult<Record<string, unknown>>> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error:
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const { data, error } = await supabase.functions.invoke<unknown>("settings-api", {
    body,
    headers,
  });
  if (error) {
    return { data: null, error: error.message };
  }
  const parsed = parseInvokePayload(data);
  if (!parsed.ok) {
    return { data: null, error: parsed.error };
  }
  return { data: parsed.body, error: null };
}

export async function settingsHubDataPolicyGet(): Promise<InvokeResult<TenantDataPolicyRow | null>> {
  const res = await invokeSettingsRaw({ op: "dataPolicy.get" });
  if (res.error || !res.data) return { data: null, error: res.error };
  const row = res.data.data;
  if (row === null || row === undefined) {
    return { data: null, error: null };
  }
  if (typeof row !== "object") {
    return { data: null, error: "Invalid data policy shape" };
  }
  return { data: row as TenantDataPolicyRow, error: null };
}

export async function settingsHubDataPolicyPatch(
  patch: {
    retentionPeriodDays?: number;
    exportAllowed?: boolean;
    purgeScheduled?: boolean;
    auditConfig?: Record<string, unknown>;
  },
): Promise<InvokeResult<TenantDataPolicyRow>> {
  const res = await invokeSettingsRaw({
    op: "dataPolicy.patch",
    ...patch,
  });
  if (res.error || !res.data) return { data: null, error: res.error };
  const row = res.data.data;
  if (!row || typeof row !== "object") {
    return { data: null, error: "Invalid data policy response" };
  }
  return { data: row as TenantDataPolicyRow, error: null };
}

export async function settingsHubAuditList(
  limit?: number,
): Promise<InvokeResult<SettingsAuditRow[]>> {
  const res = await invokeSettingsRaw({ op: "settingsAudit.list", limit });
  if (res.error || !res.data) return { data: null, error: res.error };
  const list = res.data.data;
  const normalized = Array.isArray(list) ? list : [];
  return { data: normalized as SettingsAuditRow[], error: null };
}

export async function settingsHubAuditAppend(
  action: string,
  changes?: Record<string, unknown>,
): Promise<InvokeResult<{ ok: boolean }>> {
  const res = await invokeSettingsRaw({
    op: "settingsAudit.append",
    action,
    changes,
  });
  if (res.error || !res.data) return { data: null, error: res.error };
  return { data: { ok: true }, error: null };
}

export async function settingsHubRolesList(): Promise<InvokeResult<SettingsRoleRow[]>> {
  const res = await invokeSettingsRaw({ op: "roles.list" });
  if (res.error || !res.data) return { data: null, error: res.error };
  const list = res.data.data;
  const normalized = Array.isArray(list) ? list : [];
  return { data: normalized as SettingsRoleRow[], error: null };
}

export async function settingsHubRoleCreate(payload: {
  name: string;
  description?: string;
  permissions?: string[];
}): Promise<InvokeResult<SettingsRoleRow>> {
  const res = await invokeSettingsRaw({ op: "roles.create", ...payload });
  if (res.error || !res.data) return { data: null, error: res.error };
  const row = res.data.data;
  if (!row || typeof row !== "object") {
    return { data: null, error: "Invalid role response" };
  }
  return { data: row as SettingsRoleRow, error: null };
}

export async function settingsHubRolePatch(payload: {
  roleId: string;
  name?: string;
  description?: string;
  permissions?: string[];
}): Promise<InvokeResult<SettingsRoleRow>> {
  const res = await invokeSettingsRaw({ op: "roles.patch", ...payload });
  if (res.error || !res.data) return { data: null, error: res.error };
  const row = res.data.data;
  if (!row || typeof row !== "object") {
    return { data: null, error: "Invalid role response" };
  }
  return { data: row as SettingsRoleRow, error: null };
}

export async function settingsHubRoleDelete(roleId: string): Promise<InvokeResult<{ ok: boolean }>> {
  const res = await invokeSettingsRaw({ op: "roles.delete", roleId });
  if (res.error || !res.data) return { data: null, error: res.error };
  return { data: { ok: true }, error: null };
}

export async function settingsHubProfileRoleIds(
  profileId: string,
): Promise<InvokeResult<string[]>> {
  const res = await invokeSettingsRaw({ op: "profileRoles.list", profileId });
  if (res.error || !res.data) return { data: null, error: res.error };
  const list = res.data.data;
  const normalized = Array.isArray(list)
    ? list.filter((x): x is string => typeof x === "string")
    : [];
  return { data: normalized, error: null };
}

export type ProfileRoleAssignmentPair = {
  profile_id: string;
  role_id: string;
};

export async function settingsHubProfileRolesListAll(): Promise<
  InvokeResult<ProfileRoleAssignmentPair[]>
> {
  const res = await invokeSettingsRaw({ op: "profileRoles.listAll" });
  if (res.error || !res.data) return { data: null, error: res.error };
  const list = res.data.data;
  const normalized = Array.isArray(list) ? list : [];
  return { data: normalized as ProfileRoleAssignmentPair[], error: null };
}

export async function settingsHubProfileRolesReplace(
  profileId: string,
  roleIds: string[],
): Promise<InvokeResult<{ ok: boolean }>> {
  const ids = Array.isArray(roleIds) ? roleIds : [];
  const res = await invokeSettingsRaw({
    op: "profileRoles.replace",
    profileId,
    roleIds: ids,
  });
  if (res.error || !res.data) return { data: null, error: res.error };
  return { data: { ok: true }, error: null };
}

export async function settingsHubProfileRolesListTenant(): Promise<
  InvokeResult<ProfileRoleAssignmentPair[]>
> {
  return settingsHubProfileRolesListAll();
}

export async function settingsHubTenantFlagsList(): Promise<InvokeResult<TenantFeatureFlagRow[]>> {
  const res = await invokeSettingsRaw({ op: "featureFlags.tenantList" });
  if (res.error || !res.data) return { data: null, error: res.error };
  const list = res.data.data;
  const normalized = Array.isArray(list) ? list : [];
  return { data: normalized as TenantFeatureFlagRow[], error: null };
}

export async function settingsHubTenantFlagUpsert(payload: {
  flagKey: string;
  enabled: boolean;
  rollout?: number;
}): Promise<InvokeResult<TenantFeatureFlagRow>> {
  const res = await invokeSettingsRaw({
    op: "featureFlags.tenantUpsert",
    flagKey: payload.flagKey,
    enabled: payload.enabled,
    rollout: payload.rollout,
  });
  if (res.error || !res.data) return { data: null, error: res.error };
  const row = res.data.data;
  if (!row || typeof row !== "object") {
    return { data: null, error: "Invalid feature flag response" };
  }
  return { data: row as TenantFeatureFlagRow, error: null };
}

export async function settingsHubBuilderKeysList(): Promise<InvokeResult<BuilderApiKeyPublicRow[]>> {
  const res = await invokeSettingsRaw({ op: "builderKeys.list" });
  if (res.error || !res.data) return { data: null, error: res.error };
  const list = res.data.data;
  const normalized = Array.isArray(list) ? list : [];
  return { data: normalized as BuilderApiKeyPublicRow[], error: null };
}

export async function settingsHubBuilderKeyCreate(payload: {
  name?: string;
  scopes?: string[];
  expiresInDays?: number;
}): Promise<InvokeResult<BuilderApiKeyCreatedRow>> {
  const res = await invokeSettingsRaw({ op: "builderKeys.create", ...payload });
  if (res.error || !res.data) return { data: null, error: res.error };
  const row = res.data.data;
  if (!row || typeof row !== "object") {
    return { data: null, error: "Invalid API key response" };
  }
  return { data: row as BuilderApiKeyCreatedRow, error: null };
}

export async function settingsHubBuilderKeyRevoke(keyId: string): Promise<InvokeResult<{ ok: boolean }>> {
  const res = await invokeSettingsRaw({ op: "builderKeys.revoke", keyId });
  if (res.error || !res.data) return { data: null, error: res.error };
  return { data: { ok: true }, error: null };
}
