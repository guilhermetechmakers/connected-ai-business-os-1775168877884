import { useCallback, useEffect, useMemo, useState } from "react";

import { summarizeEntityForSearch } from "@/api/unified-data";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { AISummaryCard } from "@/components/unified-data/ai-summary-card";
import { FilterChips } from "@/components/unified-data/filter-chips";
import { ResultList } from "@/components/unified-data/result-list";
import { SearchBar } from "@/components/unified-data/search-bar";
import { UnifiedEntityCard } from "@/components/unified-data/unified-entity-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedValue, useUnifiedSearch } from "@/hooks/use-unified-data";
import type { UnifiedEntity } from "@/types/unified";
import { mapUnifiedEntityRows } from "@/types/unified";

const suggestions = [
  "Acme renewal",
  "Q3 board deck",
  "Invoice #4412",
  "Slack: #gtm-alerts",
];

const typeFilters = [
  { id: "Task", label: "Tasks" },
  { id: "Deal", label: "Deals" },
  { id: "Document", label: "Docs" },
  { id: "Contact", label: "Contacts" },
];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [preview, setPreview] = useState<UnifiedEntity | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const debounced = useDebouncedValue(q, 300);
  const primaryType = selectedTypes[0];

  const { data: rawResults = [], isFetching } = useUnifiedSearch(debounced, {
    entityType: primaryType,
  });

  const results = useMemo(
    () => mapUnifiedEntityRows(rawResults),
    [rawResults],
  );

  const loadSummary = useCallback(async (entityId: string) => {
    setSummaryLoading(true);
    try {
      const res = await summarizeEntityForSearch(entityId, "brief");
      setSummary(res?.summary ?? "No summary available.");
    } catch {
      setSummary("Summary request failed.");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!preview?.id) {
      setSummary("");
      return;
    }
    void loadSummary(preview.id);
  }, [preview?.id, loadSummary]);

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Search"
        description="Global, permission-aware search across unified entities with filters and optional AI summary."
      />
      <div className="space-y-4">
        <SearchBar value={q} onChange={setQ} />
        <FilterChips
          options={typeFilters}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />
      </div>
      <Card className="border-border/80 bg-card/90">
        <CardContent className="p-0">
          <Command className="rounded-lg border border-border/60 bg-surface-inner">
            <CommandInput
              placeholder="Suggestions…"
              value={q}
              onValueChange={setQ}
              aria-label="Search suggestions"
            />
            <CommandList>
              <CommandEmpty>No matching suggestions</CommandEmpty>
              <CommandGroup heading="Suggestions">
                {(suggestions ?? []).map((s) => (
                  <CommandItem key={s} onSelect={() => setQ(s)}>
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </CardContent>
      </Card>

      <ResultList
        results={results}
        isLoading={isFetching}
        onSelect={(e) => setPreview(e)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Preview</p>
              <Badge variant="outline" className="text-xs">
                RLS enforced
              </Badge>
            </div>
            {preview ? (
              <UnifiedEntityCard entity={preview} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a result to preview payload and sources.
              </p>
            )}
          </CardContent>
        </Card>
        <AISummaryCard
          summary={summary}
          isLoading={summaryLoading}
          onRefresh={() => {
            if (preview?.id) void loadSummary(preview.id);
          }}
        />
      </div>
    </AnimatedPage>
  );
}
