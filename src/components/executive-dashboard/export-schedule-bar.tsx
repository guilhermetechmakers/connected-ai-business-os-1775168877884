import { useMutation } from "@tanstack/react-query";
import { CalendarClock, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createDashboardExportSchedule } from "@/api/dashboard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  exportExecutiveDashboardCsv,
  exportExecutiveDashboardJson,
  exportExecutiveDashboardPrintableHtml,
} from "@/lib/executive-export-service";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { ExecutiveDashboardSnapshot } from "@/types/executive-dashboard";

export type ExportScheduleBarProps = {
  snapshot: ExecutiveDashboardSnapshot;
  layoutId: string | null;
  canExport: boolean;
  canSchedule: boolean;
  className?: string;
};

const CADENCE_PRESETS = [
  { label: "Weekly Monday 09:00", value: "0 9 * * 1" },
  { label: "Daily 08:00", value: "0 8 * * *" },
  { label: "Monthly 1st 09:00", value: "0 9 1 * *" },
] as const;

export function ExportScheduleBar({
  snapshot,
  layoutId,
  canExport,
  canSchedule,
  className,
}: ExportScheduleBarProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [cron, setCron] = useState<string>(CADENCE_PRESETS[0].value);

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const target = email.trim();
      if (!target) throw new Error("Email required");
      const row = await createDashboardExportSchedule({
        targetType: "email",
        targetValue: target,
        cronExpression: cron,
        layoutId: layoutId ?? undefined,
      });
      if (!row) throw new Error("Schedule not created");
      return row;
    },
    onSuccess: () => {
      toast.success("Export schedule saved");
      setScheduleOpen(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not save schedule"),
  });

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface-inner/50 p-3 ${className ?? ""}`}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="cta"
            size="sm"
            className="gap-2 rounded-full"
            disabled={!canExport}
            aria-label="Export executive dashboard"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>Format</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await exportExecutiveDashboardCsv(snapshot);
                toast.success("CSV downloaded");
              } catch {
                toast.error("Export failed");
              }
            }}
          >
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await exportExecutiveDashboardJson(snapshot);
                toast.success("JSON downloaded");
              } catch {
                toast.error("Export failed");
              }
            }}
          >
            JSON
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await exportExecutiveDashboardPrintableHtml(snapshot);
                toast.success("Printable HTML downloaded — use browser print to PDF");
              } catch {
                toast.error("Export failed");
              }
            }}
          >
            Printable (HTML / PDF via print)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-full border-primary/30"
            disabled={!canSchedule || !isSupabaseConfigured}
            aria-label="Schedule executive report"
          >
            <CalendarClock className="h-4 w-4" aria-hidden />
            Schedule
          </Button>
        </SheetTrigger>
        <SheetContent className="border-border/80 bg-card">
          <SheetHeader>
            <SheetTitle>Schedule executive export</SheetTitle>
            <SheetDescription>
              Delivers a dashboard export to email on the cadence you choose. Uses the dashboard framework
              export pipeline.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-1">
            <div className="space-y-2">
              <Label htmlFor="exec-export-email">Email</Label>
              <Input
                id="exec-export-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cadence</Label>
              <Select value={cron} onValueChange={setCron}>
                <SelectTrigger aria-label="Report cadence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CADENCE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="mt-8 gap-2">
            <Button type="button" variant="ghost" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="cta"
              disabled={scheduleMutation.isPending || !email.trim()}
              onClick={() => scheduleMutation.mutate()}
            >
              {scheduleMutation.isPending ? "Saving…" : "Save schedule"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {!canExport ? (
        <span className="text-xs text-muted-foreground">Export limited for your role.</span>
      ) : null}
    </div>
  );
}
