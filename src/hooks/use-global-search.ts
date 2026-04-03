import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import {
  fetchGlobalSearch,
  fetchSearchAutosuggest,
  fetchSearchIndexStatus,
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
