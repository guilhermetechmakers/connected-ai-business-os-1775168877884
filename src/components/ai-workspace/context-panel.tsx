import { useMemo, useState } from "react";
import { Database, Filter } from "lucide-react";

import { DocumentCard } from "@/components/ai-workspace/document-card";
import { SourceCitationsBlock } from "@/components/ai-workspace/source-citations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiContextPreview, useWorkspaceDocuments } from "@/hooks/use-ai";
import { cn } from "@/lib/utils";
import type { AiSourceCitation } from "@/types/ai";

function safeCitations(raw: unknown): AiSourceCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is AiSourceCitation =>
      Boolean(c && typeof c === "object" && "source" in c && typeof (c as AiSourceCitation).source === "string"),
  );
}

export function ContextPanel({
  className,
  inlineCitations,
}: {
  className?: string;
  inlineCitations?: AiSourceCitation[];
}) {
  const [sourceFilter, setSourceFilter] = useState("");
  const { data: docData, isLoading: docsLoading } = useWorkspaceDocuments(sourceFilter);
  const { data: ctxData, isLoading: ctxLoading } = useAiContextPreview();

  const documents = useMemo(() => (Array.isArray(docData) ? docData : []), [docData]);
  const ctxCitations = useMemo(
    () => safeCitations(ctxData?.citations),
    [ctxData?.citations],
  );
  const mergedInline = useMemo(
    () => (Array.isArray(inlineCitations) ? inlineCitations : []),
    [inlineCitations],
  );

  return (
    <Card
      className={cn(
        "border-border/80 bg-card/90 shadow-card transition-transform duration-150 hover:-translate-y-0.5",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-display">
          <Database className="h-4 w-4 text-primary" aria-hidden />
          Context &amp; sources
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tenant RAG: unified entities, indexed documents, and workspace chunks — scoped by company.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="documents" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-surface-inner">
            <TabsTrigger value="documents" className="text-xs">
              Documents
            </TabsTrigger>
            <TabsTrigger value="retrieval" className="text-xs">
              Retrieval
            </TabsTrigger>
            <TabsTrigger value="inline" className="text-xs">
              This turn
            </TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="mt-3 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="src-filter" className="flex items-center gap-1 text-xs uppercase tracking-wider">
                <Filter className="h-3 w-3" aria-hidden />
                Source filter
              </Label>
              <Input
                id="src-filter"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                placeholder="e.g. notion, drive"
                className="h-9 bg-surface-inner text-sm"
              />
            </div>
            {docsLoading ? (
              <p className="text-xs text-muted-foreground">Loading document index…</p>
            ) : documents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No indexed rows yet. Connect integrations and run sync to populate Drive / Notion / uploads.
              </p>
            ) : (
              <ScrollArea className="h-[220px] pr-2">
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={`${d.kind}-${d.id}`}>
                      <DocumentCard item={d} />
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </TabsContent>
          <TabsContent value="retrieval" className="mt-3 space-y-2">
            {ctxLoading ? (
              <p className="text-xs text-muted-foreground">Loading retrieval preview…</p>
            ) : (
              <>
                {ctxData?.snippets ? (
                  <pre className="max-h-[180px] overflow-auto rounded-lg border border-border/50 bg-surface-inner/80 p-2 text-[10px] leading-relaxed text-muted-foreground">
                    {ctxData.snippets.slice(0, 4000)}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground">No assembled snippets for empty query.</p>
                )}
                <SourceCitationsBlock citations={ctxCitations} />
              </>
            )}
          </TabsContent>
          <TabsContent value="inline" className="mt-3">
            {mergedInline.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Citations from the latest assistant message appear here for quick audit.
              </p>
            ) : (
              <SourceCitationsBlock citations={mergedInline} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
