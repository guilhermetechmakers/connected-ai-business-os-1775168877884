import type { GlobalSearchHit } from "@/types/global-search";

function normalizeRoles(roles: string[]): Set<string> {
  return new Set((roles ?? []).map((r) => String(r).toLowerCase()));
}

function documentVisible(permissions: unknown, userRoles: string[]): boolean {
  const p = permissions as Record<string, unknown> | null;
  if (!p || p.scope === "tenant") return true;
  const pr = Array.isArray(p.roles) ? (p.roles as string[]) : [];
  if (pr.length === 0) return true;
  const ur = normalizeRoles(userRoles);
  return pr.some((role) => ur.has(String(role).toLowerCase()));
}

/**
 * Client-side guard mirroring search-api visibility for indexed documents.
 * Server remains authoritative; this prevents accidental UI leakage if responses are malformed.
 */
export function filterAccessibleSearchHits(
  hits: GlobalSearchHit[] | null | undefined,
  userRoles: string[] | null | undefined,
): GlobalSearchHit[] {
  const list = Array.isArray(hits) ? hits : [];
  const roles = Array.isArray(userRoles) ? userRoles : [];
  return list.filter((h) => {
    if (!h || typeof h.id !== "string") return false;
    if (h.type === "Document") {
      return documentVisible(h.permissions, roles);
    }
    return true;
  });
}

export function canUseSearchAiClient(userRoles: string[] | null | undefined): boolean {
  const r = normalizeRoles(Array.isArray(userRoles) ? userRoles : []);
  if (r.size === 0) return true;
  if (r.size === 1 && r.has("viewer")) return false;
  return true;
}
