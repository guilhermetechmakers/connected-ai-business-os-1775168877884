import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Progress } from "@/components/ui/progress";

const schema = z.object({
  tenantName: z.string().min(2, "Company name required"),
  domainHint: z.string().optional(),
  fullName: z.string().min(2, "Name required"),
  email: z.string().email(),
  password: z.string().min(10, "Use at least 10 characters"),
  inviteToken: z.string().optional(),
  acceptTerms: z.boolean().refine((v) => v, {
    message: "Accept terms to continue",
  }),
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
  const [params] = useSearchParams();
  const invite = params.get("invite") ?? "";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantName: "",
      domainHint: "",
      fullName: "",
      email: "",
      password: "",
      inviteToken: invite,
      acceptTerms: false,
    },
  });

  const onSubmit = (values: FormValues) => {
    toast.success("Onboarding queued", {
      description: `${values.tenantName} · ${values.email} will receive verification.`,
    });
  };

  const pwd = form.watch("password");
  const strength = Math.min(100, (pwd?.length ?? 0) * 8);

  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <Card className="w-full max-w-xl border-border/80 bg-card/95 shadow-card">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="font-display text-2xl">
                  Create your workspace
                </CardTitle>
                <CardDescription>
                  Tenant creation or invite acceptance for the initial admin.
                </CardDescription>
              </div>
              <div className="hidden text-right text-xs text-muted-foreground sm:block">
                <p>Step 1 of 3</p>
                <Progress value={33} className="mt-2 h-1 w-28" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="tenantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant / company name</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="domainHint"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suggested domain (optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="acme.connected.ai"
                            className="bg-surface-inner"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="inviteToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite token</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Paste invite token if you have one"
                          className="bg-surface-inner"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave blank to create a new tenant as the owner.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin full name</FormLabel>
                        <FormControl>
                          <Input className="bg-surface-inner" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            className="bg-surface-inner"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          className="bg-surface-inner"
                          {...field}
                        />
                      </FormControl>
                      <Progress value={strength} className="h-1" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-lg border border-border/60 bg-surface-inner/60 p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Accept terms & data processing</FormLabel>
                        <FormDescription>
                          You agree to our <Link to="/terms">Terms</Link> and{" "}
                          <Link to="/privacy">Privacy</Link> policies.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="cta" className="w-full">
                  Continue to email verification
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </AnimatedPage>
    </PublicChrome>
  );
}
