/** User profile, tenant settings, TOTP, avatar upload — Edge Functions + auth-api. */
export {
  disableTotp,
  getMfaStatus,
  getTenantSettingsEnvelope,
  listTenantUsersEnvelope,
  patchTenantSettings,
  startTotpEnrollment,
  unlinkSsoProvider,
  uploadProfileAvatar,
  verifyTotpEnrollment,
  type AvatarUploadResult,
  type TenantSettingsRow,
  type TenantUserRow,
} from "@/lib/profile-api";
