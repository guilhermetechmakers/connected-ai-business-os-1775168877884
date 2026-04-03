import { zodResolver } from "@hookform/resolvers/zod";
import { Database, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePatchDataPolicyMutation, useTenantDataPolicyQuery } from "@/hooks/use-settings-hub";
import type { TenantDataPolicyRow } from "@/lib/settings-hub-api";

const policySchema = z.object({
  retentionPeriodDays: z.coerce.number().int().min(0).max(36500),
  auditRetentionDays: z.coerce.number().int().min(30).max(36500),
  exportAllowed: z.boolean(),
  purgeScheduled: z.boolean(),
});

type PolicyForm = z.infer<typeof policySchema>;

function readAuditRetentionDays(row: TenantDataPolicyRow | null | undefined): number {
  if (!row?.audit_config || typeof row.audit_config !== "object" || Array.isArray(row.audit_config)) {
    return 730;
  }
  const v = (row.audit_config as Record<string, unknown>).auditRetentionDays;
  return typeof v === "number" && Number.isFinite(v) ? v : 730;
}

export function DataPoliciesPanel() {
  const q = useTenantDataPolicyQuery();
  const mut = usePatchDataPolicyMutation();

  const form = useForm<PolicyForm>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      retentionPeriodDays: 365,
      auditRetentionDays: 730,
      exportAllowed: true,
      purgeScheduled: false,
    },
  });

  useEffect(() => {
    if (!q.data) return;
    form.reset({
      retentionPeriodDays: q.data.retention_period_days ?? 365,
      auditRetentionDays: readAuditRetentionDays(q.data),
      exportAllowed: q.data.export_allowed ?? true,
      purgeScheduled: q.data.purge_scheduled ?? false,
    });
  }, [q.data, form]);

  if (q.isLoading) {
    return <Skeleton className="h-64 w-full max-w-2xl rounded-xl bg-surface-inner" />;
  }

  if (q.isError) {
    return (
      <p className="text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : "Could not load data policies"}
      </p>
    );
  }

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5 text-primary" aria-hidden />
          Data policies &amp; retention
        </CardTitle>
        <CardDescription>
          Retention windows for operational data. Audit log retention is stored in{" "}
          <code className="rounded bg-muted px-1 text-xs">audit_config.auditRetentionDays</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="max-w-xl space-y-6"
            onSubmit={form.handleSubmit((vals) => {
              mut.mutate(
                {
                  retentionPeriodDays: vals.retentionPeriodDays,
                  exportAllowed: vals.exportAllowed,
                  purgeScheduled: vals.purgeScheduled,
                  auditConfig: {
                    ...(q.data?.audit_config && typeof q.data.audit_config === "object" &&
                    !Array.isArray(q.data.audit_config)
                      ? (q.data.audit_config as Record<string, unknown>)
                      : {}),
                    auditRetentionDays: vals.auditRetentionDays,
                  },
                },
                {
                  onSuccess: () => toast.success("Data policies saved"),
                  onError: (e: Error) => toast.error(e.message),
                },
              );
            })}
          >
            <FormField
              control={form.control}
              name="retentionPeriodDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data retention (days)</FormLabel>
                  <FormControl>
                    <Input type="number" className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormDescription>Applies to sync logs and AI archives per tenant policy.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="auditRetentionDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Settings audit retention (days)</FormLabel>
                  <FormControl>
                    <Input type="number" className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exportAllowed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3">
                  <div>
                    <FormLabel className="text-base">Allow tenant data export</FormLabel>
                    <FormDescription>Self-service exports for admins.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="purgeScheduled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3">
                  <div>
                    <FormLabel className="text-base">Schedule purge jobs</FormLabel>
                    <FormDescription>Queue automated purge according to retention windows.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" variant="cta" disabled={mut.isPending}>
              {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save policies
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
