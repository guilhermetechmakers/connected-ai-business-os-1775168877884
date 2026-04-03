import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ensureArray } from "@/lib/reports-center-safe";
import type { DataSourceEntityRow, KpiMetricRow } from "@/types/reports-center";

const wizardSchema = z.object({
  name: z.string().min(2, "Name is required").max(240),
  description: z.string().max(2000).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  dataSourceIds: z.array(z.string().uuid()).default([]),
  kpiIds: z.array(z.string().uuid()).default([]),
  vizPreset: z.enum(["chart_bar", "chart_line", "table"]),
  scheduleCadence: z.enum(["none", "daily", "weekly"]).default("none"),
  exportDefaultFormat: z.enum(["csv", "pdf", "json"]).default("csv"),
});

export type ReportWizardFormValues = z.infer<typeof wizardSchema>;

export interface ReportWizardProps {
  departments: Array<{ id: string; name: string }>;
  dataSources: DataSourceEntityRow[];
  kpis: KpiMetricRow[];
  onSubmit: (values: ReportWizardFormValues) => Promise<{ id: string } | null>;
  className?: string;
}

const STEPS = [
  "Basics",
  "Data sources",
  "KPIs",
  "Visuals",
  "Delivery",
] as const;

export function ReportWizard({
  departments,
  dataSources,
  kpis,
  onSubmit,
  className,
}: ReportWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ReportWizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      name: "",
      description: "",
      departmentId: null,
      dataSourceIds: [],
      kpiIds: [],
      vizPreset: "chart_bar",
      scheduleCadence: "none",
      exportDefaultFormat: "csv",
    },
  });

  const deptOptions = Array.isArray(departments) ? departments : [];
  const dsList = Array.isArray(dataSources) ? dataSources : [];
  const kpiList = Array.isArray(kpis) ? kpis : [];

  const progress = useMemo(
    () => Math.round(((step + 1) / STEPS.length) * 100),
    [step],
  );

  const next = async () => {
    const fields: (keyof ReportWizardFormValues)[] =
      step === 0 ? ["name"] : [];
    const ok = fields.length
      ? await form.trigger(fields)
      : true;
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const created = await onSubmit(values);
      if (created?.id) {
        toast.success("Report created");
        navigate(`/reports/${created.id}`);
      } else {
        toast.error("Could not create report");
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className={cn("mx-auto max-w-3xl space-y-6", className)}>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{STEPS[step]}</span>
        </div>
        <Progress value={progress} className="h-1.5 bg-[rgb(12,17,22)]" />
      </div>

      <Form {...form}>
        <form onSubmit={finish} className="space-y-6">
          <Card className="border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/95">
            <CardHeader>
              <CardTitle className="font-display text-xl text-[rgb(154,208,255)]">
                {STEPS[step]}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 0 ? (
                <>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Report name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-[rgb(12,17,22)]"
                            placeholder="Cross-department revenue pulse"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className="bg-[rgb(12,17,22)]"
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department (optional)</FormLabel>
                        <Select
                          value={field.value ?? "none"}
                          onValueChange={(v) =>
                            field.onChange(v === "none" ? null : v)
                          }
                        >
                          <FormControl>
                            <SelectTrigger className="bg-[rgb(12,17,22)]">
                              <SelectValue placeholder="Tenant-wide" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Tenant-wide</SelectItem>
                            {deptOptions.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : null}

              {step === 1 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {dsList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No unified entities found — ingest data from the unified layer first.
                    </p>
                  ) : (
                    <FormField
                      control={form.control}
                      name="dataSourceIds"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <FormMessage />
                          {dsList.map((row) => {
                            const checked = ensureArray<string>(field.value).includes(
                              row.id,
                            );
                            return (
                              <FormItem
                                key={row.id}
                                className="flex flex-row items-start gap-3 rounded-lg border border-white/[0.06] p-3"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      const cur = ensureArray<string>(field.value);
                                      if (v === true) {
                                        field.onChange([...cur, row.id]);
                                      } else {
                                        field.onChange(cur.filter((x) => x !== row.id));
                                      }
                                    }}
                                    aria-label={`Select data source ${row.entity_type}`}
                                  />
                                </FormControl>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <FormLabel className="font-medium text-[rgb(247,250,255)]">
                                    {row.entity_type}
                                  </FormLabel>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {row.id}
                                  </p>
                                </div>
                              </FormItem>
                            );
                          })}
                        </div>
                      )}
                    />
                  )}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {kpiList.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Create KPIs from the catalog first, then link them here.
                    </p>
                  ) : (
                    <FormField
                      control={form.control}
                      name="kpiIds"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <FormMessage />
                          {kpiList.map((k) => {
                            const checked = ensureArray<string>(field.value).includes(
                              k.id,
                            );
                            return (
                              <FormItem
                                key={k.id}
                                className="flex flex-row items-start gap-3 rounded-lg border border-white/[0.06] p-3"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      const cur = ensureArray<string>(field.value);
                                      if (v === true) {
                                        field.onChange([...cur, k.id]);
                                      } else {
                                        field.onChange(cur.filter((x) => x !== k.id));
                                      }
                                    }}
                                    aria-label={`Link KPI ${k.name}`}
                                  />
                                </FormControl>
                                <div>
                                  <FormLabel className="text-[rgb(247,250,255)]">
                                    {k.name}
                                  </FormLabel>
                                </div>
                              </FormItem>
                            );
                          })}
                        </div>
                      )}
                    />
                  )}
                </div>
              ) : null}

              {step === 3 ? (
                <FormField
                  control={form.control}
                  name="vizPreset"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visualization</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid gap-2"
                        >
                          {(
                            [
                              ["chart_bar", "Bar chart"],
                              ["chart_line", "Line chart"],
                              ["table", "Table"],
                            ] as const
                          ).map(([val, label]) => (
                            <FormItem
                              key={val}
                              className="flex items-center gap-3 rounded-lg border border-white/[0.06] px-3 py-2"
                            >
                              <FormControl>
                                <RadioGroupItem value={val} id={val} />
                              </FormControl>
                              <FormLabel htmlFor={val} className="font-normal">
                                {label}
                              </FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {step === 4 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="scheduleCadence"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Schedule hint</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="bg-[rgb(12,17,22)]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No default schedule</SelectItem>
                            <SelectItem value="daily">Daily digest</SelectItem>
                            <SelectItem value="weekly">Weekly rollup</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="exportDefaultFormat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default export format</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="bg-[rgb(12,17,22)]">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={step === 0}
              className="transition-transform duration-150 hover:scale-[1.02]"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                variant="cta"
                onClick={() => void next()}
                className="transition-transform duration-150 hover:scale-[1.02]"
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="cta"
                disabled={submitting}
                className="transition-transform duration-150 hover:scale-[1.02]"
              >
                {submitting ? "Saving…" : "Create report"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
