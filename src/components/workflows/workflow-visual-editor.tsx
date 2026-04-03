import {
  ArrowDown,
  GitBranch,
  GitMerge,
  Hourglass,
  Play,
  Repeat2,
  ShieldCheck,
  SplitSquareHorizontal,
  Trash2,
  Zap,
} from "lucide-react";
import type { DragEvent } from "react";
import { useCallback, useRef } from "react";

import {
  WORKFLOW_DND_MOVE_ID,
  WORKFLOW_DND_NODE_LABEL,
  WORKFLOW_DND_NODE_TYPE,
  WORKFLOW_DND_PRESET,
} from "@/components/workflows/workflow-dnd";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
} from "@/types/workflows";

const NODE_TYPES: {
  type: WorkflowNodeType;
  label: string;
  icon: typeof Zap;
  className: string;
}[] = [
  {
    type: "trigger",
    label: "Trigger",
    icon: Play,
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  {
    type: "condition",
    label: "Condition",
    icon: GitBranch,
    className: "border-secondary/50 bg-secondary/15 text-secondary-foreground",
  },
  {
    type: "branch",
    label: "Branch",
    icon: SplitSquareHorizontal,
    className: "border-accent/40 bg-accent/10 text-accent-foreground",
  },
  {
    type: "loop",
    label: "Loop",
    icon: Repeat2,
    className: "border-primary/35 bg-primary/5 text-primary",
  },
  {
    type: "action",
    label: "Action",
    icon: Zap,
    className: "border-success/40 bg-success/10 text-success",
  },
  {
    type: "approval",
    label: "Approval",
    icon: ShieldCheck,
    className: "border-border bg-surface-inner text-foreground",
  },
  {
    type: "delay",
    label: "Delay",
    icon: Hourglass,
    className: "border-primary/25 bg-muted/40 text-muted-foreground",
  },
  {
    type: "subworkflow",
    label: "Sub-workflow",
    icon: GitMerge,
    className: "border-border bg-card text-muted-foreground",
  },
];

const SNAP = 16;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snapCoord(n: number) {
  return Math.round(n / SNAP) * SNAP;
}

export interface WorkflowVisualEditorProps {
  definition: WorkflowDefinition;
  onChange: (next: WorkflowDefinition) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  validationErrors?: string[];
  readOnly?: boolean;
  /** Hide built-in palette (use external `WorkflowLibraryPanel`). */
  hidePalette?: boolean;
}

export function WorkflowVisualEditor({
  definition,
  onChange,
  selectedId,
  onSelect,
  validationErrors = [],
  readOnly = false,
  hidePalette = false,
}: WorkflowVisualEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  const updateNodes = useCallback(
    (updater: (prev: WorkflowNode[]) => WorkflowNode[]) => {
      const prev = Array.isArray(definition.nodes) ? definition.nodes : [];
      onChange({ ...definition, nodes: updater(prev) });
    },
    [definition, onChange],
  );

  const addNode = useCallback(
    (
      type: WorkflowNodeType,
      clientX: number,
      clientY: number,
      presetConfig?: Record<string, unknown>,
      labelFromLibrary?: string,
    ) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = snapCoord(
        clamp(clientX - rect.left - 80, 8, rect.width - 160),
      );
      const y = snapCoord(
        clamp(clientY - rect.top - 32, 8, rect.height - 80),
      );
      const id = crypto.randomUUID();
      const trimmed = labelFromLibrary?.trim();
      const label =
        trimmed && trimmed.length > 0
          ? trimmed
          : NODE_TYPES.find((n) => n.type === type)?.label ?? type;
      const baseConfig =
        presetConfig && typeof presetConfig === "object" ? presetConfig : {};
      const node: WorkflowNode = {
        id,
        type,
        label,
        config: { ...baseConfig },
        next: [],
        position: { x, y },
      };
      updateNodes((list) => [...list, node]);
      onSelect(id);
    },
    [onSelect, updateNodes],
  );

  const onCanvasDrop = (e: DragEvent<HTMLDivElement>) => {
    if (readOnly) return;
    e.preventDefault();
    const moveId = e.dataTransfer.getData(WORKFLOW_DND_MOVE_ID);
    if (moveId) {
      moveNode(moveId, e.clientX, e.clientY);
      return;
    }
    const type = e.dataTransfer.getData(WORKFLOW_DND_NODE_TYPE) as WorkflowNodeType;
    if (!type) return;
    const dndLabel = e.dataTransfer.getData(WORKFLOW_DND_NODE_LABEL);
    let preset: Record<string, unknown> | undefined;
    try {
      const raw = e.dataTransfer.getData(WORKFLOW_DND_PRESET);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          preset = parsed as Record<string, unknown>;
        }
      }
    } catch {
      preset = undefined;
    }
    addNode(
      type,
      e.clientX,
      e.clientY,
      preset,
      dndLabel || undefined,
    );
  };

  const moveNode = (id: string, clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el || readOnly) return;
    const rect = el.getBoundingClientRect();
    const x = snapCoord(
      clamp(clientX - rect.left - 80, 8, rect.width - 160),
    );
    const y = snapCoord(
      clamp(clientY - rect.top - 32, 8, rect.height - 80),
    );
    updateNodes((list) =>
      list.map((n) =>
        n.id === id ? { ...n, position: { x, y } } : n,
      ),
    );
  };

  const toggleNext = (fromId: string, targetId: string, checked: boolean) => {
    if (readOnly) return;
    updateNodes((list) =>
      list.map((n) => {
        if (n.id !== fromId) return n;
        const cur = Array.isArray(n.next) ? n.next : [];
        const set = new Set(cur);
        if (checked) set.add(targetId);
        else set.delete(targetId);
        return { ...n, next: [...set] };
      }),
    );
  };

  const removeNode = (id: string) => {
    if (readOnly) return;
    updateNodes((list) =>
      list
        .filter((n) => n.id !== id)
        .map((n) => ({
          ...n,
          next: (Array.isArray(n.next) ? n.next : []).filter((x) => x !== id),
        })),
    );
    if (selectedId === id) onSelect(null);
  };

  const updateSelected = (patch: Partial<WorkflowNode>) => {
    if (!selectedId || readOnly) return;
    updateNodes((list) =>
      list.map((n) => (n.id === selectedId ? { ...n, ...patch } : n)),
    );
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {!hidePalette ? (
        <div className="lg:w-52 shrink-0 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Palette
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {(NODE_TYPES ?? []).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={`${item.type}-${item.label}`}
                  type="button"
                  draggable={!readOnly}
                  aria-label={`Drag ${item.label} onto canvas`}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(WORKFLOW_DND_NODE_TYPE, item.type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all duration-150",
                    "hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    item.className,
                    readOnly && "pointer-events-none opacity-50",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Drag nodes onto the canvas. Select a node to wire outputs and edit
            properties.
          </p>
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-3">
        {(validationErrors ?? []).length > 0 ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground"
          >
            <p className="font-semibold">Validation</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {(validationErrors ?? []).map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          ref={canvasRef}
          role="application"
          aria-label="Workflow canvas"
          onDragOver={(e) => {
            e.preventDefault();
            const types = Array.from(e.dataTransfer.types ?? []);
            e.dataTransfer.dropEffect = types.includes(WORKFLOW_DND_MOVE_ID)
              ? "move"
              : "copy";
          }}
          onDrop={onCanvasDrop}
          className={cn(
            "grid-bg relative min-h-[380px] overflow-hidden rounded-2xl border border-border/80 bg-surface-inner/50 shadow-card",
            "transition-all duration-150 hover:shadow-card-hover",
          )}
        >
          {(nodes ?? []).map((node) => {
            const pos = node.position ?? { x: 16, y: 16 };
            const active = node.id === selectedId;
            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${node.type} node ${node.label ?? node.id}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(node.id);
                  }
                }}
                draggable={!readOnly}
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData(WORKFLOW_DND_MOVE_ID, node.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => onSelect(node.id)}
                style={{ left: pos.x, top: pos.y }}
                className={cn(
                  "absolute w-44 cursor-grab rounded-xl border px-3 py-2 text-left text-xs shadow-md transition-all duration-150 active:cursor-grabbing",
                  "hover:-translate-y-1 hover:shadow-card-hover",
                  active
                    ? "border-primary/60 bg-card ring-2 ring-primary/25"
                    : "border-border/80 bg-card/90",
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {node.type}
                </p>
                <p className="mt-1 font-medium text-foreground">
                  {node.label ?? node.id.slice(0, 8)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-primary/90">
                  →{" "}
                  {(Array.isArray(node.next) ? node.next : []).length > 0
                    ? (node.next ?? []).join(", ")
                    : "—"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full shrink-0 space-y-3 lg:w-80">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Properties
        </p>
        <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-card">
          {selected ? (
            <ScrollArea className="max-h-[420px] pr-3">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wf-label">Display name</Label>
                  <Input
                    id="wf-label"
                    value={selected.label ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateSelected({ label: e.target.value })
                    }
                    className="bg-input border-border/60"
                  />
                </div>
                {selected.type === "approval" ? (
                  <div className="space-y-2">
                    <Label htmlFor="sla-hours">SLA (hours until due)</Label>
                    <Input
                      id="sla-hours"
                      type="number"
                      min={1}
                      max={720}
                      disabled={readOnly}
                      value={Number(
                        typeof selected.config?.dueByHours === "number"
                          ? selected.config.dueByHours
                          : 24,
                      )}
                      onChange={(e) => {
                        const dueByHours = Math.min(
                          720,
                          Math.max(1, Number(e.target.value) || 24),
                        );
                        updateSelected({
                          config: {
                            ...(selected.config ?? {}),
                            dueByHours,
                          },
                        });
                      }}
                      className="bg-input border-border/60"
                    />
                    <Label htmlFor="approver-ids">
                      Approver user IDs (comma-separated)
                    </Label>
                    <Input
                      id="approver-ids"
                      disabled={readOnly}
                      value={
                        Array.isArray(selected.config?.approverUserIds)
                          ? (selected.config.approverUserIds as string[]).join(
                              ", ",
                            )
                          : ""
                      }
                      onChange={(e) => {
                        const approverUserIds = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        updateSelected({
                          config: {
                            ...(selected.config ?? {}),
                            approverUserIds,
                          },
                        });
                      }}
                      placeholder="uuid, uuid…"
                      className="bg-input border-border/60 font-mono text-xs"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Outputs (next steps)</Label>
                  <div className="space-y-2 rounded-lg border border-border/60 bg-surface-inner/80 p-2">
                    {(nodes ?? [])
                      .filter((n) => n.id !== selected.id)
                      .map((n) => {
                        const checked = (selected.next ?? []).includes(n.id);
                        return (
                          <label
                            key={n.id}
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={readOnly}
                              onCheckedChange={(v) =>
                                toggleNext(
                                  selected.id,
                                  n.id,
                                  Boolean(v),
                                )
                              }
                              aria-label={`Connect to ${n.label ?? n.id}`}
                            />
                            <span className="text-foreground">
                              {n.label ?? n.id.slice(0, 8)}{" "}
                              <span className="text-muted-foreground">
                                ({n.type})
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    {(nodes ?? []).filter((n) => n.id !== selected.id).length ===
                    0 ? (
                      <p className="text-xs text-muted-foreground">
                        Add another node to create connections.
                      </p>
                    ) : null}
                  </div>
                </div>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => removeNode(selected.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove node
                  </Button>
                ) : null}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a node on the canvas to edit wiring and labels.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-border/60 bg-surface-inner/40 p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <ArrowDown className="h-4 w-4 text-primary" />
            Graph rules
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>At least one trigger; all nodes must be reachable from a trigger.</li>
            <li>Cycles and broken links are blocked before save or run.</li>
            <li>Approvals pause the run until a decision is recorded.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
