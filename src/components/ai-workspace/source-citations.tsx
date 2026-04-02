import { ChevronDown, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AiSourceCitation } from "@/types/ai";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function normalizeCitations(raw: unknown): AiSourceCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is AiSourceCitation =>
    Boolean(c && typeof c === "object" && "source" in c && typeof (c as AiSourceCitation).source === "string"),
  );
}

export function SourceCitationsBlock({
  citations,
  className,
}: {
  citations: unknown;
  className?: string;
}) {
  const list = normalizeCitations(citations);
  if (list.length === 0) return null;

  return (
    <Collapsible className={cn("rounded-lg border border-border/60 bg-surface-inner/60", className)}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" aria-hidden />
            Sources ({list.length})
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-2 border-t border-border/40 px-3 py-3 text-sm">
          {list.map((c, i) => (
            <li
              key={`${c.source}-${c.reference ?? i}`}
              className="rounded-md border border-border/40 bg-card/40 px-3 py-2"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {c.source}
                {c.reference ? (
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {c.reference}
                  </span>
                ) : null}
              </p>
              {c.retrievedAt ? (
                <p className="mt-1 text-[10px] text-muted-foreground">{c.retrievedAt}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
