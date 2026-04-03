import { zodResolver } from "@hookform/resolvers/zod";
import { Building2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatchTenantSettingsMutation } from "@/hooks/use-tenant-settings";
import type { TenantSettingsRow } from "@/lib/profile-api";

const companySchema = z.object({
  name: z.string().min(2, "Company name is required"),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  industry: z.string().max(120).optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

export function TenantCompanySettingsForm({
  tenant,
  isLoading,
  loadError,
}: {
  tenant: TenantSettingsRow | null | undefined;
  isLoading: boolean;
  loadError: boolean;
}) {
  const patch = usePatchTenantSettingsMutation();

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: tenant?.name ?? "",
      timezone: tenant?.timezone ?? "UTC",
      currency: tenant?.currency ?? "USD",
      industry: tenant?.industry ?? "",
    },
  });

  useEffect(() => {
    if (!tenant) return;
    form.reset({
      name: tenant.name ?? "",
      timezone: tenant.timezone ?? "UTC",
      currency: tenant.currency ?? "USD",
      industry: tenant.industry ?? "",
    });
  }, [tenant, form]);

  if (isLoading) {
    return <Skeleton className="h-48 w-full max-w-xl rounded-xl bg-surface-inner" />;
  }

  if (loadError || !tenant) {
    return (
      <p className="text-sm text-muted-foreground">
        Company settings are available to tenant administrators only.
      </p>
    );
  }

  return (
    <Card className="border-border/80 bg-card/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          Company profile
        </CardTitle>
        <CardDescription>
          Legal identity, timezone, and currency used across dashboards, AI variables, and reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-4 max-w-xl"
            onSubmit={form.handleSubmit((vals) => {
              patch.mutate(
                {
                  name: vals.name,
                  timezone: vals.timezone,
                  currency: vals.currency,
                  industry: vals.industry?.trim() ? vals.industry.trim() : null,
                },
                {
                  onSuccess: () => toast.success("Company profile saved"),
                  onError: (e) => toast.error(e.message),
                },
              );
            })}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal name</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="cta" disabled={patch.isPending}>
              Save company
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
