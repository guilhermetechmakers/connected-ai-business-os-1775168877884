import type { Json } from "@/types/database";

/** Tenant row returned from `companies` (multi-tenant module fields). */
export interface TenantCompanyRecord {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  settings: Json;
  domain: string | null;
  industry: string | null;
  sso_settings: Json;
  password_policy: Json;
  allowed_auth_methods: string[];
  activity_log_retention_days: number;
  region: string;
  tenant_status: "active" | "suspended" | "deprovisioned" | "provisioning";
  plan: string;
  billing_id: string | null;
  legal_name: string | null;
  display_name: string | null;
  country: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantConfigRow {
  id: string;
  company_id: string;
  config_key: string;
  config_value: Json | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTemplateRow {
  id: string;
  name: string;
  template_type: "onboarding" | "system";
  version: number;
  data: Json | Record<string, unknown>;
  is_active: boolean;
  tenant_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantIntegrationMonitorRow {
  connectors: Array<{
    id: string;
    provider_key: string;
    status: string;
    last_sync_at: string | null;
  }>;
  integrations: Array<{
    id: string;
    provider: string;
    status: string;
    last_sync_at: string | null;
    error_message: string | null;
  }>;
}
