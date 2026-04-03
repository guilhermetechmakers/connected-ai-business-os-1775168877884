import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { GlobalSearchBar } from "@/components/global-search/global-search-bar";
import { GlobalSearchFilters as GlobalSearchFiltersPanel } from "@/components/global-search/global-search-filters";
import { GlobalSearchResultGroups } from "@/components/global-search/global-search-result-groups";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useInfiniteGlobalSearch,
  useSearchAiSummarizeMutation,
  useSearchIndexStatusQuery,
} from "@/hooks/use-global-search";
import { useDebouncedValue } from "@/hooks/use-unified-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  GlobalSearchFilters as GlobalSearchFiltersState,
  GlobalSearchHit,
} from "@/types/global-search";

function hitKey(hit: GlobalSearchHit): string {
  return `${hit.type}-${hit.id}`;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [filters, setFilters] = useState<GlobalSearchFiltersState>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiOpenId, setAiOpenId] = useState<string | null>(null);
  const [aiTargetId, setAiTargetId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [aiConfidence, setAiConfidence] = useState<number | undefined>(undefined);

  const debouncedSearch = useDebouncedValue(q, 280);

  useEffect(() => {
    const iq = params.get("q");
    if (iq !== null) setQ(iq);
  }, [params]);

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

  const total = data?.pages?.[0]?.total ?? 0;
  const facets = data?.pages?.[0]?.facets;

  const aiMutation = useSearchAiSummarizeMutation();
  const { data: indexStatus } = useSearchIndexStatusQuery(isSupabaseConfigured);

  const runSearch = useCallback(() => {
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    setParams(next, { replace: true });
  }, [q, params, setParams]);

  const requestAiForHit = useCallback(
    async (hit: GlobalSearchHit) => {
      const key = hitKey(hit);
      setAiTargetId(key);
      setAiSummary("");
      setAiConfidence(undefined);
      try {
        const out = await aiMutation.mutateAsync({
          contextItems: [
            { id: hit.id, type: hit.type, source: hit.source },
          ],
        });
        if (out) {
          setAiSummary(out.summary);
          setAiConfidence(out.confidence);
        } else {
          toast.error("Could not generate AI summary.");
        }
      } catch {
        toast.error("AI summary failed.");
      }
    },
    [aiMutation],
  );

  const onToggleAi = useCallback(
    (hit: GlobalSearchHit) => {
      const key = hitKey(hit);
      if (aiOpenId === key) {
        setAiOpenId(null);
        setAiTargetId(null);
        return;
      }
      setAiOpenId(key);
      void requestAiForHit(hit);
    },
    [aiOpenId, requestAiForHit],
  );

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Global search"
        description="Permission-aware search across unified entities, indexed documents, activity, and reports — with autosuggest and optional AI summaries."
        actions={
          <Badge variant="outline" className="text-xs">
            Tenant scoped · RLS
          </Badge>
        }
      />

      <Card className="border-border/80 bg-gradient-to-r from-primary/10 via-transparent to-success/5 shadow-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Search everywhere</CardTitle>
          <p className="text-sm text-muted-foreground">
            Results are grouped by type. Use filters to narrow source, department, and dates.
          </p>
        </CardHeader>
        <CardContent>
          <GlobalSearchBar
            value={q}
            onChange={setQ}
            onSubmit={runSearch}
            variant="hero"
            aria-label="Global search query"
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <GlobalSearchFiltersPanel filters={filters} onChange={setFilters} />

        <div className="min-w-0 flex-1 space-y-6">
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
              Type at least two characters to search. Autosuggest appears after a short pause (~120ms).
            </p>
          )}

          <GlobalSearchResultGroups
            results={flatResults}
            isLoading={isLoading}
            selectedId={selectedId}
            onSelect={(hit) => setSelectedId(hitKey(hit))}
            aiOpenId={aiOpenId}
            aiTargetId={aiTargetId}
            onToggleAi={onToggleAi}
            aiSummary={aiSummary}
            aiLoading={aiMutation.isPending}
            aiConfidence={aiConfidence}
          />

          {hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="w-full transition-transform duration-150 hover:scale-[1.01] motion-reduce:hover:scale-100"
              disabled={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : null}
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
              <p className="sm:col-span-3 text-destructive text-xs">
                {(indexStatus.errors ?? []).join(" · ")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </AnimatedPage>
  );
}
