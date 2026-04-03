import type { GlobalSearchHitType } from "@/types/global-search";

/** Normalized lowercase domain types for cross-module contracts */
export type SearchResultType = "entity" | "document" | "activity" | "report";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  snippet: string;
  source: string;
  ownerId: string;
  departmentId: string;
  lastUpdated: string;
  permissions: string[];
  context: Record<string, unknown>;
  aiSummaries?: string[];
  /** Original dashboard hit (for actions / composite id) */
  rawType: GlobalSearchHitType;
  href?: string;
  subType?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  ownerId: string;
}

export interface SearchFilterState {
  types: string[];
  sources: string[];
  departments: string[];
  owners: string[];
  dateFrom?: string;
  dateTo?: string;
  aiSummarize?: boolean;
  permissionScope?: "all" | "restricted";
}

export interface SearchPreviewPayload {
  result: SearchResult | null;
  aiSummary?: string;
  confidence?: number;
  provenance?: string;
  aiRestricted?: boolean;
}
