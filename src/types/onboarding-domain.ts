/** Domain DTOs for onboarding flows (API + UI). */

export type TenantLifecycleStatus = "onboarding" | "active" | "paused";

export interface OnboardingTenantDto {
  id: string;
  name: string;
  logoUrl?: string;
  timeZone: string;
  currency: string;
  departments: OnboardingDepartmentDto[];
  integrations: OnboardingIntegrationConfigDto[];
  status: TenantLifecycleStatus;
  createdAt: string;
}

export interface OnboardingDepartmentDto {
  id: string;
  name: string;
  isDefault: boolean;
  order: number;
  enabled?: boolean;
}

export type IntegrationAuthType = "OAuth" | "APIKey";

export type IntegrationConnectionStatus = "not_connected" | "connected";

export interface OnboardingIntegrationConfigDto {
  provider: string;
  label?: string;
  type: IntegrationAuthType;
  status: IntegrationConnectionStatus;
  mappings?: Record<string, string>;
}

export interface OnboardingIntegrationSuggestion extends OnboardingIntegrationConfigDto {
  label: string;
  sampleMappings: Record<string, string>;
}

export interface TransactionalEmailTemplateDto {
  id: string;
  key: string;
  subject: string;
  body: string;
  placeholders: string[];
}
