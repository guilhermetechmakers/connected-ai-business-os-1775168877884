import { Library, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  WORKFLOW_DND_NODE_LABEL,
  WORKFLOW_DND_NODE_TYPE,
  WORKFLOW_DND_PRESET,
} from "@/components/workflows/workflow-dnd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkflowLibraryQuery } from "@/hooks/use-workflows";
import type { WorkflowLibraryTemplate, WorkflowNodeType } from "@/types/workflows";
import { cn } from "@/lib/utils";

export type WorkflowLibraryPanelProps = {
  readOnly?: boolean;
  className?: string;
  /** Called when user clicks Add (center drop not available). */
  onQuickAdd?: (item: WorkflowLibraryTemplate) => void;
};

function guardTemplates(
  list: unknown,
): WorkflowLibraryTemplate[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (x): x is WorkflowLibraryTemplate =>
      !!x &&
      typeof x === "object" &&
      typeof (x as WorkflowLibraryTemplate).id === "string" &&
      typeof (x as WorkflowLibraryTemplate).type === "string",
  );
}

export function WorkflowLibraryPanel({
  readOnly = false,
  className,
  onQuickAdd,
}: WorkflowLibraryPanelProps) {
  const { data: catalog, isLoading } = useWorkflowLibraryQuery();
  const [q, setQ] = useState("");

  const triggers = useMemo(
    () => guardTemplates(catalog?.triggers),
    [catalog?.triggers],
  );
  const actions = useMemo(
    () => guardTemplates(catalog?.actions),
    [catalog?.actions],
  );
  const logic = useMemo(
    () => guardTemplates(catalog?.logic),
    [catalog?.logic],
  );

  const needle = q.trim().toLowerCase();

  function filterList(items: WorkflowLibraryTemplate[]) {
    if (!needle) return items;
    return items.filter(
      (t) =>
        String(t.label ?? "").toLowerCase().includes(needle) ||
        String(t.description ?? "").toLowerCase().includes(needle),
    );
  }

  function renderItems(items: WorkflowLibraryTemplate[]) {
    const filtered = filterList(items);
    if (filtered.length === 0) {
      return (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          No catalog items match your search.
        </p>
      );
    }
    return (
      <ul className="space-y-2 p-2">
        {(filtered ?? []).map((item) => (
          <li key={item.id}>
            <div
              role="listitem"
              draggable={!readOnly}
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  WORKFLOW_DND_NODE_TYPE,
                  item.type as WorkflowNodeType,
                );
                e.dataTransfer.setData(
                  WORKFLOW_DND_PRESET,
                  JSON.stringify(item.preset ?? {}),
                );
                e.dataTransfer.setData(
                  WORKFLOW_DND_NODE_LABEL,
                  String(item.label ?? ""),
                );
                e.dataTransfer.effectAllowed = "copy";
              }}
              className={cn(
                "rounded-xl border border-border/70 bg-surface-inner/60 p-3 transition-all duration-150",
                "hover:border-primary/35 hover:shadow-card-hover",
                readOnly && "pointer-events-none opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px] capitalize">
                    {item.type}
                  </Badge>
                </div>
                {onQuickAdd && !readOnly ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Add ${item.label} to canvas`}
                    onClick={() => onQuickAdd(item)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border/80 bg-card/90 shadow-card",
        className,
      )}
    >
      <div className="border-b border-border/60 p-4">
        <div className="flex items-center gap-2 text-primary">
          <Library className="h-5 w-5" aria-hidden />
          <h3 className="text-sm font-semibold text-foreground">
            Connector library
          </h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag presets onto the canvas or use Add when the studio is narrow.
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search triggers, actions…"
            className="border-border/60 bg-input pl-9 text-sm"
            aria-label="Search workflow library"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="triggers" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-2 mt-2 grid h-9 grid-cols-3 bg-surface-inner p-1">
            <TabsTrigger value="triggers" className="text-xs">
              Triggers
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">
              Actions
            </TabsTrigger>
            <TabsTrigger value="logic" className="text-xs">
              Logic
            </TabsTrigger>
          </TabsList>
          <TabsContent value="triggers" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[min(420px,55vh)]">
              {renderItems(triggers)}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="actions" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[min(420px,55vh)]">
              {renderItems(actions)}
            </ScrollArea>
          </TabsContent>
          <TabsContent value="logic" className="mt-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[min(420px,55vh)]">
              {renderItems(logic)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
