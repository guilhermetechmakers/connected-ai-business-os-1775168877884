import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { upsertReportSchedule, upsertReportTemplate } from "@/api/unified-data";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { ExportButton } from "@/components/unified-data/export-button";
import { ReportCard } from "@/components/unified-data/report-card";
import { SchedulePane } from "@/components/unified-data/schedule-pane";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  unifiedQueryKeys,
  useReportSchedulesQuery,
  useReportTemplatesQuery,
} from "@/hooks/use-unified-data";
import { toast } from "sonner";

const chartData = [
  { name: "W1", delivered: 24 },
  { name: "W2", delivered: 31 },
  { name: "W3", delivered: 28 },
  { name: "W4", delivered: 36 },
];

const newReportSchema = z.object({
  name: z.string().min(2, "Name is required"),
});

type NewReportForm = z.infer<typeof newReportSchema>;

export default function ReportsCenterPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { data: templates = [], isLoading: tplLoading } = useReportTemplatesQuery();
  const { data: schedules = [], isLoading: schLoading } = useReportSchedulesQuery();

  const safeTemplates = Array.isArray(templates) ? templates : [];
  const safeSchedules = Array.isArray(schedules) ? schedules : [];

  const form = useForm<NewReportForm>({
    resolver: zodResolver(newReportSchema),
    defaultValues: { name: "" },
  });

  const createMutation = useMutation({
    mutationFn: upsertReportTemplate,
    onSuccess: async (row) => {
      await qc.invalidateQueries({ queryKey: unifiedQueryKeys.reportTemplates() });
      if (row?.id) setSelectedTemplateId(row.id);
      setOpen(false);
      form.reset();
      toast.success("Report template saved");
    },
    onError: () => toast.error("Could not save template"),
  });

  const scheduleMutation = useMutation({
    mutationFn: upsertReportSchedule,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: unifiedQueryKeys.reportSchedules() });
      toast.success("Schedule saved");
    },
    onError: () => toast.error("Could not save schedule"),
  });

  const activeTemplateId =
    selectedTemplateId ?? safeTemplates[0]?.id ?? null;

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Reports center"
        description="Create, view, schedule, and export reports with AI summaries — backed by unified report templates."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="cta" type="button">
                New report
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border/80 bg-card sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New report template</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  className="space-y-4"
                  onSubmit={form.handleSubmit((v) =>
                    createMutation.mutate({
                      name: v.name,
                      definition: { source: "unified_layer" },
                    }),
                  )}
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Weekly executive digest"
                            className="bg-surface-inner"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    variant="cta"
                    className="w-full"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Saving…" : "Create template"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ExportButton
          label="Templates"
          format="json"
          filenameBase="report-templates"
          getPayload={() => safeTemplates}
        />
        <ExportButton
          label="Schedules"
          format="csv"
          filenameBase="report-schedules"
          getPayload={() => safeSchedules}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!activeTemplateId || scheduleMutation.isPending}
          onClick={() => {
            if (!activeTemplateId) return;
            scheduleMutation.mutate({
              reportTemplateId: activeTemplateId,
              cronExpression: "0 9 * * 1",
              exportFormat: "pdf",
            });
          }}
        >
          Add weekly schedule
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly throughput</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="rgb(143,160,176)" />
                <YAxis stroke="rgb(143,160,176)" />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(17,32,43)",
                  }}
                />
                <Bar dataKey="delivered" fill="rgb(154,208,255)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <SchedulePane schedules={safeSchedules} isLoading={schLoading} />
      </div>

      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
          Catalog
        </h2>
        {tplLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : safeTemplates.length === 0 ? (
          <Card className="border-border/80 bg-card/90">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No templates yet — create one to populate schedules and exports.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {safeTemplates.map((t) => (
              <ReportCard
                key={t.id}
                template={t}
                onOpen={() => setSelectedTemplateId(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {safeTemplates.length > 0 ? (
        <Card className="border-border/80 bg-card/90">
          <CardHeader>
            <CardTitle>Template for scheduling</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Selected template
              </p>
              <Select
                value={activeTemplateId ?? undefined}
                onValueChange={(v) => setSelectedTemplateId(v)}
              >
                <SelectTrigger
                  className="bg-surface-inner"
                  aria-label="Select report template for schedule"
                >
                  <SelectValue placeholder="Choose template" />
                </SelectTrigger>
                <SelectContent>
                  {safeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="cta"
              disabled={!activeTemplateId || scheduleMutation.isPending}
              onClick={() => {
                if (!activeTemplateId) return;
                scheduleMutation.mutate({
                  reportTemplateId: activeTemplateId,
                  cronExpression: "0 7 * * *",
                  exportFormat: "json",
                });
              }}
            >
              Schedule JSON export
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 bg-card/90">
        <CardHeader>
          <CardTitle>AI summary</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none text-sm prose-p:text-muted-foreground">
          <p>
            Delivery cadence can be summarized from unified KPI entities and report
            runs. Use the AI workspace for deeper narrative, or attach OpenAI keys to
            Edge Functions for automated digests.
          </p>
        </CardContent>
      </Card>
    </AnimatedPage>
  );
}
