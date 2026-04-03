import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import {
  SearchExportModal,
  SearchFilterPanel,
  SearchHeader,
  SearchPreviewPane,
  SearchResultsList,
  SearchSavePanel,
  applySavedSearchToState,
} from "@/components/search-results";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { exportSearchResults } from "@/api/search";
import {
  useDeleteSavedSearchMutation,
  useInfiniteGlobalSearch,
  useSaveSearchMutation,
  useSavedSearchesQuery,
  useSearchAiSummarizeMutation,
  useSearchIndexStatusQuery,
} from "@/hooks/use-global-search";
import { useSearchTelemetry } from "@/hooks/use-search-telemetry";
import { useDebouncedValue } from "@/hooks/use-unified-data";
import { canUseSearchAiClient, filterAccessibleSearchHits } from "@/lib/search-access-control";
import {
  coerceSavedSearchFilters,
  compositeSearchId,
} from "@/lib/search-unified-adapter";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { GlobalSearchFilters, GlobalSearchHit } from "@/types/global-search";

const SESSION_KEY = "caos-search-session-v1";

function hitKey(hit: GlobalSearchHit): string {
  return compositeSearchId(hit);
}

export default function SearchPage() {
  const { profile } = useAuth();
  const userRoles = profile?.roles ?? [];
  const canAi = canUseSearchAiClient(userRoles);

  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [filters, setFilters] = useState<GlobalSearchFilters>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(() => new Set());
  const [aiByKey, setAiByKey] = useState<
    Record<string, { summary: string; confidence: number }>
  >({});

  const { track } = useSearchTelemetry();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as { q?: string; filters?: unknown };
      if (typeof o.q === "string") setQ(o.q);
      if (o.filters !== undefined) {
        setFilters(coerceSavedSearchFilters(o.filters));
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ q, filters }));
    } catch {
      /* ignore */
    }
  }, [q, filters]);

  useEffect(() => {
    const iq = params.get("q");
    if (iq !== null) setQ(iq);
  }, [params]);

  const debouncedSearch = useDebouncedValue(q, 280);

  useEffect(() => {
    const t = debouncedSearch.trim();
    track({ kind: "search_query", queryLength: t.length });
  }, [debouncedSearch, track]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteGlobalSearch(debouncedSearch, filters, 24);

  const flatResults = useMemo(() => {
    const pages = data?.pages ?? [];
    const merged: GlobalSearchHit[] = [];
    for (const p of pages) {
      const chunk = Array.isArray(p?.results) ? p.results : [];
      merged.push(...chunk);
    }
    return merged;
  }, [data?.pages]);

  const safeResults = useMemo(
    () => filterAccessibleSearchHits(flatResults, userRoles),
    [flatResults, userRoles],
  );

  const total = data?.pages?.[0]?.total ?? 0;
  const facets = data?.pages?.[0]?.facets;

  const selectedHit = useMemo(
    () => safeResults.find((h) => hitKey(h) === selectedKey) ?? null,
    [safeResults, selectedKey],
  );

  useEffect(() => {
    if (safeResults.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (selectedKey && safeResults.some((h) => hitKey(h) === selectedKey)) return;
    setSelectedKey(hitKey(safeResults[0]));
  }, [safeResults, selectedKey]);

  const aiMutation = useSearchAiSummarizeMutation();
  const { data: indexStatus } = useSearchIndexStatusQuery(isSupabaseConfigured);
  const { data: savedRaw = [], isLoading: savedLoading } = useSavedSearchesQuery();
  const saved = Array.isArray(savedRaw) ? savedRaw : [];
  const saveMutation = useSaveSearchMutation();
  const deleteMutation = useDeleteSavedSearchMutation();

  const runSearch = useCallback(() => {
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    setParams(next, { replace: true });
  }, [q, params, setParams]);

  const requestAiForHit = useCallback(
    async (hit: GlobalSearchHit) => {
      const key = hitKey(hit);
      if (!canAi) {
        toast.error("AI summarization is not available for your role.");
        return;
      }
      try {
        const out = await aiMutation.mutateAsync({
          contextItems: [{ id: hit.id, type: hit.type, source: hit.source }],
        });
        if (out) {
          setAiByKey((s) => ({
            ...s,
            [key]: { summary: out.summary, confidence: out.confidence },
          }));
          track({ kind: "ai_summary", ok: true });
        } else {
          toast.error("Could not generate AI summary.");
          track({ kind: "ai_summary", ok: false });
        }
      } catch {
        toast.error("AI summary failed.");
        track({ kind: "ai_summary", ok: false });
      }
    },
    [aiMutation, canAi, track],
  );

  const onSelectHit = useCallback(
    (hit: GlobalSearchHit) => {
      const key = hitKey(hit);
      setSelectedKey(key);
      if (filters.aiSummarize === true && canAi) {
        void requestAiForHit(hit);
      }
    },
    [canAi, filters.aiSummarize, requestAiForHit],
  );

  const toggleHighlight = useCallback((key: string) => {
    setHighlightedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const copyLink = useCallback(
    async (hit: GlobalSearchHit) => {
      const base = `${window.location.origin}/search?q=${encodeURIComponent(debouncedSearch.trim())}`;
      const url = `${base}&hit=${encodeURIComponent(hitKey(hit))}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied.");
      } catch {
        toast.error("Clipboard unavailable.");
      }
    },
    [debouncedSearch],
  );

  const aiForSelected = selectedKey ? aiByKey[selectedKey] : undefined;

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Global search"
        description="Permission-aware search across unified entities, documents, activity, and reports — with autosuggest, filters, saved searches, export, and optional AI summaries."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchExportModal
              query={debouncedSearch}
              disabled={!isSupabaseConfigured}
              onExport={async ({ format, fields }) => {
                track({ kind: "export", format, rowCount: total });
                return exportSearchResults({
                  query: debouncedSearch.trim(),
                  filters,
                  format,
                  fields,
                  maxRows: 500,
                });
              }}
            />
            <Badge variant="outline" className="text-xs">
              Tenant scoped · RLS
            </Badge>
          </div>
        }
      />

      {!isSupabaseConfigured ? (
        <Card className="border-amber-500/30 bg-card/90">
          <CardHeader>
            <CardTitle className="text-base">Supabase not configured</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Set <code className="text-primary">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-primary">VITE_SUPABASE_ANON_KEY</code> to enable live search, saved
            searches, and exports.
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-gradient-to-r from-primary/10 via-transparent to-success/5 shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base text-foreground">Search everywhere</CardTitle>
          <p className="text-sm text-muted-foreground">
            Debounced queries (~280ms) with categorized autosuggest. Filters refine sources,
            departments, owners, and permission scope.
          </p>
        </CardHeader>
        <CardContent>
          <SearchHeader
            value={q}
            onChange={setQ}
            onSubmit={runSearch}
            aria-label="Global search query"
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-12 xl:items-start">
        <div className="flex flex-col gap-6 xl:col-span-3">
          <SearchFilterPanel
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              track({ kind: "filter_change", filterKey: "panel" });
            }}
          />
          <SearchSavePanel
            query={debouncedSearch}
            filters={filters}
            saved={saved}
            isLoadingSaved={savedLoading}
            onSave={async (input) => {
              const row = await saveMutation.mutateAsync(input);
              const ok = row !== null;
              if (ok) track({ kind: "saved_search", action: "create" });
              return ok;
            }}
            onDelete={async (id) => {
              const ok = await deleteMutation.mutateAsync(id);
              if (ok) track({ kind: "saved_search", action: "delete" });
              return ok;
            }}
            onRunSaved={(s) => {
              const { query: rq, filters: rf } = applySavedSearchToState(s);
              setQ(rq);
              setFilters(rf);
              setParams((p) => {
                const n = new URLSearchParams(p);
                if (rq.trim()) n.set("q", rq.trim());
                else n.delete("q");
                return n;
              }, { replace: true });
              track({ kind: "saved_search", action: "run" });
              toast.message(`Loaded “${s.name}”`);
            }}
          />
        </div>

        <div className="min-w-0 space-y-6 xl:col-span-5">
          {debouncedSearch.trim().length >= 2 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">{total}</span> results for{" "}
                <span className="text-primary">&ldquo;{debouncedSearch}&rdquo;</span>
              </p>
              {facets?.types && Object.keys(facets.types).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(facets.types).map(([t, c]) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}: {c}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Type at least two characters to search. Autosuggest appears after a short pause.
            </p>
          )}

          <SearchResultsList
            results={safeResults}
            isLoading={isLoading}
            selectedKey={selectedKey}
            highlightedKeys={highlightedKeys}
            onSelect={onSelectHit}
            onToggleHighlight={toggleHighlight}
            onCopyLink={copyLink}
            rowKey={hitKey}
          />

          {hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="w-full transition-transform duration-150 hover:scale-[1.01] motion-reduce:transition-none motion-reduce:hover:scale-100"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : null}
        </div>

        <div className="min-w-0 xl:col-span-4">
          <SearchPreviewPane
            hit={selectedHit}
            aiSummary={aiForSelected?.summary}
            aiConfidence={aiForSelected?.confidence}
            isAiLoading={aiMutation.isPending}
            canUseAi={canAi}
            onRefreshAi={() => {
              if (selectedHit) void requestAiForHit(selectedHit);
            }}
            onExportOne={() => {
              void (async () => {
                const out = await exportSearchResults({
                  query: debouncedSearch.trim(),
                  filters,
                  format: "csv",
                  fields: ["id", "type", "title", "snippet", "source", "date"],
                  maxRows: 50,
                });
                if (!out) {
                  toast.error("Export failed.");
                  return;
                }
                const blob = new Blob([out.content], { type: out.mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = out.filename;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Slice exported.");
              })();
            }}
          />
        </div>
      </div>

      {isSupabaseConfigured && indexStatus ? (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-sm">Index status</CardTitle>
            <p className="text-xs text-muted-foreground">
              Document index health for this tenant (from search-api).
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <p>
              <span className="text-foreground">Documents indexed:</span>{" "}
              {indexStatus.documentCount}
            </p>
            <p>
              <span className="text-foreground">Last index:</span>{" "}
              {indexStatus.lastIndexTime
                ? new Date(indexStatus.lastIndexTime).toLocaleString()
                : "—"}
            </p>
            <p>
              <span className="text-foreground">Status:</span> {indexStatus.status}
            </p>
            {Array.isArray(indexStatus.errors) && indexStatus.errors.length > 0 ? (
              <p className="text-destructive sm:col-span-3 text-xs">
                {(indexStatus.errors ?? []).join(" · ")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </AnimatedPage>
  );
}
