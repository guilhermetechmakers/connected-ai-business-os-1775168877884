import { CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
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
import { ensureArray } from "@/lib/reports-center-safe";
import { cn } from "@/lib/utils";
import type { ReportCenterScheduleRow } from "@/types/reports-center";

export interface ScheduleManagerProps {
  reportId: string;
  schedules: unknown;
  isLoading: boolean;
  canWrite: boolean;
  onSave: (input: {
    cadence: "hourly" | "daily" | "weekly";
    cronExpression?: string;
    recipients: string[];
    deliveryModes: string[];
    exportFormats: string[];
    active: boolean;
  }) => Promise<void>;
  isSaving: boolean;
  className?: string;
}

function readStringListJson(value: unknown): string[] {
  const a = ensureArray<unknown>(value);
  return a.filter((x): x is string => typeof x === "string" && x.length > 0);
}

export function ScheduleManager({
  reportId,
  schedules,
  isLoading,
  canWrite,
  onSave,
  isSaving,
  className,
}: ScheduleManagerProps) {
  const [cadence, setCadence] = useState<"hourly" | "daily" | "weekly">("daily");
  const [cronExpression, setCronExpression] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [active, setActive] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | "json">("pdf");

  const list = Array.isArray(schedules) ? (schedules as ReportCenterScheduleRow[]) : [];

  const handleSubmit = async () => {
    const recipients = recipientsRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await onSave({
      cadence,
      cronExpression: cronExpression.trim() || undefined,
      recipients,
      deliveryModes: ["email", "export_sink"],
      exportFormats: [exportFormat],
      active,
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
          <CalendarClock className="h-5 w-5" aria-hidden />
          Schedules
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cadence, recipients, and delivery modes for report{" "}
          <span className="font-mono text-xs text-foreground/80">{reportId.slice(0, 8)}…</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-lg" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedules yet.</p>
        ) : (
          <ul className="space-y-2" aria-label="Existing schedules">
            {list.map((s) => {
              const rec = readStringListJson(s.recipients);
              return (
                <li
                  key={s.id}
                  className="rounded-lg border border-white/[0.06] bg-[rgb(12,17,22)] px-3 py-2 text-sm transition-colors duration-150 hover:border-[rgb(154,208,255)]/25"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize text-[rgb(247,250,255)]">
                      {s.cadence}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        s.active
                          ? "bg-[rgb(0,210,122)]/15 text-[rgb(0,210,122)]"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Formats: {(s.export_formats ?? []).join(", ") || "—"} · Recipients:{" "}
                    {rec.length ? rec.join(", ") : "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <ReportsAccessControlGuardInline allow={canWrite}>
          <div className="space-y-4 rounded-lg border border-dashed border-[rgb(21,78,120)]/50 bg-[rgb(12,17,22)]/80 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Cadence</Label>
                <Select
                  value={cadence}
                  onValueChange={(v) =>
                    setCadence(v as "hourly" | "daily" | "weekly")
                  }
                >
                  <SelectTrigger className="mt-1 bg-[rgb(12,17,22)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cron-expr">Cron (optional)</Label>
                <Input
                  id="cron-expr"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 9 * * 1"
                  className="mt-1 bg-[rgb(12,17,22)]"
                  aria-label="Cron expression"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="export-fmt-schedule">Export format</Label>
              <Select
                value={exportFormat}
                onValueChange={(v) =>
                  setExportFormat(v as "csv" | "pdf" | "json")
                }
              >
                <SelectTrigger id="export-fmt-schedule" className="mt-1 bg-[rgb(12,17,22)]">
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
              <Label htmlFor="recipients">Recipients (comma-separated)</Label>
              <Input
                id="recipients"
                value={recipientsRaw}
                onChange={(e) => setRecipientsRaw(e.target.value)}
                placeholder="ops@company.com, analytics@company.com"
                className="mt-1 bg-[rgb(12,17,22)]"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="sched-active">Activate after save</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive schedules stay draft until you enable delivery.
                </p>
              </div>
              <Switch
                id="sched-active"
                checked={active}
                onCheckedChange={setActive}
                aria-label="Activate schedule"
              />
            </div>
            <Button
              type="button"
              variant="cta"
              disabled={isSaving}
              className="w-full transition-transform duration-150 hover:scale-[1.02]"
              onClick={() => void handleSubmit()}
            >
              {isSaving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </ReportsAccessControlGuardInline>
      </CardContent>
    </Card>
  );
}

function ReportsAccessControlGuardInline({
  allow,
  children,
}: {
  allow: boolean;
  children: ReactNode;
}) {
  if (!allow) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to edit schedules.
      </p>
    );
  }
  return children;
}
