import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cloneEmailTemplate,
  fetchEmailTemplatesList,
  previewEmailTemplate,
  upsertEmailTemplate,
} from "@/api/transactional-email";
import { isSupabaseConfigured } from "@/lib/supabase";

export const emailTemplatesQueryKeys = {
  root: ["email-templates"] as const,
  list: () => [...emailTemplatesQueryKeys.root, "list"] as const,
};

export function useEmailTemplatesListQuery(enabled = true) {
  return useQuery({
    queryKey: emailTemplatesQueryKeys.list(),
    queryFn: fetchEmailTemplatesList,
    enabled: enabled && isSupabaseConfigured,
    retry: false,
  });
}

export function useUpsertEmailTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertEmailTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emailTemplatesQueryKeys.root });
    },
  });
}

export function useCloneEmailTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cloneEmailTemplate,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emailTemplatesQueryKeys.root });
    },
  });
}

export function usePreviewEmailTemplateMutation() {
  return useMutation({
    mutationFn: previewEmailTemplate,
  });
}
