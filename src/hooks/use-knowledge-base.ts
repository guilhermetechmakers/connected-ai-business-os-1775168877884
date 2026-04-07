import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteKnowledgeBaseDocument,
  ingestKnowledgeBaseDocuments,
  listKnowledgeBaseDocuments,
  reindexKnowledgeBaseDocument,
} from "@/api/search";
import { aiQueryKeys } from "@/hooks/use-ai";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { KbIngestDocumentInput } from "@/types/knowledge-base";

export const knowledgeBaseKeys = {
  root: ["knowledge-base"] as const,
  list: (sourceFilter: string, statusFilter: string) =>
    [...knowledgeBaseKeys.root, "list", sourceFilter, statusFilter] as const,
  roles: () => [...knowledgeBaseKeys.root, "roles"] as const,
  departments: () => [...knowledgeBaseKeys.root, "departments"] as const,
};

export function useKnowledgeBaseDocumentsQuery(params?: {
  sourceFilter?: string;
  statusFilter?: "pending" | "indexing" | "ready" | "failed";
}) {
  const sourceFilter = (params?.sourceFilter ?? "").trim();
  const statusFilter = params?.statusFilter ?? "all";
  return useQuery({
    queryKey: knowledgeBaseKeys.list(sourceFilter, statusFilter),
    queryFn: () =>
      listKnowledgeBaseDocuments({
        limit: 200,
        sourceFilter: sourceFilter || undefined,
        statusFilter: params?.statusFilter,
      }),
    enabled: isSupabaseConfigured,
  });
}

export function useKnowledgeBaseIngestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documents: KbIngestDocumentInput[]) => ingestKnowledgeBaseDocuments(documents),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: knowledgeBaseKeys.root }),
        qc.invalidateQueries({ queryKey: aiQueryKeys.root }),
        qc.invalidateQueries({ queryKey: aiQueryKeys.contextPreview() }),
      ]);
    },
  });
}

export function useKnowledgeBaseDeleteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteKnowledgeBaseDocument,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: knowledgeBaseKeys.root }),
        qc.invalidateQueries({ queryKey: aiQueryKeys.root }),
        qc.invalidateQueries({ queryKey: aiQueryKeys.contextPreview() }),
      ]);
    },
  });
}

export function useKnowledgeBaseReindexMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reindexKnowledgeBaseDocument,
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: knowledgeBaseKeys.root }),
        qc.invalidateQueries({ queryKey: aiQueryKeys.root }),
        qc.invalidateQueries({ queryKey: aiQueryKeys.contextPreview() }),
      ]);
    },
  });
}

export function useCompanyRoleNamesQuery() {
  return useQuery({
    queryKey: knowledgeBaseKeys.roles(),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("roles")
        .select("name")
        .order("name", { ascending: true });
      if (error) return [];
      const list = Array.isArray(data) ? data : [];
      return list
        .map((row) => {
          const name = (row as { name?: unknown }).name;
          return typeof name === "string" ? name.trim() : "";
        })
        .filter(Boolean);
    },
    enabled: isSupabaseConfigured,
  });
}

export function useCompanyDepartmentNamesQuery() {
  return useQuery({
    queryKey: knowledgeBaseKeys.departments(),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("departments")
        .select("name")
        .order("name", { ascending: true });
      if (error) return [];
      const list = Array.isArray(data) ? data : [];
      return list
        .map((row) => {
          const name = (row as { name?: unknown }).name;
          return typeof name === "string" ? name.trim() : "";
        })
        .filter(Boolean);
    },
    enabled: isSupabaseConfigured,
  });
}
