import { ExternalLink, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { WorkflowAiInsightsPanel } from "@/components/workflows/workflow-ai-insights-panel";
import { WorkflowExecutionPanel } from "@/components/workflows/workflow-execution-panel";
import { WorkflowLibraryPanel } from "@/components/workflows/workflow-library-panel";
import { WorkflowVisualEditor } from "@/components/workflows/workflow-visual-editor";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWorkflowDetail,
  useWorkflowMutations,
  useWorkflowRunsQuery,
} from "@/hooks/use-workflows";
import type {
  WorkflowDefinition,
  WorkflowLibraryTemplate,
  WorkflowRow,
} from "@/types/workflows";

export type DepartmentWorkflowStudioProps = {
  departmentId: string;
  workflows: WorkflowRow[];
  workflowsLoading?: boolean;
  allowWrite: boolean;
};

export function DepartmentWorkflowStudio({
  departmentId,
  workflows,
  workflowsLoading,
  allowWrite,
}: DepartmentWorkflowStudioProps) {
  const wfList = Array.isArray(workflows) ? workflows : [];
  const [selectedId, setSelectedId] = useState<string | undefined>(
    wfList[0]?.id,
  );

  useEffect(() => {
    if (!selectedId && wfList[0]?.id) setSelectedId(wfList[0].id);
    if (selectedId && !wfList.some((w) => w.id === selectedId)) {
      setSelectedId(wfList[0]?.id);
    }
  }, [wfList, selectedId]);

  const { data: wf, isLoading: detailLoading } = useWorkflowDetail(
    selectedId,
    Boolean(selectedId),
  );

  const [definition, setDefinition] = useState<WorkflowDefinition>({
    nodes: [],
  });
  const [nodeSelectedId, setNodeSelectedId] = useState<string | null>(null);
  const [runSelectedId, setRunSelectedId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!wf?.definition || typeof wf.definition !== "object") return;
    const def = wf.definition as WorkflowDefinition;
    setDefinition(
      Array.isArray(def.nodes) ? def : { ...def, nodes: def.nodes ?? [] },
    );
    const first = Array.isArray(def.nodes) ? def.nodes[0] : undefined;
    setNodeSelectedId(first?.id ?? null);
  }, [wf?.id, wf?.updated_at, wf]);

  const {
    updateWorkflow,
    validateDefinition,
    runWorkflow,
    retryWorkflowRun,
    cancelWorkflowRun,
  } = useWorkflowMutations();

  const { data: runs = [], refetch: refetchRuns } = useWorkflowRunsQuery({
    workflowId: selectedId,
    limit: 30,
    enabled: Boolean(selectedId),
  });

  const runsForWf = useMemo(() => {
    const list = Array.isArray(runs) ? runs : [];
    if (!selectedId) return list;
    return list.filter((r) => r.workflow_id === selectedId);
  }, [runs, selectedId]);

  const failedSample = useMemo(
    () =>
      (runsForWf ?? []).filter((r) => String(r.status) === "Failed").length,
    [runsForWf],
  );

  const validateLocal = useCallback(async () => {
    const res = await validateDefinition(definition);
    const errs =
      res && !res.valid && Array.isArray(res.errors) ? res.errors : [];
    setValidationErrors(errs);
    return res?.valid === true;
  }, [definition, validateDefinition]);

  const handleSave = async () => {
    if (!selectedId || !allowWrite) return;
    const ok = await validateLocal();
    if (!ok) {
      toast.error("Fix validation errors before saving");
      return;
    }
    const updated = await updateWorkflow.mutateAsync({
      id: selectedId,
      definition,
    });
    if (updated) {
      toast.success("Workflow saved");
      setValidationErrors([]);
    } else toast.error("Save failed");
  };

  const handleQuickAdd = (item: WorkflowLibraryTemplate) => {
    if (!allowWrite) return;
    const id = crypto.randomUUID();
    const preset =
      item.preset && typeof item.preset === "object" && !Array.isArray(item.preset)
        ? (item.preset as Record<string, unknown>)
        : {};
    setDefinition((prev) => ({
      ...prev,
      nodes: [
        ...(Array.isArray(prev.nodes) ? prev.nodes : []),
        {
          id,
          type: item.type,
          label: item.label,
          config: { ...preset },
          next: [],
          position: {
            x: 80 + Math.floor(Math.random() * 60),
            y: 80 + Math.floor(Math.random() * 60),
          },
        },
      ],
    }));
    setNodeSelectedId(id);
  };

  if (workflowsLoading && wfList.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    );
  }

  if (wfList.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface-inner/40 p-8 text-center text-sm text-muted-foreground">
        <p>No workflows visible for this department.</p>
        {allowWrite ? (
          <Button variant="cta" className="mt-4" asChild>
            <Link to="/dashboard/workflows">Open workflows console</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selectedId ?? ""}
            onValueChange={(v) => setSelectedId(v)}
          >
            <SelectTrigger
              className="w-full max-w-md border-border/60 bg-input"
              aria-label="Select workflow to edit"
            >
              <SelectValue placeholder="Choose workflow" />
            </SelectTrigger>
            <SelectContent>
              {(wfList ?? []).map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="shrink-0 gap-1" asChild>
            <Link to={selectedId ? `/dashboard/workflows/${selectedId}` : "/dashboard/workflows"}>
              <ExternalLink className="h-4 w-4" />
              Full builder
            </Link>
          </Button>
        </div>
        {allowWrite ? (
          <Button
            type="button"
            variant="cta"
            size="sm"
            disabled={updateWorkflow.isPending || detailLoading}
            onClick={() => void handleSave()}
            className="gap-2"
          >
            {updateWorkflow.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save to tenant
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-3">
          <WorkflowLibraryPanel
            readOnly={!allowWrite}
            onQuickAdd={allowWrite ? handleQuickAdd : undefined}
          />
          <WorkflowAiInsightsPanel
            workflowCount={wfList.length}
            failedRuns={failedSample}
          />
        </div>
        <div className="space-y-4 xl:col-span-5">
          {detailLoading && selectedId ? (
            <Skeleton className="h-[480px] w-full rounded-2xl" />
          ) : (
            <WorkflowVisualEditor
              definition={definition}
              onChange={setDefinition}
              selectedId={nodeSelectedId}
              onSelect={setNodeSelectedId}
              validationErrors={validationErrors}
              readOnly={!allowWrite}
              hidePalette
            />
          )}
        </div>
        <div className="space-y-4 xl:col-span-4">
          <WorkflowExecutionPanel
            runs={runsForWf}
            selectedRunId={runSelectedId}
            onSelectRun={setRunSelectedId}
            allowWrite={allowWrite}
            onRetry={(runId) => {
              void retryWorkflowRun.mutateAsync(runId).then((row) => {
                if (row) {
                  toast.success("Retry started");
                  void refetchRuns();
                } else toast.error("Retry failed");
              });
            }}
            onCancel={(runId) => {
              void cancelWorkflowRun.mutateAsync(runId).then((row) => {
                if (row) {
                  toast.success("Run canceled");
                  void refetchRuns();
                } else toast.error("Cancel failed");
              });
            }}
            isRetrying={retryWorkflowRun.isPending}
            isCanceling={cancelWorkflowRun.isPending}
          />
          {allowWrite && selectedId ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={runWorkflow.isPending}
                onClick={() => {
                  void validateLocal().then((ok) => {
                    if (!ok) {
                      toast.error("Validate graph before running");
                      return;
                    }
                    void runWorkflow
                      .mutateAsync({
                        workflowId: selectedId,
                        testMode: true,
                        departmentId,
                      })
                      .then((r) => {
                        if (r) {
                          toast.success(`Run ${r.status}`);
                          void refetchRuns();
                        } else toast.error("Run failed");
                      });
                  });
                }}
              >
                Quick test run
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
