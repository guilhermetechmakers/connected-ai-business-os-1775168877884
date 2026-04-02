import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  name: z.string().min(2),
  binding: z.string().min(2),
  permissions: z.string().min(2),
});

export default function CreateModulePage() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", binding: "unified_entities.deal", permissions: "" },
  });

  return (
    <AnimatedPage className="space-y-8">
      <PageHeader
        title="Create module"
        description="Metadata, data model binding, permissions, preview, and publish to the tenant registry."
      />
      <Card className="border-border/80 bg-card/90 shadow-card">
        <CardHeader>
          <CardTitle>Module manifest</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) =>
                toast.success("Module staged", { description: v.name }),
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="binding"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data binding</FormLabel>
                    <FormControl>
                      <Input className="bg-surface-inner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permissions JSON</FormLabel>
                    <FormControl>
                      <Textarea rows={4} className="bg-surface-inner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3">
                <Button type="submit" variant="cta">
                  Publish
                </Button>
                <Button type="button" variant="outline">
                  Preview
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AnimatedPage>
  );
}
