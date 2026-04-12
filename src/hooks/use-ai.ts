import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAiConversation,
  deleteAiConversation,
  executeAiAction,
  fetchAiContexts,
  fetchAiDashboardSummary,
  fetchAiPermissions,
  fetchAiToolsCatalog,
  runAiToolsDiagnostics,
  fetchWorkspaceDocuments,
  getAiConversation,
  listAiConversations,
  listPromptTemplates,
  updateAiConversation,
  upsertPromptTemplate,
} from "@/lib/ai-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { AiChatMode, AiConversationExecutionMode, AiConversationRow } from "@/types/ai";

export const aiQueryKeys = {
  root: ["ai"] as const,
  conversations: () => [...aiQueryKeys.root, "conversations"] as const,
  conversation: (id: string) => [...aiQueryKeys.root, "conversation", id] as const,
  templates: () => [...aiQueryKeys.root, "templates"] as const,
  permissions: () => [...aiQueryKeys.root, "permissions"] as const,
  toolsCatalog: () => [...aiQueryKeys.root, "toolsCatalog"] as const,
  dashboardSummary: () => [...aiQueryKeys.root, "dashboardSummary"] as const,
  diagnostics: () => [...aiQueryKeys.root, "diagnostics"] as const,
  workspaceDocuments: (sourceFilter: string) =>
    [...aiQueryKeys.root, "workspaceDocuments", sourceFilter] as const,
  contextPreview: () => [...aiQueryKeys.root, "contextPreview"] as const,
};

export function useAiConversationsList(limit = 20) {
  return useQuery<AiConversationRow[]>({
    queryKey: [...aiQueryKeys.conversations(), limit],
    queryFn: (): Promise<AiConversationRow[]> => listAiConversations(limit),
    enabled: isSupabaseConfigured,
  });
}

export function useAiConversationDetail(conversationId: string | null) {
  return useQuery({
    queryKey: aiQueryKeys.conversation(conversationId ?? ""),
    queryFn: () => getAiConversation(conversationId!),
    enabled: Boolean(conversationId) && isSupabaseConfigured,
  });
}

export function usePromptTemplates(workspaceMode?: AiChatMode) {
  return useQuery({
    queryKey: [...aiQueryKeys.templates(), workspaceMode ?? "all"] as const,
    queryFn: () =>
      listPromptTemplates({
        includeInactive: false,
        workspaceMode,
      }),
    enabled: isSupabaseConfigured,
  });
}

export function useWorkspaceDocuments(sourceFilter: string) {
  const trimmed = sourceFilter.trim();
  return useQuery({
    queryKey: aiQueryKeys.workspaceDocuments(trimmed),
    queryFn: () =>
      fetchWorkspaceDocuments({
        workspaceId: "global",
        limit: 40,
        sourceFilter: trimmed || undefined,
      }),
    enabled: isSupabaseConfigured,
  });
}

export function useAiContextPreview() {
  return useQuery({
    queryKey: aiQueryKeys.contextPreview(),
    queryFn: () => fetchAiContexts({ workspaceId: "global", query: "", limit: 16 }),
    enabled: isSupabaseConfigured,
  });
}

export function useAiActionPermissions() {
  return useQuery({
    queryKey: aiQueryKeys.permissions(),
    queryFn: () => fetchAiPermissions(),
    enabled: isSupabaseConfigured,
  });
}

export function useAiToolsCatalog() {
  return useQuery({
    queryKey: aiQueryKeys.toolsCatalog(),
    queryFn: () => fetchAiToolsCatalog(),
    enabled: isSupabaseConfigured,
  });
}

export function useAiDashboardSummary() {
  return useQuery({
    queryKey: aiQueryKeys.dashboardSummary(),
    queryFn: () => fetchAiDashboardSummary(),
    enabled: isSupabaseConfigured,
  });
}

export function useAiDiagnostics() {
  return useQuery({
    queryKey: aiQueryKeys.diagnostics(),
    queryFn: () => runAiToolsDiagnostics(),
    enabled: false,
  });
}

export function useCreateAiConversation() {
  const qc = useQueryClient();
  return useMutation<
    AiConversationRow,
    Error,
    { mode?: AiChatMode; title?: string; executionMode?: AiConversationExecutionMode } | undefined
  >({
    mutationFn: (params): Promise<AiConversationRow> => createAiConversation(params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiQueryKeys.conversations() });
    },
  });
}

export function useUpdateAiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      conversationId: string;
      patch: {
        mode?: AiChatMode;
        title?: string;
        executionMode?: AiConversationExecutionMode;
      };
    }) => updateAiConversation(params.conversationId, params.patch),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: aiQueryKeys.conversations() });
      void qc.invalidateQueries({ queryKey: aiQueryKeys.conversation(v.conversationId) });
    },
  });
}

export function useDeleteAiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => deleteAiConversation(conversationId),
    onSuccess: (_, conversationId) => {
      void qc.invalidateQueries({ queryKey: aiQueryKeys.conversations() });
      void qc.invalidateQueries({ queryKey: aiQueryKeys.conversation(conversationId) });
    },
  });
}

export function useExecuteAiAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      actionId: string;
      confirmed: boolean;
      conversationId?: string;
      payload?: Record<string, unknown>;
    }) => executeAiAction(params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiQueryKeys.dashboardSummary() });
      void qc.invalidateQueries({ queryKey: aiQueryKeys.permissions() });
    },
  });
}

export function useUpsertPromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertPromptTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...aiQueryKeys.templates()] });
    },
  });
}
