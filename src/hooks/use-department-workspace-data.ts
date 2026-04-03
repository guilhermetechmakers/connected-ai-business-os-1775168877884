import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { fetchTenantActivityLogs } from "@/api/activity-logs";
import { createDepartmentTask } from "@/api/department-workspace";
import { fetchWorkflows, runWorkflow } from "@/api/workflows";
import { unifiedQueryKeys } from "@/hooks/use-unified-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ActivityLogEntry } from "@/types/activity-log";

const DEPT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const departmentWorkspaceDataKeys = {
  activity: (departmentId: string, actorUserId?: string) =>
    ["department-workspace", "activity", departmentId, actorUserId ?? "all"] as const,
  automations: (departmentId: string) =>
    ["department-workspace", "automations", departmentId] as const,
};

export function useDepartmentActivityQuery(
  departmentId: string | undefined,
  options?: { actorUserId?: string; limit?: number },
) {
  const isValid = Boolean(departmentId && DEPT_UUID_RE.test(departmentId));
  const actorUserId = options?.actorUserId;
  const limit = options?.limit ?? 60;

  return useQuery({
    queryKey: departmentWorkspaceDataKeys.activity(departmentId ?? "", actorUserId),
    queryFn: async (): Promise<ActivityLogEntry[]> => {
      const res = await fetchTenantActivityLogs({
        departmentId,
        actorUserId,
        limit,
        offset: 0,
      });
      const entries = Array.isArray(res.entries) ? res.entries : [];
      return entries;
    },
    enabled: isValid && isSupabaseConfigured,
  });
}

export function useDepartmentAutomationsQuery(departmentId: string | undefined) {
  const isValid = Boolean(departmentId && DEPT_UUID_RE.test(departmentId));
  return useQuery({
    queryKey: departmentWorkspaceDataKeys.automations(departmentId ?? ""),
    queryFn: () => fetchWorkflows({ departmentId }),
    enabled: isValid && isSupabaseConfigured,
  });
}

export function useCreateDepartmentTaskMutation(departmentId: string | undefined) {
  const qc = useQueryClient();
  const isValid = Boolean(departmentId && DEPT_UUID_RE.test(departmentId));

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      status?: string;
      priority?: string;
    }) => {
      if (!isValid || !departmentId) {
        throw new Error("Invalid department");
      }
      const row = await createDepartmentTask({
        departmentId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
      });
      if (!row) throw new Error("Task could not be created");
      return row;
    },
    onSuccess: async () => {
      if (departmentId) {
        await qc.invalidateQueries({
          queryKey: unifiedQueryKeys.department(departmentId),
        });
      }
      toast.success("Task created");
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to create task");
    },
  });
}

export function useTestDepartmentWorkflowMutation(departmentId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (workflowId: string) => {
      const run = await runWorkflow({
        workflowId,
        testMode: true,
        departmentId: departmentId ?? undefined,
      });
      if (!run) throw new Error("Workflow test run failed");
      return run;
    },
    onSuccess: async () => {
      if (departmentId) {
        await qc.invalidateQueries({
          queryKey: departmentWorkspaceDataKeys.activity(departmentId),
        });
      }
      toast.success("Workflow test run queued");
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Workflow test failed");
    },
  });
}
