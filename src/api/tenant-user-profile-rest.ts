/**
 * Tenant user profile — documented REST paths mapped to `tenant-user-profile-api`.
 * All responses are guarded for null/undefined; arrays default to [].
 */
import { invokeTenantUserProfileRest } from "@/lib/tenant-user-profile-rest-api";
import type {
  TenantActivitiesQuery,
  TenantAuthMethodsPayload,
  TenantUserProfilePatch,
} from "@/types/user-profile-tenant";
import type { ProfilePayload, TenantPayload } from "@/types/auth-api";

function pathProfileGet(tenantId: string, userId: string) {
  return `GET /tenants/${tenantId}/users/${userId}/profile`;
}

function pathProfilePatch(tenantId: string, userId: string) {
  return `PATCH /tenants/${tenantId}/users/${userId}/profile`;
}

function pathAuthMethodsGet(tenantId: string, userId: string) {
  return `GET /tenants/${tenantId}/users/${userId}/auth-methods`;
}

function pathAuthMethodsPatch(tenantId: string, userId: string) {
  return `PATCH /tenants/${tenantId}/users/${userId}/auth-methods`;
}

function pathNotificationsGet(tenantId: string, userId: string) {
  return `GET /tenants/${tenantId}/users/${userId}/notifications`;
}

function pathNotificationsPatch(tenantId: string, userId: string) {
  return `PATCH /tenants/${tenantId}/users/${userId}/notifications`;
}

function pathConnectionsGet(tenantId: string, userId: string) {
  return `GET /tenants/${tenantId}/users/${userId}/connections`;
}

function pathConnectionPatch(tenantId: string, userId: string, connectionId: string) {
  return `PATCH /tenants/${tenantId}/users/${userId}/connections/${connectionId}`;
}

function pathApiKeysGet(tenantId: string, userId: string) {
  return `GET /tenants/${tenantId}/users/${userId}/api-keys`;
}

function pathApiKeysPost(tenantId: string, userId: string) {
  return `POST /tenants/${tenantId}/users/${userId}/api-keys`;
}

function pathApiKeyPatch(tenantId: string, userId: string, keyId: string) {
  return `PATCH /tenants/${tenantId}/users/${userId}/api-keys/${keyId}`;
}

function pathApiKeyDelete(tenantId: string, userId: string, keyId: string) {
  return `DELETE /tenants/${tenantId}/users/${userId}/api-keys/${keyId}`;
}

function pathActivitiesGet(tenantId: string) {
  return `GET /tenants/${tenantId}/activities`;
}

export async function restGetTenantUserProfile(
  tenantId: string,
  userId: string,
): Promise<{ profile: ProfilePayload; tenant: TenantPayload } | null> {
  const { data, error } = await invokeTenantUserProfileRest<{
    profile: ProfilePayload;
    tenant: TenantPayload;
  }>({ path: pathProfileGet(tenantId, userId) });
  if (error || !data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    profile: (o.profile ?? null) as ProfilePayload,
    tenant: (o.tenant ?? null) as TenantPayload,
  };
}

export async function restPatchTenantUserProfile(
  tenantId: string,
  userId: string,
  patch: TenantUserProfilePatch,
): Promise<unknown> {
  const { data, error } = await invokeTenantUserProfileRest<unknown>({
    path: pathProfilePatch(tenantId, userId),
    body: patch as Record<string, unknown>,
  });
  if (error) throw new Error(error);
  return data;
}

export async function restGetAuthMethods(
  tenantId: string,
  userId: string,
): Promise<TenantAuthMethodsPayload | null> {
  const { data, error } = await invokeTenantUserProfileRest<TenantAuthMethodsPayload>({
    path: pathAuthMethodsGet(tenantId, userId),
  });
  if (error || !data || typeof data !== "object") return null;
  const methods = Array.isArray((data as TenantAuthMethodsPayload).methods)
    ? (data as TenantAuthMethodsPayload).methods
    : [];
  return {
    ...data,
    methods,
  };
}

