import type {
  GlobalSearchFilters,
  GlobalSearchHit,
  GlobalSearchHitType,
} from "@/types/global-search";
import type { SearchResult, SearchResultType } from "@/types/search-results-page";

function hitTypeToNormalized(t: GlobalSearchHitType): SearchResultType {
  switch (t) {
    case "Entity":
      return "entity";
    case "Document":
      return "document";
    case "Activity":
      return "activity";
    case "Report":
      return "report";
    default:
      return "entity";
  }
}

function permissionsToStrings(permissions: unknown): string[] {
  if (permissions === null || permissions === undefined) return [];
  const p = permissions as Record<string, unknown>;
  if (p.scope === "tenant") return ["tenant"];
  const roles = Array.isArray(p.roles) ? p.roles : [];
  const out = (roles ?? [])
    .map((r) => (typeof r === "string" ? r : String(r)))
    .filter(Boolean);
  return out.length > 0 ? out : ["scoped"];
}

/**
 * Normalizes Edge Function / unified search hits into the shared SearchResult contract.
 * Always returns a safe object (never throws on missing fields).
 */
export function adaptGlobalSearchHit(hit: GlobalSearchHit | null | undefined): SearchResult | null {
  if (!hit || typeof hit.id !== "string") return null;
  const type = hitTypeToNormalized(hit.type);
  const ctx: Record<string, unknown> = {
    subType: hit.subType ?? null,
    href: hit.href ?? null,
  };
  return {
    id: hit.id,
    type,
    title: typeof hit.title === "string" ? hit.title : "",
    snippet: typeof hit.snippet === "string" ? hit.snippet : "",
    source: typeof hit.source === "string" ? hit.source : "",
    ownerId: typeof hit.owner === "string" ? hit.owner : "",
    departmentId: hit.departmentId ?? "",
    lastUpdated: typeof hit.date === "string" ? hit.date : "",
    permissions: permissionsToStrings(hit.permissions),
    context: ctx,
    rawType: hit.type,
    href: hit.href,
    subType: hit.subType,
  };
}

export function adaptGlobalSearchHits(
  hits: GlobalSearchHit[] | null | undefined,
): SearchResult[] {
  const list = Array.isArray(hits) ? hits : [];
  const out: SearchResult[] = [];
  for (const h of list) {
    const row = adaptGlobalSearchHit(h);
    if (row) out.push(row);
  }
  return out;
}

export function compositeSearchId(hit: Pick<GlobalSearchHit, "type" | "id">): string {
  return `${hit.type}:${hit.id}`;
}

export function coerceSavedSearchFilters(raw: unknown): GlobalSearchFilters {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const types = Array.isArray(o.types)
    ? o.types.filter((t): t is GlobalSearchHitType =>
        t === "Entity" || t === "Document" || t === "Activity" || t === "Report",
      )
    : undefined;
  const sources = Array.isArray(o.sources) ? o.sources.map((s) => String(s)) : undefined;
  const departmentIds = Array.isArray(o.departmentIds)
    ? o.departmentIds.map((s) => String(s))
    : undefined;
  const owners = Array.isArray(o.owners) ? o.owners.map((s) => String(s)) : undefined;
  const departmentId = typeof o.departmentId === "string" ? o.departmentId : undefined;
  const dateFrom = typeof o.dateFrom === "string" ? o.dateFrom : undefined;
  const dateTo = typeof o.dateTo === "string" ? o.dateTo : undefined;
  const owner = typeof o.owner === "string" ? o.owner : undefined;
  const permissionScope =
    o.permissionScope === "restricted" || o.permissionScope === "all"
      ? o.permissionScope
      : undefined;
  const aiSummarize = o.aiSummarize === true ? true : undefined;
  return {
    ...(types?.length ? { types } : {}),
    ...(sources?.length ? { sources } : {}),
    ...(departmentIds?.length ? { departmentIds } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(owner ? { owner } : {}),
    ...(owners?.length ? { owners } : {}),
    ...(permissionScope ? { permissionScope } : {}),
    ...(aiSummarize ? { aiSummarize } : {}),
  };
}
