import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  FlaskConical,
  Play,
  Save,
  ScrollText,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { WorkflowRunsChart } from "@/components/workflows/workflow-runs-chart";
import { WorkflowVisualEditor } from "@/components/workflows/workflow-visual-editor";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import {
  useApprovalsQuery,
  useWorkflowDetail,
  useWorkflowMutations,
  useWorkflowRunsQuery,
} from "@/hooks/use-workflows";
import { isSupabaseConfigured } from "@/lib/supabase";
import { parseRunLogs } from "@/api/workflows";
import type {
  WorkflowDefinition,
  WorkflowRunRow,
} from "@/types/workflows";
import { cn } from "@/lib/utils";

function canMutateWorkflows(roles: string[] | null | undefined): boolean {
  const r = Array.isArray(roles) ? roles : [];
  return r.some((x) =>
    ["admin", "owner", "manager", "builder"].includes(String(x).toLowerCase()),
  );
}

export default function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const roles = profile?.roles ?? [];
  const allowWrite = canMutateWorkflows(roles);

  const { data: wf, isLoading } = useWorkflowDetail(workflowId);
  const {
    updateWorkflow,
    runWorkflow,
    submitApproval,
    validateDefinition,
  } = useWorkflowMutations();

  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [definition, setDefinition] = useState<WorkflowDefinition>({
    nodes: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [logRun, setLogRun] = useState<WorkflowRunRow | null>(null);

  useEffect(() => {
    if (!wf) return;
    setName(wf.name ?? "");
    setStatus((wf.status ?? "draft").toLowerCase());
    const def = wf.definition;
    if (def && typeof def === "object" && "nodes" in def) {
      setDefinition(def as WorkflowDefinition);
    }
  }, [wf?.id, wf?.updated_at, wf]);

  const { data: runs = [], refetch: refetchRuns } = useWorkflowRunsQuery({
    workflowId,
    limit: 40,
    enabled: Boolean(workflowId),
  });

  const { data: pendingApprovals = [], refetch: refetchApprovals } =
    useApprovalsQuery({
      decision: "pending",
      enabled: Boolean(workflowId),
    });

  const runsForWorkflow = useMemo(() => {
    const list = Array.isArray(runs) ? runs : [];
    if (!workflowId) return list;
    return list.filter((r) => r.workflow_id === workflowId);
  }, [runs, workflowId]);

  const pendingForThis = useMemo(() => {
    const ids = new Set((runsForWorkflow ?? []).map((r) => r.id));
    return (pendingApprovals ?? []).filter((a) => ids.has(a.run_id));
  }, [pendingApprovals, runsForWorkflow]);

  const validateLocal = useCallback(async () => {
    const res = await validateDefinition(definition);
    const errs = res && !res.valid && Array.isArray(res.errors) ? res.errors : [];
    setValidationErrors(errs);
    return res?.valid === true;
  }, [definition, validateDefinition]);

  const handleSave = async () => {
    if (!workflowId || !allowWrite) return;
    const ok = await validateLocal();
    if (!ok) {
      toast.error("Fix graph validation errors before saving");
      return;
    }
    const updated = await updateWorkflow.mutateAsync({
      id: workflowId,
      name,
      definition,
      status,
    });
    if (updated) {
      toast.success("Workflow saved");
      setValidationErrors([]);
    } else {
      toast.error("Could not save workflow");
    }
  };

  const handleRun = async (testMode: boolean) => {
    if (!workflowId || !allowWrite) return;
    const ok = await validateLocal();
    if (!ok) {
      toast.error("Fix validation errors before running");
      return;
    }
    toast.loading(testMode ? "Simulating test run…" : "Starting run…");
    const run = await runWorkflow.mutateAsync({ workflowId, testMode });
    toast.dismiss();
    if (run) {
      toast.success(`Run ${run.status}`);
      void refetchRuns();
      void refetchApprovals();
    } else {
      toast.error("Run failed to start");
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <AnimatedPage className="space-y-6">
        <PageHeader
          title="Workflow detail"
          description="Configure Supabase to load and edit workflow definitions."
        />
        <div className="rounded-xl border border-border/80 bg-card/90 p-6 text-sm text-muted-foreground">
          Set <code className="text-primary">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-primary">VITE_SUPABASE_ANON_KEY</code>, deploy the{" "}
          <code className="text-primary">workflows-api</code> Edge Function, then
          refresh this page.
        </div>
      </AnimatedPage>
    );
  }

  if (isLoading || !wf) {
    return (
      <AnimatedPage className="space-y-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard/workflows" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All workflows
          </Link>
        </Button>
        <Badge variant="outline" className="border-primary/30 text-primary">
          Tenant-scoped
        </Badge>
      </div>

      <PageHeader
        title={name || "Untitled workflow"}
        description="Visual editor, execution history, approvals, and scheduling policies."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!allowWrite || updateWorkflow.isPending}
              onClick={() => void handleSave()}
            >
              <Save className="mr-1 h-4 w-4" />
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!allowWrite || runWorkflow.isPending}
              onClick={() => void handleRun(true)}
            >
              <FlaskConical className="mr-1 h-4 w-4" />
              Test run
            </Button>
            <Button
              type="button"
              variant="cta"
              size="sm"
              disabled={!allowWrite || runWorkflow.isPending}
              onClick={() => void handleRun(false)}
            >
              <Play className="mr-1 h-4 w-4" />
              Run now
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Name</Label>
              <Input
                id="wf-name"
                value={name}
                disabled={!allowWrite}
                onChange={(e) => setName(e.target.value)}
                className="bg-input border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                disabled={!allowWrite}
                onValueChange={(v) => setStatus(v)}
              >
                <SelectTrigger className="bg-input border-border/60">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="editor" className="space-y-4">
            <TabsList className="bg-surface-inner">
              <TabsTrigger value="editor">Canvas</TabsTrigger>
              <TabsTrigger value="runs">Runs</TabsTrigger>
              <TabsTrigger value="policies">Schedule & retries</TabsTrigger>
            </TabsList>
            <TabsContent value="editor" className="space-y-4">
              <WorkflowVisualEditor
                definition={definition}
                onChange={setDefinition}
                selectedId={selectedId}
                onSelect={setSelectedId}
                validationErrors={validationErrors}
                readOnly={!allowWrite}
              />
            </TabsContent>
            <TabsContent value="runs" className="space-y-4">
              <WorkflowRunsChart runs={runsForWorkflow} />
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card/90 shadow-card">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 hover:bg-transparent">
                      <TableHead>Run</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>When</TableHead>
                      <TableHead className="text-right">Logs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(runsForWorkflow ?? []).map((r) => (
                      <TableRow key={r.id} className="border-border/60">
                        <TableCell className="font-mono text-xs text-primary">
                          {r.id.slice(0, 8)}…
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              r.status === "Completed" && "bg-success/15 text-success",
                              r.status === "Failed" && "bg-destructive/15 text-destructive",
                              r.status === "Running" && "bg-primary/15 text-primary",
                              r.status === "WaitingApproval" &&
                                "bg-secondary/20 text-secondary-foreground",
                            )}
                          >
                            {r.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.test_mode ? "Test" : "Live"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.created_at), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setLogRun(r)}
                            aria-label="View run logs"
                          >
                            <ScrollText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(runsForWorkflow ?? []).length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    No executions yet. Use Test run or Run now from the header.
                  </p>
                ) : null}
              </div>
            </TabsContent>
            <TabsContent value="policies" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cron">Cron expression</Label>
                  <Input
                    id="cron"
                    disabled={!allowWrite}
                    value={definition.schedule?.cronExpression ?? ""}
                    onChange={(e) =>
                      setDefinition({
                        ...definition,
                        schedule: {
                          ...definition.schedule,
                          cronExpression: e.target.value,
                          timezone: definition.schedule?.timezone ?? "UTC",
                        },
                      })
                    }
                    placeholder="0 9 * * 1-5"
                    className="bg-input border-border/60 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tz">Timezone</Label>
                  <Input
                    id="tz"
                    disabled={!allowWrite}
                    value={definition.schedule?.timezone ?? "UTC"}
                    onChange={(e) =>
                      setDefinition({
                        ...definition,
                        schedule: {
                          ...definition.schedule,
                          timezone: e.target.value,
                          cronExpression:
                            definition.schedule?.cronExpression ?? "",
                        },
                      })
                    }
                    className="bg-input border-border/60"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="retries">Max retries</Label>
                  <Input
                    id="retries"
                    type="number"
                    min={0}
                    max={20}
                    disabled={!allowWrite}
                    value={definition.policies?.maxRetries ?? 3}
                    onChange={(e) =>
                      setDefinition({
                        ...definition,
                        policies: {
                          ...definition.policies,
                          maxRetries: Number(e.target.value),
                          backoffMs: definition.policies?.backoffMs ?? 2000,
                          alertOnFailure:
                            definition.policies?.alertOnFailure ?? true,
                        },
                      })
                    }
                    className="bg-input border-border/60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backoff">Backoff (ms)</Label>
                  <Input
                    id="backoff"
                    type="number"
                    min={0}
                    disabled={!allowWrite}
                    value={definition.policies?.backoffMs ?? 2000}
                    onChange={(e) =>
                      setDefinition({
                        ...definition,
                        policies: {
                          ...definition.policies,
                          backoffMs: Number(e.target.value),
                          maxRetries: definition.policies?.maxRetries ?? 3,
                          alertOnFailure:
                            definition.policies?.alertOnFailure ?? true,
                        },
                      })
                    }
                    className="bg-input border-border/60"
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <Switch
                    id="alert"
                    disabled={!allowWrite}
                    checked={definition.policies?.alertOnFailure !== false}
                    onCheckedChange={(v) =>
                      setDefinition({
                        ...definition,
                        policies: {
                          ...definition.policies,
                          alertOnFailure: Boolean(v),
                          maxRetries: definition.policies?.maxRetries ?? 3,
                          backoffMs: definition.policies?.backoffMs ?? 2000,
                        },
                      })
                    }
                  />
                  <Label htmlFor="alert" className="text-sm font-normal">
                    Alert on failure
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Scheduler and retry workers read these fields from{" "}
                <code className="rounded bg-surface-inner px-1">definition</code>{" "}
                JSON; Edge execution simulates steps immediately for manual runs.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-card">
            <p className="text-sm font-semibold text-foreground">
              Pending approvals
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs pause at approval nodes until a permitted role decides.
            </p>
            <div className="mt-4 space-y-3">
              {(pendingForThis ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">None right now.</p>
              ) : null}
              {(pendingForThis ?? []).map((a) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-border/60 bg-surface-inner/80 p-3 text-xs"
                >
                  <p className="font-mono text-primary">
                    Run {a.run_id.slice(0, 8)}…
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Step: {a.step_id ?? "—"}
                  </p>
                  {allowWrite ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="cta"
                        className="h-8 flex-1"
                        disabled={submitApproval.isPending}
                        onClick={async () => {
                          const res = await submitApproval.mutateAsync({
                            runId: a.run_id,
                            decision: "approved",
                          });
                          if (res) {
                            toast.success("Approved");
                            void refetchRuns();
                            void refetchApprovals();
                          } else toast.error("Approval failed");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1"
                        disabled={submitApproval.isPending}
                        onClick={async () => {
                          const res = await submitApproval.mutateAsync({
                            runId: a.run_id,
                            decision: "rejected",
                          });
                          if (res) {
                            toast.success("Rejected");
                            void refetchRuns();
                            void refetchApprovals();
                          } else toast.error("Update failed");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Read-only: elevated role required to decide.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-border/60 bg-surface-inner/40 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Audit</p>
            <p className="mt-2">
              Saves, runs, and approvals write to the tenant activity log with
              related entity IDs for traceability.
            </p>
            <Button
              type="button"
              variant="link"
              className="mt-2 h-auto p-0 text-primary"
              onClick={() => navigate("/dashboard/activity")}
            >
              Open activity log →
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(logRun)} onOpenChange={() => setLogRun(null)}>
        <DialogContent className="max-w-lg border-border/80 bg-card">
          <DialogHeader>
            <DialogTitle>Run log</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80 pr-3">
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
              {JSON.stringify(parseRunLogs(logRun), null, 2)}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
