import { ExternalLink, Pin, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UnifiedEntity } from "@/types/unified";
import { payloadString, payloadTitle } from "@/types/unified";

export type DocumentsPanelProps = {
  documents: UnifiedEntity[];
  className?: string;
};

function isPinned(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const o = payload as Record<string, unknown>;
  return o.pinned === true || o.isPinned === true;
}

export function DocumentsPanel({ documents, className }: DocumentsPanelProps) {
  const [q, setQ] = useState("");
  const list = Array.isArray(documents) ? documents : [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((d) => {
      const title = payloadTitle(d.payload).toLowerCase();
      const type = (payloadString(d.payload, "type") ?? "").toLowerCase();
      return title.includes(needle) || type.includes(needle);
    });
  }, [list, q]);

  const pinned = filtered.filter((d) => isPinned(d.payload));
  const rest = filtered.filter((d) => !isPinned(d.payload));

  return (
    <Card className={cn("border-border/80 bg-card/90 shadow-card", className)}>
      <CardHeader>
        <CardTitle className="text-base">Documents & resources</CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or type…"
            className="bg-surface-inner pl-9"
            aria-label="Search documents"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {pinned.length > 0 ? (
          <section aria-label="Pinned documents">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
              Pinned
            </p>
            <ul className="space-y-2">
              {pinned.map((d) => (
                <DocumentRow key={d.id} entity={d} pinned />
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-label="All documents">
          {pinned.length > 0 ? (
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              All
            </p>
          ) : null}
          {rest.length === 0 && pinned.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Document entities for this department yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {rest.map((d) => (
                <DocumentRow key={d.id} entity={d} />
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function DocumentRow({ entity, pinned }: { entity: UnifiedEntity; pinned?: boolean }) {
  const url = payloadString(entity.payload, "url");
  const type = payloadString(entity.payload, "type") ?? "document";
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-inner/80 px-3 py-2 text-sm transition-all duration-150 hover:border-primary/25">
      <div className="flex min-w-0 items-center gap-2">
        {pinned ? <Pin className="h-4 w-4 shrink-0 text-primary" aria-label="Pinned" /> : null}
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{payloadTitle(entity.payload)}</p>
          <p className="text-xs text-muted-foreground">{type}</p>
        </div>
      </div>
      {url ? (
        <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
          <a href={url} target="_blank" rel="noreferrer" aria-label="Open document in new tab">
            Open
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      ) : null}
    </li>
  );
}
