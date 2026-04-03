import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AnimatedPage } from "@/components/animated-page";
import { ReportDetailView } from "@/components/reports-center/report-detail-view";
import { useAuth } from "@/contexts/auth-context";
import {
  useEnqueueExportMutation,
  useKpiMetricsQuery,
  useReportCenterDetailQuery,
  useReportExportsQuery,
  useReportSchedulesQuery,
  useUpsertScheduleMutation,
} from "@/hooks/use-reports-center";

export default function ReportDetailPage() {
  const { reportId } = useParams();
  const { profile } = useAuth();

  const { data: report, isLoading: reportLoading } = useReportCenterDetailQuery(
    reportId,
  );
  const { data: schedules = [], isLoading: schedulesLoading } =
    useReportSchedulesQuery(reportId);
  const { data: exports = [], isLoading: exportsLoading } =
    useReportExportsQuery(reportId);
  const { data: kpis = [] } = useKpiMetricsQuery();

  const scheduleMutation = useUpsertScheduleMutation(reportId);
  const exportMutation = useEnqueueExportMutation(reportId);

  if (!reportId) {
    return <Navigate to="/reports" replace />;
  }

  return (
    <AnimatedPage>
      <ReportDetailView
        report={report ?? null}
        reportLoading={reportLoading}
        schedules={schedules}
        schedulesLoading={schedulesLoading}
        exports={exports}
        exportsLoading={exportsLoading}
        kpis={Array.isArray(kpis) ? kpis : []}
        userRoles={profile?.roles}
        scheduleSaving={scheduleMutation.isPending}
        onUpsertSchedule={async (payload) => {
          const row = await scheduleMutation.mutateAsync({
            reportId,
            cadence: payload.cadence,
            cronExpression: payload.cronExpression,
            recipients: payload.recipients,
            deliveryModes: payload.deliveryModes,
            exportFormats: payload.exportFormats,
            active: payload.active,
          });
          if (row) toast.success("Schedule saved");
          else toast.error("Could not save schedule");
        }}
        exportEnqueueing={exportMutation.isPending}
        onEnqueueExport={async (payload) => {
          const row = await exportMutation.mutateAsync({
            reportId,
            format: payload.format,
            destination: payload.destination,
            fileName: payload.fileName,
            compress: payload.compress,
          });
          if (row) toast.success("Export job completed");
          else toast.error("Export failed");
        }}
      />
    </AnimatedPage>
  );
}
