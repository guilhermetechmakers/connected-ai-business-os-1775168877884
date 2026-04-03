import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ActivityLogFilterValues } from "@/components/activity-log/activity-log-filter-bar";
import { useActivityLogExportMutation } from "@/hooks/use-activity-logs";

type ActivityLogExportButtonsProps = {
  appliedFilters: {
    eventTypes: string[];
    dateFrom?: string;
    dateTo?: string;
    actorUserId?: string;
    workflowRunId?: string;
    departmentId?: string;
    connectorId?: string;
    integrationId?: string;
    aiActionId?: string;
    search?: string;
  };
  disabled?: boolean;
};

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ActivityLogExportButtons({
  appliedFilters,
  disabled,
}: ActivityLogExportButtonsProps) {
  const exportMut = useActivityLogExportMutation();

  const runExport = async (format: "csv" | "json") => {
    try {
      const result = await exportMut.mutateAsync({
        format,
        eventTypes:
          appliedFilters.eventTypes.length > 0
            ? appliedFilters.eventTypes
            : undefined,
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        actorUserId: appliedFilters.actorUserId,
        workflowRunId: appliedFilters.workflowRunId,
        departmentId: appliedFilters.departmentId,
        connectorId: appliedFilters.connectorId,
        integrationId: appliedFilters.integrationId,
        aiActionId: appliedFilters.aiActionId,
        search: appliedFilters.search,
        limit: 3000,
      });
      if (!result?.content) {
        toast.message("Nothing to export for these filters");
        return;
      }
      const mime =
        format === "csv" ? "text/csv;charset=utf-8" : "application/json";
      downloadText(result.filename, result.content, mime);
      toast.success(`Exported ${format.toUpperCase()}`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="cta"
        size="sm"
        disabled={disabled || exportMut.isPending}
        onClick={() => void runExport("csv")}
      >
        <Download className="mr-1 h-4 w-4" />
        Export CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || exportMut.isPending}
        onClick={() => void runExport("json")}
      >
        Export JSON
      </Button>
    </div>
  );
}

export function buildAppliedFiltersFromForm(
  v: ActivityLogFilterValues,
): ActivityLogExportButtonsProps["appliedFilters"] {
  return {
    eventTypes: Array.isArray(v.eventTypes) ? v.eventTypes : [],
    dateFrom: v.from.trim() || undefined,
    dateTo: v.to.trim() || undefined,
    actorUserId: v.actorUserId.trim() || undefined,
    workflowRunId: v.workflowRunId.trim() || undefined,
    departmentId: v.departmentId.trim() || undefined,
    connectorId: v.connectorId.trim() || undefined,
    integrationId: v.integrationId.trim() || undefined,
    aiActionId: v.aiActionId.trim() || undefined,
    search: v.search.trim() || undefined,
  };
}
