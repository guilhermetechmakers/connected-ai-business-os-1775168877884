import { Play, Workflow } from "lucide-react";
import { useMemo, useState } from "react";

import { TaskBoard } from "@/components/unified-data/task-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WorkflowRow } from "@/types/workflows";
import type { UnifiedEntity } from "@/types/unified";
import { payloadString } from "@/types/unified";

export type TasksWorkflowsPanelProps = {
  tasks: UnifiedEntity[];
  workflows: WorkflowRow[];
  workflowsLoading?: boolean;
  onTestWorkflow: (workflowId: string) => void;
  isTestRunning?: boolean;
  className?: string;
};

export function TasksWorkflowsPanel({
  tasks,
  workflows,
  workflowsLoading,
  onTestWorkflow,
  isTestRunning,
  className,
}: TasksWorkflowsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeQ, setAssigneeQ] = useState("");
  const [dueQ, setDueQ] = useState("");

  const taskList = Array.isArray(tasks) ? tasks : [];
  const wfList = Array.isArray(workflows) ? workflows : [];

  const filteredTasks = useMemo(() => {
    const aq = assigneeQ.trim().toLowerCase();
    const dq = dueQ.trim().toLowerCase();
    return taskList.filter((t) => {
      const st = (payloadString(t.payload, "status") ?? "open").toLowerCase();
      if (statusFilter !== "all" && st !== statusFilter.toLowerCase()) return false;
      if (aq) {
        const asg = (payloadString(t.payload, "assigneeId") ?? "").toLowerCase();
        if (!asg.includes(aq)) return false;
      }
      if (dq) {
        const due = (payloadString(t.payload, "dueDate") ?? "").toLowerCase();
        if (!due.includes(dq)) return false;
      }
      return true;
    });
  }, [taskList, statusFilter, assigneeQ, dueQ]);

  return (
    <div className={cn("space-y-6", className)}>
      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <p className="text-sm text-muted-foreground">
            Status, assignee id substring, and due date substring — all client-side on unified tasks.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tw-status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="tw-status" aria-label="Filter by task status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in progress">In progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tw-assignee">Assignee contains</Label>
            <Input
              id="tw-assignee"
              value={assigneeQ}
              onChange={(e) => setAssigneeQ(e.target.value)}
              placeholder="User id fragment"
              className="bg-surface-inner"
              aria-label="Filter tasks by assignee id substring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tw-due">Due date contains</Label>
            <Input
              id="tw-due"
              value={dueQ}
              onChange={(e) => setDueQ(e.target.value)}
              placeholder="e.g. 2026-04"
              className="bg-surface-inner"
              aria-label="Filter tasks by due date substring"
            />
          </div>
        </CardContent>
      </Card>

      <TaskBoard tasks={filteredTasks} isLoading={false} />

      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="h-5 w-5 text-primary" aria-hidden />
            Automations (workflows engine)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tenant workflows scoped to this department (or global). Test runs are isolated and audited.
          </p>
        </CardHeader>
        <CardContent>
          {workflowsLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading workflows">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : wfList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workflows in scope. Create one from the header shortcut.
            </p>
          ) : (
            <ul className="space-y-3">
              {wfList.map((w) => {
                const def = w.definition && typeof w.definition === "object" ? w.definition : {};
                const schedule =
                  "schedule" in def && def.schedule && typeof def.schedule === "object"
                    ? (def.schedule as { cronExpression?: string }).cronExpression
                    : undefined;
                return (
                  <li
                    key={w.id}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface-inner/70 p-4 transition-all duration-150 hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{w.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{w.status}</Badge>
                        {schedule ? <span>Cron: {schedule || "—"}</span> : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-2 shrink-0"
                      disabled={isTestRunning}
                      onClick={() => onTestWorkflow(w.id)}
                      aria-label={`Test run workflow ${w.name}`}
                    >
                      <Play className="h-4 w-4" aria-hidden />
                      Test run
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
