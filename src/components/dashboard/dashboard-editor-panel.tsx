import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import {
  createDashboardExportSchedule,
  listDashboardExportSchedules,
  triggerDashboardExportSchedule,
} from "@/api/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { DashboardExportScheduleRow, DashboardLayoutJson } from "@/types/dashboard";

export type DashboardEditorPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardKind: "global" | "executive";
  layoutJson: DashboardLayoutJson;
  layoutId: string | null;
  footerNote?: ReactNode;
};

export function DashboardEditorPanel({
  open,
  onOpenChange,
  dashboardKind,
  layoutJson,
  layoutId,
  footerNote,
}: DashboardEditorPanelProps) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [cron, setCron] = useState("0 9 * * 1");

  const schedulesQ = useQuery({
    queryKey: ["dashboard-export-schedules"],
    queryFn: listDashboardExportSchedules,
    enabled: open && isSupabaseConfigured,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createDashboardExportSchedule({
        targetType: "email",
        targetValue: email.trim(),
        cronExpression: cron.trim() || "0 9 * * 1",
        layoutId: layoutId ?? undefined,
      }),
    onSuccess: (row) => {
      if (row) {
        toast.success("Export schedule saved");
        void qc.invalidateQueries({ queryKey: ["dashboard-export-schedules"] });
        setEmail("");
      } else {
        toast.error("Could not create schedule");
      }
    },
    onError: () => toast.error("Could not create schedule"),
  });

  const triggerMut = useMutation({
    mutationFn: triggerDashboardExportSchedule,
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success("Export payload generated");
      } else {
        toast.error("Trigger failed");
      }
    },
    onError: () => toast.error("Trigger failed"),
  });

  function exportJson() {
    const blob = new Blob([JSON.stringify(layoutJson ?? {}, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${dashboardKind}-layout.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Layout JSON exported");
  }

  const schedules = Array.isArray(schedulesQ.data) ? schedulesQ.data : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col border-border/80 bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display">Layout & export</SheetTitle>
          <SheetDescription>
            Export this dashboard as JSON or schedule a recurring export record (payload generated
            server-side).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto pb-8">
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 transition-transform duration-150 hover:scale-[1.01] motion-reduce:hover:scale-100"
              onClick={exportJson}
            >
              <Download className="h-4 w-4" />
              Download layout JSON
            </Button>
            {footerNote}
          </div>

          {isSupabaseConfigured ? (
            <>
              <div className="space-y-3 rounded-xl border border-border/60 bg-surface-inner/60 p-4">
                <h3 className="text-sm font-semibold text-foreground">New export schedule</h3>
                <div className="space-y-2">
                  <Label htmlFor="dash-export-email">Email target</Label>
                  <Input
                    id="dash-export-email"
                    type="email"
                    autoComplete="email"
                    placeholder="ops@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-input/80"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dash-export-cron">Cron expression</Label>
                  <Input
                    id="dash-export-cron"
                    value={cron}
                    onChange={(e) => setCron(e.target.value)}
                    className="font-mono text-xs bg-input/80"
                  />
                </div>
                <Button
                  type="button"
                  variant="cta"
                  disabled={!email.trim() || createMut.isPending}
                  onClick={() => createMut.mutate()}
                  className="w-full"
                >
                  {createMut.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Create schedule"
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Your schedules</h3>
                {schedulesQ.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : schedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No schedules yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {schedules.map((s: DashboardExportScheduleRow) => (
                      <li
                        key={s.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/80 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">{s.target_value}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={triggerMut.isPending}
                            onClick={() => triggerMut.mutate(s.id)}
                          >
                            Run now
                          </Button>
                        </div>
                        <span className="font-mono text-[10px] text-primary/90">{s.cron_expression}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect Supabase to persist schedules and server-side layout storage.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