export async function restPatchAuthMethods(
  tenantId: string,
  userId: string,
  authMethods: string[],
): Promise<unknown> {
  const list = Array.isArray(authMethods)
    ? authMethods.filter((s) => typeof s === "string" && s.trim().length > 0)
    : [];
  const { data, error } = await invokeTenantUserProfileRest<unknown>({
    path: pathAuthMethodsPatch(tenantId, userId),
    body: { authMethods: list },
  });
  if (error) throw new Error(error);
  return data;
}

export async function restGetNotificationEnvelope(
  tenantId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await invokeTenantUserProfileRest<{ preferences: unknown }>({
    path: pathNotificationsGet(tenantId, userId),
  });
  if (error) return {};
  const prefs =
    data && typeof data === "object" && "preferences" in data
      ? (data as { preferences: unknown }).preferences
      : {};
  if (prefs && typeof prefs === "object" && !Array.isArray(prefs)) {
    return prefs as Record<string, unknown>;
  }
  return {};
}

export async function restPatchNotifications(
  tenantId: string,
  userId: string,
  preferences: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await invokeTenantUserProfileRest<unknown>({
    path: pathNotificationsPatch(tenantId, userId),
    body: { preferences },
  });
  if (error) throw new Error(error);
  return data;
}

export type ExternalConnectionRow = {
  id: string;
  provider: string;
  linked_at: string;
  last_used_at?: string | null;
  revoked?: boolean;
};

export async function restListConnections(
  tenantId: string,
  userId: string,
): Promise<ExternalConnectionRow[]> {
  const { data, error } = await invokeTenantUserProfileRest<{ items: unknown }>({
    path: pathConnectionsGet(tenantId, userId),
  });
  if (error || !data || typeof data !== "object") return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as ExternalConnectionRow[]) : [];
}

export async function restDisconnectConnection(
  tenantId: string,
  userId: string,
  connectionId: string,
): Promise<void> {
  const { error } = await invokeTenantUserProfileRest<unknown>({
    path: pathConnectionPatch(tenantId, userId, connectionId),
    body: { action: "disconnect" },
  });
  if (error) throw new Error(error);
}

export type ApiKeyListItem = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at?: string | null;
  status?: string;
  created_at: string;
  last_used_at: string | null;
};

export async function restListApiKeys(
  tenantId: string,
  userId: string,
): Promise<ApiKeyListItem[]> {
  const { data, error } = await invokeTenantUserProfileRest<{ items: unknown }>({
    path: pathApiKeysGet(tenantId, userId),
  });
  if (error || !data || typeof data !== "object") return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as ApiKeyListItem[]) : [];
}

export async function restCreateApiKey(
  tenantId: string,
  userId: string,
  body: { name: string; scopes?: string[]; expiresAt?: string },
): Promise<{ secret: string; key: ApiKeyListItem }> {
  const { data, error } = await invokeTenantUserProfileRest<{
    secret?: string;
    key?: ApiKeyListItem;
  }>({
    path: pathApiKeysPost(tenantId, userId),
    body: body as Record<string, unknown>,
  });
  if (error) throw new Error(error);
  const pack = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const secret = typeof pack.secret === "string" ? pack.secret : "";
  const key = pack.key as ApiKeyListItem | undefined;
  if (!secret || !key) throw new Error("Invalid create key response");
  return { secret, key };
}

export async function restPatchApiKey(
  tenantId: string,
  userId: string,
  keyId: string,
  body: { name?: string; scopes?: string[]; rotate?: boolean },
): Promise<unknown> {
  const { data, error } = await invokeTenantUserProfileRest<unknown>({
    path: pathApiKeyPatch(tenantId, userId, keyId),
    body: body as Record<string, unknown>,
  });
  if (error) throw new Error(error);
  return data;
}

export async function restDeleteApiKey(
  tenantId: string,
  userId: string,
  keyId: string,
): Promise<void> {
  const { error } = await invokeTenantUserProfileRest<unknown>({
    path: pathApiKeyDelete(tenantId, userId, keyId),
  });
  if (error) throw new Error(error);
}

export async function restFetchActivities(
  tenantId: string,
  query: TenantActivitiesQuery,
): Promise<unknown> {
  const { data, error } = await invokeTenantUserProfileRest<unknown>({
    path: pathActivitiesGet(tenantId),
    query: {
      userId: query.userId,
      range: query.range,
      eventType: query.eventType,
    },
  });
  if (error) throw new Error(error);
  return data;
}
