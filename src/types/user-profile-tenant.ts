/** REST-shaped tenant user profile API (`tenant-user-profile-api` Edge Function). */

export type NotificationChannelFrequency = "immediate" | "daily" | "weekly";

export type TenantProfileRestEnvelope<T> = {
  data: T | null;
  error?: string | null;
  details?: unknown;
};

export type TenantUserProfilePatch = {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  jobTitle?: string;
  department?: string;
  contactInfo?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
};

export type TenantAuthMethodsPayload = {
  passwordEnabled: boolean;
  oauthEnabled: boolean;
  methods: string[];
  mfa: { totpEnabled: boolean };
};

/** PATCH /auth-methods body (tenant-user-profile-api). */
export type TenantAuthMethodsPatchBody = {
  authMethods: string[];
};

export type TenantActivitiesQuery = {
  userId?: string;
  range?: "7d" | "30d" | "90d" | "all";
  eventType?: string;
};
