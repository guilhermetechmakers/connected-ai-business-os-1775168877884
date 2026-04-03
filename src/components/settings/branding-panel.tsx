import { zodResolver } from "@hookform/resolvers/zod";
import { Paintbrush } from "lucide-react";
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
import { usePatchTenantSettingsMutation } from "@/hooks/use-tenant-settings";
import type { Json } from "@/types/database";

const brandingSchema = z.object({
  logoUrl: z.union([z.string().url(), z.literal("")]),
  accentHex: z.string().max(8).optional(),
  emailFooter: z.string().max(2000).optional(),
});

type BrandingForm = z.infer<typeof brandingSchema>;

function readBranding(settings: Json | undefined): BrandingForm {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { logoUrl: "", accentHex: "", emailFooter: "" };
  }
  const b = (settings as Record<string, unknown>).branding;
  if (!b || typeof b !== "object" || Array.isArray(b)) {
    return { logoUrl: "", accentHex: "", emailFooter: "" };
  }
  const o = b as Record<string, unknown>;
  return {
    logoUrl: typeof o.logoUrl === "string" ? o.logoUrl : "",
    accentHex: typeof o.accentHex === "string" ? o.accentHex : "",
    emailFooter: typeof o.emailFooter === "string" ? o.emailFooter : "",
  };
}

export function BrandingPanel({ settings }: { settings: Json | undefined }) {
  const patch = usePatchTenantSettingsMutation();

  const form = useForm<BrandingForm>({
    resolver: zodResolver(brandingSchema),
    defaultValues: readBranding(settings),
  });

  useEffect(() => {
    form.reset(readBranding(settings));
  }, [settings, form]);

  return (
    <Card className="border-border/80 bg-card/90 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Paintbrush className="h-5 w-5 text-primary" aria-hidden />
          Branding
        </CardTitle>
        <CardDescription>
          Logo URL, accent token, and transactional email footer copy. Values merge into tenant{" "}
          <span className="font-mono text-xs">settings.branding</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-4 max-w-xl"
            onSubmit={form.handleSubmit((vals) => {
              const prev =
                settings && typeof settings === "object" && !Array.isArray(settings)
                  ? (settings as Record<string, unknown>)
                  : {};
              const nextSettings = {
                ...prev,
                branding: {
                  logoUrl: vals.logoUrl || null,
                  accentHex: vals.accentHex?.replace(/^#/, "") || null,
                  emailFooter: vals.emailFooter ?? "",
                },
              };
              patch.mutate(
                { settings: nextSettings },
                {
                  onSuccess: () => toast.success("Branding saved"),
                  onError: (e) => toast.error(e.message),
                },
              );
            })}
          >
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" placeholder="https://…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accentHex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accent color</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" placeholder="#9AD0FF" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emailFooter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email footer</FormLabel>
                  <FormControl>
                    <Input className="bg-surface-inner" placeholder="Company legal · unsubscribe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" variant="cta" disabled={patch.isPending}>
              Save branding
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
