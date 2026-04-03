import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  appendWorkflowRunLogs,
  cancelWorkflowRun,
  createDefaultWorkflowDefinition,
  createWorkflow,
  deleteWorkflow,
  fetchActivityLog,
  fetchApprovals,
  fetchWorkflow,
  fetchWorkflowLibrary,
  fetchWorkflowRun,
  fetchWorkflowRuns,
  fetchWorkflows,
  retryWorkflowRun,
  runWorkflow,
  scheduleWorkflow,
  submitApproval,
  updateWorkflow,
  validateWorkflowDefinition,
} from "@/api/workflows";
import { WORKFLOW_LIBRARY_FALLBACK } from "@/lib/workflow-library-fallback";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { WorkflowDefinition } from "@/types/workflows";

export const workflowQueryKeys = {
  root: ["workflows-engine"] as const,
  library: () => [...workflowQueryKeys.root, "library"] as const,
  list: (filters: {
    status?: string;
    search?: string;
    departmentId?: string;
  }) => [...workflowQueryKeys.root, "list", filters] as const,
  detail: (id: string) => [...workflowQueryKeys.root, "detail", id] as const,
  runs: (workflowId: string | undefined, extra: Record<string, string | undefined>) =>
    [...workflowQueryKeys.root, "runs", workflowId ?? "all", extra] as const,
  run: (runId: string) => [...workflowQueryKeys.root, "run", runId] as const,
  activity: (filters: Record<string, string | undefined>) =>
    [...workflowQueryKeys.root, "activity", filters] as const,
  approvals: (filters: Record<string, string | undefined>) =>
    [...workflowQueryKeys.root, "approvals", filters] as const,
};

