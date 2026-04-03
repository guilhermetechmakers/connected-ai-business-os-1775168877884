import { invokeSearchApi } from "@/lib/search-api";
import { adaptGlobalSearchHit } from "@/lib/search-unified-adapter";
import type {
  GlobalSearchFilters,
  GlobalSearchHit,
  GlobalSearchHitType,
  GlobalSearchResponse,
  SearchAiSummarizeResult,
  SearchAutosuggestItem,
  SearchIndexStatus,
} from "@/types/global-search";
import type { SavedSearch, SearchPreviewPayload } from "@/types/search-results-page";

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

type SavedSearchApiRow = {
  id: string;
  name: string;
  query: string;
  filters: unknown;
  created_at: string;
  updated_at: string;
  user_id: string;
};

function normalizeSavedSearchRow(row: unknown): SavedSearch | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  const filters =
    r.filters && typeof r.filters === "object" && !Array.isArray(r.filters)
      ? (r.filters as Record<string, unknown>)
      : {};
  return {
    id: r.id,
    name: r.name,
    query: typeof r.query === "string" ? r.query : "",
    filters,
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : undefined,
    ownerId: typeof r.user_id === "string" ? r.user_id : "",
  };
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const { data, error } = await invokeSearchApi<SavedSearchApiRow[]>({
    op: "search.savedList",
  });
  if (error || data === null || data === undefined) return [];
  const list = Array.isArray(data) ? data : [];
  const out: SavedSearch[] = [];
  for (const row of list) {
    const n = normalizeSavedSearchRow(row);
    if (n) out.push(n);
  }
  return out;
}

export async function createSavedSearch(input: {
  name: string;
  query: string;
  filters?: GlobalSearchFilters;
}): Promise<SavedSearch | null> {
  const { data, error } = await invokeSearchApi<{
    success: boolean;
    savedSearch: SavedSearchApiRow;
  }>({
    op: "search.savedCreate",
    name: input.name.trim(),
    query: input.query,
    filters: input.filters ?? {},
  });
  if (error || !data?.savedSearch) return null;
  return normalizeSavedSearchRow(data.savedSearch);
}

export async function deleteSavedSearch(id: string): Promise<boolean> {
  const { data, error } = await invokeSearchApi<{ success: boolean }>({
    op: "search.savedDelete",
    id,
  });
  if (error) return false;
  return data?.success === true;
}

export async function fetchSearchPreview(params: {
  compositeId: string;
  generateAi?: boolean;
}): Promise<SearchPreviewPayload | null> {
  const { data, error } = await invokeSearchApi<{
    result: GlobalSearchHit;
    aiSummary?: string;
    confidence?: number;
    provenance?: string;
    aiRestricted?: boolean;
  }>({
    op: "search.preview",
    compositeId: params.compositeId,
    generateAi: params.generateAi ?? false,
  });
  if (error || !data || !data.result) return null;
  return {
    result: adaptGlobalSearchHit(data.result),
    aiSummary: typeof data.aiSummary === "string" ? data.aiSummary : undefined,
    confidence: typeof data.confidence === "number" ? data.confidence : undefined,
    provenance: typeof data.provenance === "string" ? data.provenance : undefined,
    aiRestricted: data.aiRestricted === true,
  };
}

export async function exportSearchResults(params: {
  query: string;
  filters?: GlobalSearchFilters;
  format: "csv" | "json";
  fields?: string[];
  maxRows?: number;
}): Promise<{ content: string; filename: string; mimeType: string } | null> {
  const { data, error } = await invokeSearchApi<{
    content: string;
    filename: string;
    mimeType: string;
  }>({
    op: "search.export",
    query: params.query,
    filters: params.filters ?? {},
    format: params.format,
    fields: params.fields,
    maxRows: params.maxRows ?? 500,
  });
  if (error || !data) return null;
  return {
    content: typeof data.content === "string" ? data.content : "",
    filename: typeof data.filename === "string" ? data.filename : "export.csv",
    mimeType: typeof data.mimeType === "string" ? data.mimeType : "text/plain",
  };
}
