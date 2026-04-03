export type GlobalSearchHitType = "Entity" | "Document" | "Activity" | "Report";

export interface GlobalSearchHit {
  id: string;
  type: GlobalSearchHitType;
  subType?: string;
  title: string;
  snippet: string;
  source: string;
  date: string;
  owner?: string;
  departmentId?: string | null;
  permissions?: unknown;
  href?: string;
}

export interface GlobalSearchFacets {
  types: Record<string, number>;
  sources: Record<string, number>;
}

export interface GlobalSearchFilters {
  types?: GlobalSearchHitType[];
  sources?: string[];
  departmentId?: string;
  departmentIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  owner?: string;
  owners?: string[];
  permissionScope?: "all" | "restricted";
  /** Client hint: prefer AI preview when selecting results */
  aiSummarize?: boolean;
}

export interface GlobalSearchResponse {
  total: number;
  results: GlobalSearchHit[];
  facets: GlobalSearchFacets;
}

export interface SearchAutosuggestItem {
  text: string;
  type: string;
  score: number;
}

export interface SearchAiSummarizeResult {
  summary: string;
  confidence: number;
}

export interface SearchIndexStatus {
  status: string;
  documentCount: number;
  lastIndexTime: string | null;
  recentJobs: Record<string, unknown>[];
  errors: string[];
}