export function useWorkflowsList(params: {
  status?: string;
  search?: string;
  departmentId?: string;
  enabled?: boolean;
}) {
  const { enabled = true, status, search, departmentId } = params;
  const filters = { status, search, departmentId };
  return useQuery({
    queryKey: workflowQueryKeys.list(filters),
    queryFn: () => fetchWorkflows({ status, search, departmentId }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useWorkflowDetail(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowQueryKeys.detail(id ?? ""),
    queryFn: () => fetchWorkflow(id ?? ""),
    enabled: Boolean(id) && enabled && isSupabaseConfigured,
  });
}

export function useWorkflowRunsQuery(params: {
  workflowId?: string;
  status?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const { enabled = true, workflowId, status, limit } = params;
  const extra = { s: status, l: limit !== undefined ? String(limit) : undefined };
  return useQuery({
    queryKey: workflowQueryKeys.runs(workflowId, extra),
    queryFn: () =>
      fetchWorkflowRuns({
        workflowId,
        status,
        limit,
      }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useWorkflowRunDetail(runId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: workflowQueryKeys.run(runId ?? ""),
    queryFn: () => fetchWorkflowRun(runId ?? ""),
    enabled: Boolean(runId) && enabled && isSupabaseConfigured,
  });
}

export function useActivityLogQuery(params: {
  actionType?: string;
  departmentId?: string;
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const {
    enabled = true,
    actionType,
    departmentId,
    userId,
    from,
    to,
    limit,
    offset,
  } = params;
  const filters = {
    a: actionType,
    d: departmentId,
    u: userId,
    f: from,
    t: to,
    l: limit !== undefined ? String(limit) : undefined,
    o: offset !== undefined ? String(offset) : undefined,
  };
  return useQuery({
    queryKey: workflowQueryKeys.activity(filters),
    queryFn: () =>
      fetchActivityLog({
        actionType,
        departmentId,
        userId,
        from,
        to,
        limit,
        offset,
      }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useWorkflowLibraryQuery(enabled = true) {
  return useQuery({
    queryKey: workflowQueryKeys.library(),
    queryFn: async () => {
      const res = await fetchWorkflowLibrary();
      return res ?? WORKFLOW_LIBRARY_FALLBACK;
    },
    enabled,
  });
}

export function useApprovalsQuery(params: {
  runId?: string;
  decision?: string;
  enabled?: boolean;
}) {
  const { enabled = true, runId, decision } = params;
  const filters = { r: runId, d: decision };
  return useQuery({
    queryKey: workflowQueryKeys.approvals(filters),
    queryFn: () => fetchApprovals({ runId, decision }),
    enabled: enabled && isSupabaseConfigured,
  });
}

export function useWorkflowMutations() {
  const qc = useQueryClient();

  const invalidateAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: workflowQueryKeys.root });
  }, [qc]);

  const createMut = useMutation({
    mutationFn: (payload: {
      name: string;
      definition: WorkflowDefinition;
      status?: string;
      departmentId?: string | null;
    }) => createWorkflow(payload),
    onSuccess: () => invalidateAll(),
  });

  const updateMut = useMutation({
    mutationFn: (payload: {
      id: string;
      name?: string;
      definition?: WorkflowDefinition;
      status?: string;
      departmentId?: string | null;
    }) => updateWorkflow(payload),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: workflowQueryKeys.detail(v.id) });
      invalidateAll();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWorkflow(id),
    onSuccess: () => invalidateAll(),
  });

  const runMut = useMutation({
    mutationFn: (payload: {
      workflowId: string;
      testMode?: boolean;
      correlationId?: string;
      departmentId?: string;
      inputPayload?: Record<string, unknown>;
    }) => runWorkflow(payload),
    onSuccess: (data) => {
      if (data?.workflow_id) {
        void qc.invalidateQueries({
          queryKey: workflowQueryKeys.runs(data.workflow_id, {}),
        });
      }
      invalidateAll();
    },
  });

  const scheduleMut = useMutation({
    mutationFn: (payload: {
      workflowId: string;
      cronExpression?: string;
      timezone?: string;
    }) => scheduleWorkflow(payload),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: workflowQueryKeys.detail(v.workflowId) });
      invalidateAll();
    },
  });

  const retryRunMut = useMutation({
    mutationFn: (runId: string) => retryWorkflowRun(runId),
    onSuccess: (data) => {
      if (data?.workflow_id) {
        void qc.invalidateQueries({
          queryKey: workflowQueryKeys.runs(data.workflow_id, {}),
        });
      }
      invalidateAll();
    },
  });

  const cancelRunMut = useMutation({
    mutationFn: (runId: string) => cancelWorkflowRun(runId),
    onSuccess: (data) => {
      if (data?.workflow_id) {
        void qc.invalidateQueries({
          queryKey: workflowQueryKeys.runs(data.workflow_id, {}),
        });
      }
      invalidateAll();
    },
  });

  const appendLogsMut = useMutation({
    mutationFn: (payload: { runId: string; entries: Record<string, unknown>[] }) =>
      appendWorkflowRunLogs(payload.runId, payload.entries),
    onSuccess: (data) => {
      if (data?.id) {
        void qc.invalidateQueries({ queryKey: workflowQueryKeys.run(data.id) });
      }
    },
  });

  const approvalMut = useMutation({
    mutationFn: submitApproval,
    onSuccess: () => invalidateAll(),
  });

  return {
    createWorkflow: createMut,
    updateWorkflow: updateMut,
    deleteWorkflow: deleteMut,
    runWorkflow: runMut,
    scheduleWorkflow: scheduleMut,
    retryWorkflowRun: retryRunMut,
    cancelWorkflowRun: cancelRunMut,
    appendLogs: appendLogsMut,
    submitApproval: approvalMut,
    validateDefinition: validateWorkflowDefinition,
    createDefaultWorkflowDefinition,
  };
}

export function useWorkflowEditorState(initial: WorkflowDefinition) {
  const [definition, setDefinition] = useState<WorkflowDefinition>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.nodes[0]?.id ?? null,
  );

  return {
    definition,
    setDefinition,
    selectedId,
    setSelectedId,
  };
}
