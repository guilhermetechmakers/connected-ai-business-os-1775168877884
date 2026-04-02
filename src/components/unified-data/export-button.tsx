import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type ExportButtonProps = {
  label?: string;
  format: "csv" | "json" | "pdf";
  filenameBase: string;
  getPayload: () => unknown;
};

export function ExportButton({
  label = "Export",
  format,
  filenameBase,
  getPayload,
}: ExportButtonProps) {
  function handleExport() {
    const payload = getPayload();
    try {
      if (format === "json") {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filenameBase}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (format === "csv") {
        const rows = Array.isArray(payload) ? payload : [payload];
        const header = Object.keys(
          (rows[0] as Record<string, unknown>) ?? {},
        ).join(",");
        const lines = rows.map((r) =>
          Object.values((r as Record<string, unknown>) ?? {})
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        );
        const csv = [header, ...lines].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filenameBase}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.message("PDF export", {
          description:
            "Wire this to a server-side renderer. CSV/JSON exports work client-side.",
        });
        return;
      }
      toast.success("Export ready");
    } catch {
      toast.error("Export failed");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 transition-transform duration-150 hover:scale-[1.02]"
      onClick={handleExport}
      aria-label={`Export as ${format}`}
    >
      <Download className="h-4 w-4" />
      {label} · {format.toUpperCase()}
    </Button>
  );
}
