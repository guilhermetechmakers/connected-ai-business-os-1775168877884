import { invokeAuthApi, invokeAuthApiEnvelope } from "@/lib/auth-api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Json } from "@/types/database";

export type TenantSettingsRow = {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  timezone?: string;
  currency?: string;
  sso_settings?: Json;
  password_policy?: Json;
  allowed_auth_methods?: string[];
  settings?: Json;
  created_at?: string;
};

export type TenantUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  roles: string[];
  status: string;
  created_at: string;
  job_title?: string | null;
  department?: string | null;
};

export async function getTenantSettingsEnvelope() {
  return invokeAuthApiEnvelope<{ tenant: TenantSettingsRow | null }>({
    op: "tenant.settings.get",
  });
}

export async function patchTenantSettings(patch: Record<string, unknown>) {
  return invokeAuthApiEnvelope<{ tenant: TenantSettingsRow | null }>({
    op: "tenant.settings.patch",
    ...patch,
  });
}

export async function listTenantUsersEnvelope() {
  return invokeAuthApiEnvelope<{ users: TenantUserRow[] }>({
    op: "tenant.users.list",
  });
}

export async function unlinkSsoProvider(provider: "google" | "microsoft" | "saml" | "oidc") {
  return invokeAuthApi<{ ok: boolean }>({
    op: "sso.unlink",
    provider,
  });
}

export async function startTotpEnrollment() {
  return invokeAuthApi<{ otpauthUrl: string; manualSecret: string }>({
    op: "totp.enroll.start",
  });
}

export async function verifyTotpEnrollment(code: string) {
  return invokeAuthApi<{ ok: boolean }>({
    op: "totp.enroll.verify",
    code,
  });
}

export async function disableTotp(code: string) {
  return invokeAuthApi<{ ok: boolean }>({
    op: "totp.disable",
    code,
  });
}

export async function getMfaStatus() {
  return invokeAuthApiEnvelope<{ enabled: boolean; factors: string[] }>({
    op: "mfa.status",
  });
}

export type AvatarUploadResult = { url: string };

export async function uploadProfileAvatar(imageBase64: string, mimeType: string) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  const allowed = ["image/png", "image/jpeg", "image/webp"] as const;
  if (!allowed.includes(mimeType as (typeof allowed)[number])) {
    throw new Error("Unsupported image type.");
  }
  const { data, error } = await supabase.functions.invoke<{
    data?: AvatarUploadResult | null;
    error?: { message?: string } | null;
  }>("profile-avatar", {
    body: { imageBase64, mimeType },
  });
  if (error) throw new Error(error.message);
  const url = data && typeof data === "object" && data.data && typeof data.data.url === "string"
    ? data.data.url
    : null;
  if (!url) {
    const msg =
      data && typeof data === "object" && "error" in data &&
        data.error && typeof data.error === "object" && "message" in data.error &&
        typeof (data.error as { message?: string }).message === "string"
        ? (data.error as { message: string }).message
        : "Avatar upload failed";
    throw new Error(msg);
  }
  return { url } satisfies AvatarUploadResult;
}
