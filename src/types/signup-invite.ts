import type { SignupInviteFormValues } from "@/lib/signup-invite-schema";

export type SignupEntryMode = "signup" | "invite";

export type SignupInviteWizardVariant = "signup" | "onboarding";

/** Payload mirrored by auth-api `auth.signup` companyProfile (optional). */
export type SignupCompanyProfilePayload = {
  timeZone: string;
  currency: string;
  departments: string[];
  integrations: string[];
};

export type SignupInviteReviewSnapshot = Pick<
  SignupInviteFormValues,
  | "entryMode"
  | "tenantName"
  | "domainHint"
  | "email"
  | "timeZone"
  | "currency"
  | "departments"
  | "integrationKeys"
>;
