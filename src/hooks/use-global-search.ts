import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createSavedSearch,
  deleteSavedSearch,
  exportSearchResults,
  fetchGlobalSearch,
  fetchSearchAutosuggest,
  fetchSearchIndexStatus,
  fetchSearchPreview,
  listSavedSearches,
  summarizeSearchContext,
} from "@/api/search";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { GlobalSearchFilters } from "@/types/global-search";

export const globalSearchQueryKeys = {
  root: ["global-search"] as const,
  query: (q: string, filterKey: string, page: number) =>
    [...globalSearchQueryKeys.root, "results", q, filterKey, page] as const,
  suggest: (q: string) => [...globalSearchQueryKeys.root, "suggest", q] as const,
  indexStatus: () => [...globalSearchQueryKeys.root, "index-status"] as const,
  saved: () => [...globalSearchQueryKeys.root, "saved"] as const,
  preview: (id: string, gen: boolean) =>
    [...globalSearchQueryKeys.root, "preview", id, gen] as const,
};

export function useGlobalSearchResults(
  debouncedQuery: string,
  filters: GlobalSearchFilters,
  page: number,
) {
  const filterKey = JSON.stringify(filters ?? {});

  return useQuery({
    queryKey: globalSearchQueryKeys.query(debouncedQuery, filterKey, page),
    queryFn: () =>
      fetchGlobalSearch({
        query: debouncedQuery,
        filters,
        page,
        pageSize: 24,
      }),
    enabled: isSupabaseConfigured && debouncedQuery.trim().length >= 2,
    placeholderData: (prev) => prev,
  });
}

export function useSearchAutosuggest(debouncedQ: string) {
  return useQuery({
    queryKey: globalSearchQueryKeys.suggest(debouncedQ),
    queryFn: () => fetchSearchAutosuggest(debouncedQ, 10),
    enabled: isSupabaseConfigured && debouncedQ.trim().length >= 1,
    staleTime: 30_000,
  });
}

export function useSearchIndexStatusQuery(enabled = false) {
  return useQuery({
    queryKey: globalSearchQueryKeys.indexStatus(),
    queryFn: fetchSearchIndexStatus,
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useSearchAiSummarizeMutation() {
  return useMutation({
    mutationFn: summarizeSearchContext,
  });
}

export function useSavedSearchesQuery() {
  return useQuery({
    queryKey: globalSearchQueryKeys.saved(),
    queryFn: listSavedSearches,
    enabled: isSupabaseConfigured,
  });
}

export function useSaveSearchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSavedSearch,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: globalSearchQueryKeys.saved() });
    },
  });
}

export function useDeleteSavedSearchMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSavedSearch,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: globalSearchQueryKeys.saved() });
    },
  });
}

export function useSearchPreviewQuery(
  compositeId: string | null,
  generateAi: boolean,
  enabled: boolean,
) {
  return useQuery({
    queryKey: globalSearchQueryKeys.preview(compositeId ?? "", generateAi),
    queryFn: () =>
      fetchSearchPreview({
        compositeId: compositeId ?? "",
        generateAi,
      }),
    enabled:
      isSupabaseConfigured &&
      enabled &&
      Boolean(compositeId && compositeId.includes(":")),
    staleTime: generateAi ? 60_000 : 30_000,
  });
}

export function useSearchExportMutation() {
  return useMutation({
    mutationFn: exportSearchResults,
  });
}

export function useInfiniteGlobalSearch(
  debouncedQuery: string,
  filters: GlobalSearchFilters,
  pageSize = 24,
) {
  const q = debouncedQuery.trim();
  const filterKey = JSON.stringify(filters ?? {});

  return useInfiniteQuery({
    queryKey: [...globalSearchQueryKeys.root, "infinite", q, filterKey, pageSize],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchGlobalSearch({
        query: q,
        filters,
        page: pageParam as number,
        pageSize,
      }),
    getNextPageParam: (last, _all, lastPageParam) => {
      const prev = lastPageParam as number;
      const loaded = prev * pageSize;
      return loaded < last.total ? prev + 1 : undefined;
    },
    enabled: isSupabaseConfigured && q.length >= 2,
    staleTime: 20_000,
  });
}
