import type { Json } from "@/types/database";

export type AuthApiError = {
  message: string;
  code?: string;
  details?: unknown;
};

export type AuthApiEnvelope<T> = {
  data: T | null;
  error: AuthApiError | null;
  meta: Record<string, unknown>;
};

export type AuthSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
};

export type TenantPayload = {
  id: string;
  name: string;
  domain: string | null;
  industry?: string | null;
  timezone?: string;
  currency?: string;
  sso_settings?: Json;
  password_policy?: Json;
  allowed_auth_methods?: string[];
  settings?: Json;
  created_at?: string;
} | null;

export type ProfilePayload = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  roles: string[];
  auth_methods: string[];
  company_id: string | null;
  preferences?: Json;
  status?: string;
  created_at?: string;
} | null;

export type LoginResponseData = {
  session: AuthSessionPayload;
  user: { id: string; email: string | undefined | null };
  profile: ProfilePayload;
  tenant: TenantPayload;
};

export type ProfileGetData = {
  profile: ProfilePayload;
  tenant: TenantPayload;
  externalAccounts: Array<{
    id: string;
    provider: string;
    linked_at: string;
  }>;
  apiKeys: Array<{
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
  }>;
  securityEvents: Array<{
    event_type: string;
    payload: Json;
    created_at: string;
  }>;
};

export type InvitationResolveData = {
  email: string;
  companyId: string;
  companyName: string | null;
};
