import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AnimatedPage } from "@/components/animated-page";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  legalName: z.string().min(2),
  timezone: z.string(),
  currency: z.string(),
  departments: z.string().min(3, "List starter departments"),
});

type FormValues = z.infer<typeof schema>;

export default function CompanySetupPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: "",
      timezone: "America/New_York",
      currency: "USD",
      departments: "Revenue, Product, Operations",
    },
  });

  return (
    <PublicChrome>
      <AnimatedPage className="px-6 py-16 lg:px-24">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Onboarding
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold">Company setup</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Profile your tenant, choose operating context, and seed departments
              before connecting integrations.
            </p>
          </div>
          <Card className="border-border/80 bg-card/95 shadow-card">
            <CardHeader>
              <CardTitle>Tenant profile</CardTitle>
              <CardDescription>
                Logo upload maps to Supabase Storage in production.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((values) => {
                    toast.success("Company saved (simulated)", {
                      description: values.legalName,
                    });
                  })}
                  className="grid gap-6"
                >
                  <FormField
                    control={form.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal company name</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-surface-inner">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/New_York">
                                America/New_York
                              </SelectItem>
                              <SelectItem value="Europe/London">Europe/London</SelectItem>
                              <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                            </SelectContent>
                          </Select>
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
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-surface-inner">
                                <SelectValue placeholder="Select currency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="departments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department templates</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            className="bg-surface-inner"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" variant="cta">
                      Save & continue
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link to="/onboarding/integrations">Skip to integrations</Link>
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    </PublicChrome>
  );
}
