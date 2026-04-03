import { supabase } from "@/lib/supabase";

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
  fetchAiDashboardSummary,
  fetchAiPermissions,
  getAiConversation,
  listAiConversations,
  listPromptTemplates,
  streamAiChat,
  updateAiConversation,
} from "@/api/ai";

/** Global search & indexed documents (Edge Function `search-api`). */
export {
  fetchGlobalSearch,
  fetchSearchAutosuggest,
  fetchSearchIndexStatus,
  summarizeSearchContext,
  upsertIndexedDocument,
} from "@/api/search";

/** Workflows engine (Edge Function `workflows-api` + Supabase RLS). */
export {
  appendWorkflowRunLogs,
  createDefaultWorkflowDefinition,
  createWorkflow,
  deleteWorkflow,
  fetchActivityLog,
  fetchApprovals,
  fetchWorkflow,
  fetchWorkflowRun,
  fetchWorkflowRuns,
  fetchWorkflows,
  parseRunLogs,
  runWorkflow,
  submitApproval,
  updateWorkflow,
  validateWorkflowDefinition,
} from "@/api/workflows";

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
