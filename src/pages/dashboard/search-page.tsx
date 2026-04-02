import { useState } from "react";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
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

const suggestions = [
  "Acme renewal",
  "Q3 board deck",
  "Invoice #4412",
  "Slack: #gtm-alerts",
];

export default function SearchPage() {
  const [q, setQ] = useState("");

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Search"
        description="Global, permission-aware search with autosuggest, filters, preview, and optional AI summary."
      />
      <Card className="border-border/80 bg-card/90">
        <CardContent className="p-0">
          <Command className="rounded-lg border border-border/60 bg-surface-inner">
            <CommandInput
              placeholder="Search people, deals, docs, tasks…"
              value={q}
              onValueChange={setQ}
            />
            <CommandList>
              <CommandEmpty>No results — connect integrations to index data.</CommandEmpty>
              <CommandGroup heading="Suggestions">
                {suggestions.map((s) => (
                  <CommandItem key={s} onSelect={() => setQ(s)}>
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90">
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Preview pane</p>
            <p>
              Snippet previews respect row-level security. Elasticsearch/OpenSearch
              indexes tenant_id + ACL bitsets server-side.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/80 bg-card/90">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">AI summary</p>
              <Badge variant="outline" className="text-xs">
                beta
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Optional condensed answer with citations after you pick a result.
            </p>
          </CardContent>
        </Card>
      </div>
    </AnimatedPage>
  );
}
