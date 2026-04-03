import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cloneReportCenterReport,
  createKpiMetric,
  createReportCenterReport,
  deleteReportCenterReport,
  enqueueReportExport,
  fetchKpiMetricsList,
  fetchReportCenterDetail,
  fetchReportCenterList,
  fetchReportExportJobs,
  fetchReportsCenterDataSources,
  fetchReportsCenterDepartments,
  fetchReportSchedulesList,
  refreshKpiMetric,
  updateReportCenterReport,
  upsertReportSchedule as upsertReportCenterSchedule,
} from "@/api/reports-center";
import type { ReportsCenterFilters } from "@/types/reports-center";

export const reportsCenterQueryKeys = {
  root: ["reports-center"] as const,
  departments: () => [...reportsCenterQueryKeys.root, "departments"] as const,
  dataSources: (search: string) =>
    [...reportsCenterQueryKeys.root, "data-sources", search] as const,
  kpis: () => [...reportsCenterQueryKeys.root, "kpis"] as const,
  reportsList: (f: ReportsCenterFilters) =>
    [...reportsCenterQueryKeys.root, "reports", f] as const,
  reportDetail: (id: string) => [...reportsCenterQueryKeys.root, "report", id] as const,
  schedules: (reportId: string) =>
    [...reportsCenterQueryKeys.root, "schedules", reportId] as const,
  exports: (reportId: string) =>
    [...reportsCenterQueryKeys.root, "exports", reportId] as const,
};

export function useReportsCenterDepartmentsQuery() {
  return useQuery({
    queryKey: reportsCenterQueryKeys.departments(),
    queryFn: () => fetchReportsCenterDepartments(),
  });
}

export function useReportsCenterDataSourcesQuery(search: string) {
  return useQuery({
    queryKey: reportsCenterQueryKeys.dataSources(search),
    queryFn: () =>
      fetchReportsCenterDataSources({
        search: search.trim() || undefined,
        limit: 60,
      }),
  });
}

export function useKpiMetricsQuery() {
  return useQuery({
    queryKey: reportsCenterQueryKeys.kpis(),
    queryFn: () => fetchKpiMetricsList(),
  });
}

export function useReportCenterListQuery(
  filters: ReportsCenterFilters,
  options?: { currentUserId?: string | null },
) {
  const uid = options?.currentUserId ?? null;
  return useQuery({
    queryKey: [...reportsCenterQueryKeys.reportsList(filters), uid ?? ""] as const,
    queryFn: () =>
      fetchReportCenterList({
        departmentId: filters.departmentId ?? undefined,
        status: filters.status ?? undefined,
        tag: filters.tag ?? undefined,
        search: filters.search.trim() || undefined,
        ownerUserId: filters.ownerOnly && uid ? uid : undefined,
        limit: 80,
        offset: 0,
      }),
  });
}

export function useReportCenterDetailQuery(reportId: string | undefined) {
  return useQuery({
    queryKey: reportsCenterQueryKeys.reportDetail(reportId ?? ""),
    queryFn: () =>
      reportId ? fetchReportCenterDetail(reportId) : Promise.resolve(null),
    enabled: Boolean(reportId),
  });
}

export function useReportSchedulesQuery(reportId: string | undefined) {
  return useQuery({
    queryKey: reportsCenterQueryKeys.schedules(reportId ?? ""),
    queryFn: () =>
      reportId ? fetchReportSchedulesList(reportId) : Promise.resolve([]),
    enabled: Boolean(reportId),
  });
}

export function useReportExportsQuery(reportId: string | undefined) {
  return useQuery({
    queryKey: reportsCenterQueryKeys.exports(reportId ?? ""),
    queryFn: () =>
      reportId ? fetchReportExportJobs(reportId, 30) : Promise.resolve([]),
    enabled: Boolean(reportId),
  });
}

export function useInvalidateReportsCenter() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.root });
  };
}

export function useCreateReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createReportCenterReport,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.root });
    },
  });
}

export function useUpdateReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      patch: Parameters<typeof updateReportCenterReport>[1];
    }) => updateReportCenterReport(args.id, args.patch),
    onSuccess: async (_d, v) => {
      await qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.root });
      await qc.invalidateQueries({
        queryKey: reportsCenterQueryKeys.reportDetail(v.id),
      });
    },
  });
}

export function useDeleteReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteReportCenterReport,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.root });
    },
  });
}

export function useCloneReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; name?: string }) =>
      cloneReportCenterReport(args.id, args.name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.root });
    },
  });
}

export function useUpsertScheduleMutation(reportId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertReportCenterSchedule,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.root });
      if (reportId) {
        await qc.invalidateQueries({
          queryKey: reportsCenterQueryKeys.schedules(reportId),
        });
      }
    },
  });
}

export function useEnqueueExportMutation(reportId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: enqueueReportExport,
    onSuccess: async () => {
      if (reportId) {
        await qc.invalidateQueries({
          queryKey: reportsCenterQueryKeys.exports(reportId),
        });
      }
    },
  });
}

export function useCreateKpiMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createKpiMetric,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.kpis() });
    },
  });
}

export function useRefreshKpiMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshKpiMetric,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: reportsCenterQueryKeys.kpis() });
    },
  });
}
