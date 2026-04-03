import type { OAuthProviderId } from "@/components/auth/login/types";

export type LoginUrlTenantContext = {
  tenantName?: string;
  tenantId?: string;
  ssoEnabled: boolean;
  oauthProviders: OAuthProviderId[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parse tenant hints from the login URL (subdomain routing can mirror these as query params).
 */
export function parseLoginSearchParams(search: string): LoginUrlTenantContext {
  const q = new URLSearchParams(search);
  const tenantNameParam = q.get("tenantName")?.trim();
  const tenantRaw = q.get("tenant") ?? q.get("company");
  const tenantName =
    (tenantNameParam && tenantNameParam.length > 0 ? tenantNameParam : undefined) ??
    (typeof tenantRaw === "string" && tenantRaw.trim().length > 0 ? tenantRaw.trim() : undefined);
  const tenantIdRaw = q.get("tenantId")?.trim();
  const tenantId =
    tenantIdRaw && UUID_RE.test(tenantIdRaw) ? tenantIdRaw : undefined;
  const ssoFlag = q.get("sso");
  const ssoEnabled = ssoFlag === "1" || ssoFlag === "true";
  const providersRaw = q.get("providers")?.split(",") ?? [];
  const fromQuery: OAuthProviderId[] = [];
  for (const p of providersRaw) {
    const n = p.trim().toLowerCase();
    if (n === "google") fromQuery.push("google");
    if (n === "microsoft" || n === "azure") fromQuery.push("microsoft");
  }
  const oauthProviders: OAuthProviderId[] =
    fromQuery.length > 0 ? [...new Set(fromQuery)] : ["google", "microsoft"];
  return { tenantName, tenantId, ssoEnabled, oauthProviders };
}
