import { Download, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { readJsonRecord } from "@/lib/reports-center-safe";
import { cn } from "@/lib/utils";
import type { ReportExportJobRow } from "@/types/reports-center";

export interface ExportPanelProps {
  reportId: string;
  jobs: unknown;
  isLoading: boolean;
  canWrite: boolean;
  onEnqueue: (input: {
    format: "csv" | "pdf" | "json";
    destination: Record<string, unknown>;
    fileName?: string;
    compress?: boolean;
  }) => Promise<void>;
  isEnqueueing: boolean;
  className?: string;
}

const formatIcon = {
  csv: FileSpreadsheet,
  pdf: FileText,
  json: FileJson,
};

export function ExportPanel({
  reportId,
  jobs,
  isLoading,
  canWrite,
  onEnqueue,
  isEnqueueing,
  className,
}: ExportPanelProps) {
  const [format, setFormat] = useState<"csv" | "pdf" | "json">("csv");
  const [destinationType, setDestinationType] = useState<
    "download" | "api_sink" | "warehouse"
  >("download");
  const [fileName, setFileName] = useState(`report-${reportId.slice(0, 8)}`);
  const [compress, setCompress] = useState(false);

  const list = Array.isArray(jobs) ? (jobs as ReportExportJobRow[]) : [];

  const submit = async () => {
    await onEnqueue({
      format,
      fileName,
      compress,
      destination: {
        type: destinationType,
        reportId,
      },
    });
  };

  return (
    <Card
      className={cn(
        "border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90",
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg text-[rgb(154,208,255)]">
          <Download className="h-5 w-5" aria-hidden />
          Export
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Queue CSV, PDF, or JSON exports with auditable job metadata.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {canWrite ? (
          <div className="grid gap-4 rounded-lg border border-white/[0.06] bg-[rgb(12,17,22)] p-4 sm:grid-cols-2">
            <div>
              <Label>Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as typeof format)}
              >
                <SelectTrigger className="mt-1 bg-[rgb(15,23,32)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destination</Label>
              <Select
                value={destinationType}
                onValueChange={(v) => setDestinationType(v as typeof destinationType)}
              >
                <SelectTrigger className="mt-1 bg-[rgb(15,23,32)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="download">Local download</SelectItem>
                  <SelectItem value="api_sink">API sink</SelectItem>
                  <SelectItem value="warehouse">Data warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="export-filename">File name</Label>
              <Input
                id="export-filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="mt-1 bg-[rgb(15,23,32)]"
              />
            </div>
            <div className="flex items-center justify-between sm:col-span-2">
              <Label htmlFor="compress">Compress archive</Label>
              <Switch
                id="compress"
                checked={compress}
                onCheckedChange={setCompress}
                aria-label="Compress export"
              />
            </div>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="cta"
                className="w-full transition-transform duration-150 hover:scale-[1.02]"
                disabled={isEnqueueing}
                onClick={() => void submit()}
              >
                {isEnqueueing ? "Queueing…" : "Run export"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Read-only users cannot enqueue exports.
          </p>
        )}

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent jobs
          </h4>
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No export jobs yet.</p>
          ) : (
            <ul className="space-y-2">
              {list.map((j) => {
                const Icon = formatIcon[j.format as keyof typeof formatIcon] ?? FileText;
                const dest = readJsonRecord(j.destination);
                return (
                  <li
                    key={j.id}
                    className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-[rgb(12,17,22)] px-3 py-2 text-sm transition-colors duration-150 hover:border-[rgb(0,210,122)]/20"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(154,208,255)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium uppercase text-[rgb(247,250,255)]">
                          {j.format}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            j.status === "completed"
                              ? "bg-[rgb(0,210,122)]/15 text-[rgb(0,210,122)]"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {j.status}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {String(dest.type ?? "destination")} ·{" "}
                        {new Date(j.created_at).toLocaleString()}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
