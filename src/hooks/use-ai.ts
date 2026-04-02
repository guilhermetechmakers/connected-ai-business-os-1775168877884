import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAiConversation,
  executeAiAction,
  fetchAiDashboardSummary,
  fetchAiPermissions,
  getAiConversation,
  listAiConversations,
  listPromptTemplates,
  updateAiConversation,
} from "@/lib/ai-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { AiChatMode } from "@/types/ai";

export const aiQueryKeys = {
  root: ["ai"] as const,
  conversations: () => [...aiQueryKeys.root, "conversations"] as const,
  conversation: (id: string) => [...aiQueryKeys.root, "conversation", id] as const,
  templates: () => [...aiQueryKeys.root, "templates"] as const,
  permissions: () => [...aiQueryKeys.root, "permissions"] as const,
  dashboardSummary: () => [...aiQueryKeys.root, "dashboardSummary"] as const,
};

export function useAiConversationsList(limit = 20) {
  return useQuery({
    queryKey: [...aiQueryKeys.conversations(), limit],
    queryFn: () => listAiConversations(limit),
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

export function usePromptTemplates() {
  return useQuery({
    queryKey: aiQueryKeys.templates(),
    queryFn: () => listPromptTemplates(false),
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

export function useAiDashboardSummary() {
  return useQuery({
    queryKey: aiQueryKeys.dashboardSummary(),
    queryFn: () => fetchAiDashboardSummary(),
    enabled: isSupabaseConfigured,
  });
}

export function useCreateAiConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params?: { mode?: AiChatMode; title?: string }) =>
      createAiConversation(params),
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
      patch: { mode?: AiChatMode; title?: string };
    }) => updateAiConversation(params.conversationId, params.patch),
    onSuccess: (_, v) => {
      void qc.invalidateQueries({ queryKey: aiQueryKeys.conversations() });
      void qc.invalidateQueries({ queryKey: aiQueryKeys.conversation(v.conversationId) });
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
