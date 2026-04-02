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
import { Separator } from "@/components/ui/separator";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: FormValues) => {
    toast.message("Sign-in simulated", {
      description: `${values.email} · Connect Supabase Auth to go live.`,
    });
  };

  return (
    <PublicChrome>
      <AnimatedPage className="flex justify-center px-6 py-16 lg:px-24">
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-card">
          <CardHeader className="space-y-2">
            <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
            <CardDescription>
              Tenant-aware sign-in with SSO-ready hooks. Use your work email for
              the correct workspace context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="w-full">
                Google
              </Button>
              <Button type="button" variant="outline" className="w-full">
                Microsoft
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
              <Separator className="flex-1" />
              or email
              <Separator className="flex-1" />
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          className="bg-surface-inner"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <Link
                          to="/password-reset"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          className="bg-surface-inner"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" variant="cta">
                  Sign in
                </Button>
              </form>
            </Form>
            <p className="text-center text-sm text-muted-foreground">
              New tenant?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Create workspace
              </Link>
            </p>
          </CardContent>
        </Card>
      </AnimatedPage>
    </PublicChrome>
  );
}
