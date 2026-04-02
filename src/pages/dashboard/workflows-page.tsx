import { formatDistanceToNow } from "date-fns";
import {
  Loader2,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { WorkflowRunsChart } from "@/components/workflows/workflow-runs-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { useDebouncedValue } from "@/hooks/use-unified-data";
import {
  useWorkflowMutations,
  useWorkflowRunsQuery,
  useWorkflowsList,
} from "@/hooks/use-workflows";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

function canMutateWorkflows(roles: string[] | null | undefined): boolean {
  const r = Array.isArray(roles) ? roles : [];
  return r.some((x) =>
    ["admin", "owner", "manager", "builder"].includes(String(x).toLowerCase()),
  );
}

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const allowWrite = canMutateWorkflows(profile?.roles);

  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data: workflows = [], isLoading } = useWorkflowsList({
    status: statusFilter,
    search: debouncedSearch,
  });

  const { data: allRuns = [] } = useWorkflowRunsQuery({
    limit: 60,
    enabled: isSupabaseConfigured,
  });

  const { createWorkflow, deleteWorkflow, runWorkflow, createDefaultWorkflowDefinition } =
    useWorkflowMutations();

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [selected],
  );

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      (workflows ?? []).forEach((w) => {
        next[w.id] = true;
      });
    }
    setSelected(next);
  };

  const handleCreate = async () => {
    if (!allowWrite) return;
    const def = createDefaultWorkflowDefinition();
    const row = await createWorkflow.mutateAsync({
      name: "New automation",
      definition: def,
      status: "draft",
    });
    if (row?.id) {
      toast.success("Workflow created");
      navigate(`/dashboard/workflows/${row.id}`);
    } else {
      toast.error("Could not create workflow");
    }
  };

  const handleBulkDelete = async () => {
    if (!allowWrite || selectedIds.length === 0) return;
    toast.loading("Deleting…");
    for (const id of selectedIds) {
      await deleteWorkflow.mutateAsync(id);
    }
    toast.dismiss();
    toast.success("Removed workflows");
    setSelected({});
  };

  const handleQuickRun = async (workflowId: string) => {
    if (!allowWrite) return;
    const run = await runWorkflow.mutateAsync({
      workflowId,
      testMode: true,
    });
    if (run) toast.success(`Test run ${run.status}`);
    else toast.error("Run failed");
  };

  if (!isSupabaseConfigured) {
    return (
      <AnimatedPage className="space-y-8">
        <PageHeader
          title="Workflows & automations"
          description="Connect Supabase and deploy the workflows-api Edge Function to enable the visual builder and execution engine."
        />
        <div className="rounded-xl border border-border/80 bg-card/90 p-6 text-sm text-muted-foreground">
          This console requires environment variables{" "}
          <code className="text-primary">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-primary">VITE_SUPABASE_ANON_KEY</code>. Apply
          migration <code className="text-primary">20260402203000_workflow_engine_extensions.sql</code>{" "}
          and deploy <code className="text-primary">workflows-api</code>.
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Workflows & automations"
        description="Drag-and-drop canvas, validation, test runs, scheduling policies, and human approvals — all tenant-isolated."
        actions={
          <Button
            variant="cta"
            type="button"
            disabled={!allowWrite || createWorkflow.isPending}
            onClick={() => void handleCreate()}
          >
            {createWorkflow.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New workflow
          </Button>
        }
      />

      <Tabs defaultValue="library" className="space-y-6">
        <TabsList className="bg-surface-inner">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="metrics">Run health</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workflows…"
                className="bg-input border-border/60 pl-9"
                aria-label="Search workflows"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter ?? "all"}
                onValueChange={(v) =>
                  setStatusFilter(v === "all" ? undefined : v)
                }
              >
                <SelectTrigger className="w-[160px] bg-input border-border/60">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
              {allowWrite ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.length === 0 || deleteWorkflow.isPending}
                  onClick={() => void handleBulkDelete()}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete selected
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/90 shadow-card">
            {isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    {allowWrite ? (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            (workflows ?? []).length > 0 &&
                            selectedIds.length === (workflows ?? []).length
                          }
                          onCheckedChange={(v) => toggleAll(v === true)}
                          aria-label="Select all workflows"
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(workflows ?? []).map((w) => (
                    <TableRow key={w.id} className="border-border/60">
                      {allowWrite ? (
                        <TableCell>
                          <Checkbox
                            checked={Boolean(selected[w.id])}
                            onCheckedChange={(v) =>
                              setSelected((prev) => ({
                                ...prev,
                                [w.id]: v === true,
                              }))
                            }
                            aria-label={`Select ${w.name}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Link
                          to={`/dashboard/workflows/${w.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {w.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {Array.isArray(
                            (w.definition as { nodes?: unknown })?.nodes,
                          )
                            ? `${(w.definition as { nodes: unknown[] }).nodes.length} nodes`
                            : "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            w.status === "active" && "border-success/40 text-success",
                            w.status === "paused" && "border-secondary/50",
                          )}
                        >
                          {w.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(w.updated_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link to={`/dashboard/workflows/${w.id}`}>
                              Edit
                            </Link>
                          </Button>
                          {allowWrite ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleQuickRun(w.id)}
                              disabled={runWorkflow.isPending}
                              aria-label="Test run workflow"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!isLoading && (workflows ?? []).length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No workflows match your filters. Create one to start automating
                cross-system work.
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <WorkflowRunsChart runs={Array.isArray(allRuns) ? allRuns : []} />
          <p className="text-xs text-muted-foreground">
            Aggregated from recent runs across all workflows in this tenant.
          </p>
        </TabsContent>

        <TabsContent value="approvals">
          <div className="rounded-xl border border-border/80 bg-card/90 p-6 shadow-card">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Human-in-the-loop gates
                </p>
                <p>
                  Approval nodes pause execution, enqueue a{" "}
                  <code className="rounded bg-surface-inner px-1">
                    workflow_approvals
                  </code>{" "}
                  row, and resume only after an authorized role approves or
                  rejects from the workflow detail screen.
                </p>
                <Button variant="link" className="h-auto p-0 text-primary" asChild>
                  <Link to="/dashboard/activity">Review audit trail →</Link>
                </Button>
              </div>
            </div>
            <ScrollArea className="mt-6 h-40 pr-3 text-xs text-muted-foreground">
              Retries, backoff, and alert flags live on each definition&apos;s{" "}
              <code className="text-primary">policies</code> object and are
              honored by the execution worker; manual runs execute immediately
              inside the Edge Function for feedback.
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
}
