import { invokeSearchApi } from "@/lib/search-api";
import type {
  GlobalSearchFilters,
  GlobalSearchHitType,
  GlobalSearchResponse,
  SearchAiSummarizeResult,
  SearchAutosuggestItem,
  SearchIndexStatus,
} from "@/types/global-search";

function emptyFacets() {
  return { types: {} as Record<string, number>, sources: {} as Record<string, number> };
}

export async function fetchGlobalSearch(params: {
  query: string;
  filters?: GlobalSearchFilters;
  page?: number;
  pageSize?: number;
  includeAI?: boolean;
}): Promise<GlobalSearchResponse> {
  const { data, error } = await invokeSearchApi<GlobalSearchResponse>({
    op: "search.global",
    query: params.query,
    filters: params.filters ?? {},
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 24,
    includeAI: params.includeAI ?? false,
  });

  if (error || !data) {
    return { total: 0, results: [], facets: emptyFacets() };
  }

  const results = Array.isArray(data.results) ? data.results : [];
  const facets = data.facets && typeof data.facets === "object"
    ? {
        types: { ...(data.facets.types ?? {}) },
        sources: { ...(data.facets.sources ?? {}) },
      }
    : emptyFacets();

  return {
    total: typeof data.total === "number" ? data.total : results.length,
    results,
    facets,
  };
}

export async function fetchSearchAutosuggest(
  q: string,
  limit = 10,
): Promise<SearchAutosuggestItem[]> {
  const { data, error } = await invokeSearchApi<SearchAutosuggestItem[]>({
    op: "search.autosuggest",
    q,
    limit,
  });
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

export async function summarizeSearchContext(params: {
  contextItems: { id: string; type: GlobalSearchHitType; source?: string }[];
  requiredPermissions?: string[];
}): Promise<SearchAiSummarizeResult | null> {
  const { data, error } = await invokeSearchApi<SearchAiSummarizeResult>({
    op: "search.aiSummarize",
    contextItems: params.contextItems,
    requiredPermissions: params.requiredPermissions ?? [],
  });
  if (error || !data) return null;
  return {
    summary: typeof data.summary === "string" ? data.summary : "",
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
  };
}

export async function upsertIndexedDocument(input: {
  documentId?: string;
  provider: string;
  externalId?: string;
  content?: string;
  title?: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
  departmentId?: string | null;
  embeddings?: number[];
}): Promise<{ id: string; indexed: boolean } | null> {
  const { data, error } = await invokeSearchApi<{ id: string; indexed: boolean }>({
    op: "search.indexDocument",
    documentId: input.documentId,
    provider: input.provider,
    externalId: input.externalId ?? "",
    content: input.content ?? "",
    title: input.title,
    snippet: input.snippet,
    metadata: input.metadata ?? {},
    permissions: input.permissions ?? { scope: "tenant" },
    departmentId: input.departmentId ?? null,
    embeddings: input.embeddings,
  });
  if (error || !data) return null;
  return data;
}

export async function fetchSearchIndexStatus(): Promise<SearchIndexStatus | null> {
  const { data, error } = await invokeSearchApi<SearchIndexStatus>({
    op: "search.indexStatus",
  });
  if (error || !data) return null;
  const recentJobs = Array.isArray(data.recentJobs) ? data.recentJobs : [];
  const errors = Array.isArray(data.errors) ? data.errors : [];
  return {
    status: typeof data.status === "string" ? data.status : "unknown",
    documentCount: typeof data.documentCount === "number" ? data.documentCount : 0,
    lastIndexTime: data.lastIndexTime ?? null,
    recentJobs,
    errors,
  };
}
