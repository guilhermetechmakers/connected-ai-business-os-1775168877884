import { Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { adaptGlobalSearchHit } from "@/lib/search-unified-adapter";
import { cn } from "@/lib/utils";
import type { GlobalSearchHit } from "@/types/global-search";

export type SearchPreviewPaneProps = {
  hit: GlobalSearchHit | null;
  aiSummary?: string;
  aiConfidence?: number;
  provenance?: string;
  aiRestricted?: boolean;
  isAiLoading?: boolean;
  canUseAi: boolean;
  onRefreshAi: () => void;
  onExportOne?: () => void;
  className?: string;
};

export function SearchPreviewPane({
  hit,
  aiSummary,
  aiConfidence,
  provenance,
  aiRestricted,
  isAiLoading,
  canUseAi,
  onRefreshAi,
  onExportOne,
  className,
}: SearchPreviewPaneProps) {
  const normalized = hit ? adaptGlobalSearchHit(hit) : null;

  return (
    <Card
      className={cn(
        "sticky top-24 border-border/70 bg-card/95 shadow-card motion-reduce:static",
        className,
      )}
    >
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="font-display text-base text-foreground">Preview</CardTitle>
        <p className="text-xs text-muted-foreground">
          Contextual detail, provenance, and optional AI summary for the selected result.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!normalized ? (
          <p className="text-sm text-muted-foreground">Select a result to preview details.</p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">
                  {normalized.type}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {normalized.source}
                </Badge>
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                {normalized.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{normalized.snippet}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Updated{" "}
                <time dateTime={normalized.lastUpdated}>
                  {normalized.lastUpdated
                    ? new Date(normalized.lastUpdated).toLocaleString()
                    : "—"}
                </time>
              </p>
            </div>

            <Separator className="bg-border/60" />

            <div className="space-y-2" role="region" aria-label="Provenance">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Provenance
              </p>
              <p className="text-xs text-muted-foreground">
                {provenance ?? `${normalized.source} · unified tenant index`}
              </p>
              {normalized.permissions.length > 0 ? (
                <p className="text-[10px] text-muted-foreground">
                  Permissions hint: {(normalized.permissions ?? []).join(", ")}
                </p>
              ) : null}
            </div>

            <Separator className="bg-border/60" />

            <div className="space-y-3" role="region" aria-label="AI summary">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  AI summary
                </p>
                <div className="flex gap-2">
                  {onExportOne ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={onExportOne}
                    >
                      Export slice
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="cta"
                    className="h-8 gap-1 text-xs"
                    disabled={!canUseAi || !hit}
                    onClick={onRefreshAi}
                  >
                    {isAiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {isAiLoading ? "Generating…" : "Summarize"}
                  </Button>
                </div>
              </div>
              {!canUseAi ? (
                <p className="text-xs text-muted-foreground">
                  AI summarization is not enabled for your role.
                </p>
              ) : aiRestricted ? (
                <p className="text-xs text-amber-200/90">
                  This summary path is restricted for your permissions. Server returned a safe
                  fallback.
                </p>
              ) : null}
              <div className="rounded-xl border border-primary/15 bg-surface-inner/90 p-4 text-sm text-muted-foreground animate-in fade-in duration-200 motion-reduce:animate-none">
                {isAiLoading ? (
                  <p className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                    Generating tenant-scoped summary…
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap text-foreground/90">
                    {aiSummary || "Click Summarize to generate an AI brief with citations to this record."}
                  </p>
                )}
                {typeof aiConfidence === "number" && !isAiLoading ? (
                  <p className="mt-2 text-xs text-primary">
                    Model confidence: {(aiConfidence * 100).toFixed(0)}%
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
