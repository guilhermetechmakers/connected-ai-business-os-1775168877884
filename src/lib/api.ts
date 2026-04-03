import { supabase } from "@/lib/supabase";

/** Auth Edge Function (`auth-api`) — native `fetch` inside `invokeAuthApiEnvelope`. */
export {
  invokeAuthApi,
  invokeAuthApiEnvelope,
  safeStringArray,
  type AuthApiEnvelope,
} from "@/lib/auth-api";

/** Public marketing content (native fetch, no auth). */
export {
  fetchLogoAssets,
  fetchMarketingFeatureHighlights,
  fetchMarketingPricingTiers,
  fetchMarketingTestimonials,
} from "@/lib/public-content-fetch";

const getBaseUrl = () =>
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

async function buildHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl().replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const mergedHeaders = await buildHeaders(
    options.headers as Record<string, string> | undefined,
  );

  const response = await fetch(url, { ...options, headers: mergedHeaders });

  if (!response.ok) {
    if (response.status === 401) {
      await supabase.auth.signOut();
      window.location.href = "/login";
    }
    throw new Error(`API Error: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  put: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  patch: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: "DELETE" }),
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export { integrationsClient } from "@/lib/integrations-client";

/** Integrations onboarding & connector CRUD (Edge Function `integrations-api`). */
export { integrationsManagerApi } from "@/lib/integrations-manager-api";

/** Sign-up / invite onboarding (native fetch to `auth-api` for domain suggestions). */
export {
  fetchDomainSuggestions,
  type DomainSuggestionsResponse,
} from "@/lib/onboarding-signup-api";

/** Executive dashboard snapshot (`executive.snapshot` via unified-data-api). */
export {
  fetchExecutiveDashboardSnapshot,
  logExecutiveExport,
} from "@/api/executive-dashboard";

/** Unified data layer (Edge Function `unified-data-api` + Supabase RLS). */
export {
  fetchDashboardRollups,
  fetchDepartmentSnapshot,
  fetchRecentActivity,
  fetchReportSchedules,
  fetchReportTemplates,
  fetchSearchResults,
  fetchUnifiedEntities,
} from "@/api/unified-data";

/** Department workspace — unified tasks, `department-ai-generate` Edge Function, directory (Supabase client). */
export {
  createDepartmentTask,
  generateDepartmentAiResponse,
  type DepartmentAiGenerateParams,
  type DepartmentAiGenerateResult,
} from "@/api/department-workspace";
export { fetchTenantDepartmentsDirectory } from "@/lib/department-workspace-api";

/** Department workspace list catalog (`department-workspace-api` tenants.departments.*). */
export {
  createTenantDepartmentWorkspace,
  fetchDepartmentWorkspaceListCatalog,
  parseWorkspaceDepartmentList,
  validateDepartmentShape,
} from "@/api/departments-catalog";

/** Notifications & alerts (Edge Function `notifications-api` + Realtime). */
export {
  bulkUpdateNotifications,
  createAlertRule,
  createNotificationEvent,
  createNotificationSchedule,
  deleteAlertRule,
  fetchAlertRules,
  fetchChannelSettings,
  fetchNotificationPreferences,
  fetchNotificationSchedules,
  fetchNotificationsList,
  testFcm,
  testSendgrid,
  updateAlertRule,
  upsertChannelSecrets,
  upsertChannelSettings,
  upsertNotificationPreferences,
} from "@/api/notifications";

/** AI Assistant & Agent layer (Edge Function `ai-api`). */
export {
  assemblePrompt,
  completeAiChat,
  createAiConversation,
  executeAiAction,
  fetchAiContexts,
  fetchAiDashboardInsights,
  fetchAiDashboardSummary,
  fetchAiPermissions,
  fetchExecutiveBrief,
  fetchWorkspaceDocuments,
  getAiConversation,
  listAiConversations,
  listPromptTemplates,
  streamAiChat,
  updateAiConversation,
  upsertPromptTemplate,
} from "@/api/ai";

/** Global search & indexed documents (Edge Function `search-api`). */
export {
  createSavedSearch,
  deleteSavedSearch,
  exportSearchResults,
  fetchGlobalSearch,
  fetchSearchAutosuggest,
  fetchSearchIndexStatus,
  fetchSearchPreview,
  listSavedSearches,
  summarizeSearchContext,
  upsertIndexedDocument,
} from "@/api/search";

/** Activity log & audit trail (Edge Function `activity-logs-api`). */
export {
  createActivityLogEntry,
  createAdminTenant,
  deleteAdminSystemTemplate,
  exportTenantActivityLogs,
  fetchAdminActivitySearch,
  fetchAdminActivityTail,
  fetchAdminAuditSearch,
  fetchAdminFeatureFlags,
  fetchAdminSystemTemplates,
  fetchTenantActivityLogs,
  runAdminPruneRetention,
  searchTenantActivityLogs,
  upsertAdminFeatureFlag,
  upsertAdminSystemTemplate,
} from "@/api/activity-logs";

/** Workflows engine (Edge Function `workflows-api` + Supabase RLS). */
export {
  appendWorkflowRunLogs,
  cancelWorkflowRun,
  createDefaultWorkflowDefinition,
  createWorkflow,
  deleteWorkflow,
  fetchActivityLog,
  fetchApprovals,
  fetchWorkflow,
  fetchWorkflowLibrary,
  fetchWorkflowRun,
  fetchWorkflowRuns,
  fetchWorkflows,
  parseRunLogs,
  retryWorkflowRun,
  runWorkflow,
  scheduleWorkflow,
  submitApproval,
  updateWorkflow,
  validateWorkflowDefinition,
} from "@/api/workflows";

/** User profile, tenant RBAC settings, TOTP, avatar (`auth-api` + `profile-avatar`). */
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
} from "@/api/user-profile";

/** Tenant-scoped user profile REST facade (`tenant-user-profile-api`). */
export {
  restCreateApiKey,
  restDeleteApiKey,
  restDisconnectConnection,
  restFetchActivities,
  restGetAuthMethods,
  restGetNotificationEnvelope,
  restGetTenantUserProfile,
  restListApiKeys,
  restListConnections,
  restPatchApiKey,
  restPatchNotifications,
  restPatchTenantUserProfile,
  type ApiKeyListItem,
  type ExternalConnectionRow,
} from "@/api/tenant-user-profile-rest";

/** Admin console REST facade (`admin-console-api` Edge Function, super_admin only). */
export {
  adminConsoleRest,
  fetchAdminCrossTenantActivity,
} from "@/lib/admin-console-api";

/** Transactional email templates (Edge Function `transactional-email-api`). */
export {
  cloneEmailTemplate,
  fetchEmailTemplatesList,
  previewEmailTemplate,
  upsertEmailTemplate,
  type EmailTemplateBuiltin,
  type EmailTemplateRow,
} from "@/api/transactional-email";

/** Settings / preferences hub (Edge Function `settings-api`). */
export {
  settingsHubAuditAppend,
  settingsHubAuditList,
  settingsHubBuilderKeyCreate,
  settingsHubBuilderKeyRevoke,
  settingsHubBuilderKeysList,
  settingsHubDataPolicyGet,
  settingsHubDataPolicyPatch,
  settingsHubProfileRoleIds,
  settingsHubProfileRolesListAll,
  settingsHubProfileRolesListTenant,
  settingsHubProfileRolesReplace,
  settingsHubRoleCreate,
  settingsHubRoleDelete,
  settingsHubRolePatch,
  settingsHubRolesList,
  settingsHubTenantFlagUpsert,
  settingsHubTenantFlagsList,
  type BuilderApiKeyCreatedRow,
  type BuilderApiKeyPublicRow,
  type ProfileRoleAssignmentPair,
  type SettingsAuditRow,
  type SettingsRoleRow,
  type TenantDataPolicyRow,
  type TenantFeatureFlagRow,
} from "@/lib/settings-hub-api";

/** Multi-tenant company module (Edge Function `tenants-api` + Supabase RLS). */
export {
  applyOnboardingCompany,
  bulkDeprovisionTenantsAdmin,
  createTenantAdminModule,
  deprovisionTenantAdmin,
  fetchOnboardingTemplates,
  fetchOnboardingTemplatesAdmin,
  fetchTenantAdminDetail,
  fetchTenantConfigs,
  fetchTenantIntegrationMonitor,
  fetchTenantsAdminList,
  patchTenantAdminModule,
  upsertOnboardingTemplateAdmin,
  upsertTenantConfig,
} from "@/api/tenants";

/** Dashboard framework (Edge Function `dashboard-api` + Supabase RLS). */
export {
  createDashboardExportSchedule,
  ensureDashboardLayout,
  fetchAvailableDashboardWidgets,
  fetchDashboardDefinitions,
  getDashboardExportSchedule,
  getDashboardLayout,
  listDashboardExportSchedules,
  patchDashboardWidgetInstance,
  registerDashboardWidgetDefinition,
  saveDashboardLayout,
  triggerDashboardExportSchedule,
} from "@/api/dashboard";

/** Internal modules & marketplace (Edge Function `modules-api` + Supabase RLS). */
export {
  createInternalModule,
  createModuleVersion,
  deleteInternalModule,
  deployInternalModule,
  deployModule,
  fetchInternalModuleDetail,
  fetchInternalModules,
  fetchMarketplaceTemplates,
  fetchModuleDetail,
  fetchModulePermissions,
  fetchModuleVersions,
  installMarketplaceTemplate,
  installModuleFromTemplate,
  publishModuleVersion,
  putModuleDepartments,
  putModulePermissions,
  rollbackModule,
  rollbackModuleVersion,
  setModuleDepartmentBindings,
  summarizeBindings,
  updateInternalModule,
} from "@/api/modules";
