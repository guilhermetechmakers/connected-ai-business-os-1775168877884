import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import {
  AIWorkspacePanel,
  DepartmentHeader,
  DepartmentMetricsDashboard,
  DepartmentWorkspaceShell,
  DocumentsPanel,
  OverviewWidgetPanel,
  TasksWorkflowsPanel,
  TeamActivityPanel,
} from "@/components/department-workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  useCreateDepartmentTaskMutation,
  useDepartmentActivityQuery,
  useDepartmentAutomationsQuery,
  useTestDepartmentWorkflowMutation,
} from "@/hooks/use-department-workspace-data";
import { useDepartmentWorkspace } from "@/hooks/use-unified-data";
import { normalizeDepartmentWorkspaceSnapshot } from "@/lib/unified-data-context-bridge";
import { mapUnifiedEntityRows, payloadTitle } from "@/types/unified";
import { useAuth } from "@/contexts/auth-context";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const newTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(240),
});

type NewTaskValues = z.infer<typeof newTaskSchema>;

export default function DepartmentWorkspacePage() {
  const { departmentId: deptParam, deptId: legacyDept } = useParams<{
    departmentId?: string;
    deptId?: string;
  }>();
  const departmentId = deptParam ?? legacyDept ?? undefined;
  const isUuid = Boolean(departmentId && UUID_RE.test(departmentId));

  const { profile } = useAuth();
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const canAssignTask = roles.some((r) =>
    ["admin", "company admin", "executive", "manager"].includes(r.toLowerCase()),
  );

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const { data: rawSnapshot, isLoading: snapLoading } = useDepartmentWorkspace(
    isUuid ? departmentId : undefined,
  );

  const snapshot = useMemo(
    () => normalizeDepartmentWorkspaceSnapshot(rawSnapshot ?? null),
    [rawSnapshot],
  );

  const { data: activityEntries = [], isLoading: actLoading } = useDepartmentActivityQuery(
    isUuid ? departmentId : undefined,
    { limit: 80 },
  );

  const { data: automations = [], isLoading: wfLoading } = useDepartmentAutomationsQuery(
    isUuid ? departmentId : undefined,
  );

  const createTask = useCreateDepartmentTaskMutation(isUuid ? departmentId : undefined);
  const testWorkflow = useTestDepartmentWorkflowMutation(isUuid ? departmentId : undefined);

  const form = useForm<NewTaskValues>({
    resolver: zodResolver(newTaskSchema),
    defaultValues: { title: "" },
  });

  const departmentName =
    snapshot.department?.name ??
    (departmentId ? departmentId.replace(/-/g, " ") : "Department");

  const kpis = useMemo(
    () => mapUnifiedEntityRows(snapshot.kpis ?? []),
    [snapshot.kpis],
  );
  const tasks = useMemo(
    () => mapUnifiedEntityRows(snapshot.tasks ?? []),
    [snapshot.tasks],
  );
  const docs = useMemo(
    () => mapUnifiedEntityRows(snapshot.documents ?? []),
    [snapshot.documents],
  );
  const workflowEntities = useMemo(
    () => mapUnifiedEntityRows(snapshot.workflows ?? []),
    [snapshot.workflows],
  );

  const leadLabel = snapshot.department?.lead_user_id
    ? `User ${snapshot.department.lead_user_id.slice(0, 8)}…`
    : undefined;

  const contextSummary = useMemo(() => {
    const chunks = [...kpis, ...tasks, ...docs, ...workflowEntities];
    return chunks
      .slice(0, 14)
      .map(
        (e) =>
          `${e.entityType}: ${payloadTitle(e.payload)} (id:${e.id.slice(0, 8)}…)`,
      )
      .join("\n");
  }, [kpis, tasks, docs, workflowEntities]);

  const wfRows = Array.isArray(automations) ? automations : [];

  function onTestWorkflow(id: string) {
    testWorkflow.mutate(id);
  }

  function onOpenTaskDialog() {
    if (!canAssignTask || !isUuid) return;
    form.reset({ title: "" });
    setTaskDialogOpen(true);
  }

  return (
    <AnimatedPage>
      <DepartmentWorkspaceShell>
        {!isUuid ? (
          <Card className="border-amber-500/30 bg-card/90">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Use a UUID department id in the URL, e.g.{" "}
              <code className="text-primary">/departments/&lt;uuid&gt;</code>, so the unified snapshot
              can load from Supabase.
            </CardContent>
          </Card>
        ) : null}

        <DepartmentHeader
          departmentName={departmentName}
          leadLabel={leadLabel}
          kpis={kpis}
          departmentId={departmentId ?? "unknown"}
          canCreateTask={canAssignTask && isUuid}
          onNewTask={() => {
            onOpenTaskDialog();
          }}
        />

        {!canAssignTask ? (
          <p className="text-xs text-muted-foreground">
            Your role cannot create tasks. Ask a manager or admin to grant mutation permissions.
          </p>
        ) : null}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex h-auto min-h-10 flex-wrap gap-1 bg-surface-inner p-1">
            {(
              [
                ["overview", "Overview"],
                ["metrics", "Metrics"],
                ["tasks", "Tasks / Workflows"],
                ["activity", "Team activity"],
                ["reports", "Reports"],
                ["documents", "Documents"],
                ["ai", "AI assistant"],
              ] as const
            ).map(([v, label]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-lg px-3 py-2 text-xs sm:text-sm"
                aria-label={`${label} tab`}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewWidgetPanel tasks={tasks} kpis={kpis} isLoading={snapLoading} />
            <div className="grid gap-6 lg:grid-cols-2">
              <TeamActivityPanel entries={activityEntries} isLoading={actLoading} />
              <AIWorkspacePanel
                departmentId={departmentId ?? "unknown"}
                departmentName={departmentName}
                contextSummary={contextSummary}
              />
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <DepartmentMetricsDashboard kpis={kpis} isLoading={snapLoading} />
            <OverviewWidgetPanel tasks={tasks} kpis={kpis} isLoading={snapLoading} />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <TasksWorkflowsPanel
              tasks={tasks}
              workflows={wfRows}
              workflowsLoading={wfLoading}
              onTestWorkflow={onTestWorkflow}
              isTestRunning={testWorkflow.isPending}
            />
          </TabsContent>

          <TabsContent value="activity">
            <TeamActivityPanel entries={activityEntries} isLoading={actLoading} />
          </TabsContent>

          <TabsContent value="reports">
            <Card className="border-border/80 bg-card/90">
              <CardHeader>
                <CardTitle>Reports</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Open the{" "}
                <Link className="text-primary underline" to="/reports">
                  Reports center
                </Link>{" "}
                for schedules and exports. Filter templates by this department when creating reports.
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsPanel documents={docs} />
          </TabsContent>

          <TabsContent value="ai">
            <AIWorkspacePanel
              departmentId={departmentId ?? "unknown"}
              departmentName={departmentName}
              contextSummary={contextSummary}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogContent className="border-border/80 bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((values) => {
                  createTask.mutate(
                    { title: values.title },
                    {
                      onSuccess: () => {
                        setTaskDialogOpen(false);
                        form.reset({ title: "" });
                      },
                    },
                  );
                })}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-surface-inner"
                          autoComplete="off"
                          aria-label="Task title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setTaskDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="cta" disabled={createTask.isPending}>
                    {createTask.isPending ? "Saving…" : "Create task"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </DepartmentWorkspaceShell>
    </AnimatedPage>
  );
}
