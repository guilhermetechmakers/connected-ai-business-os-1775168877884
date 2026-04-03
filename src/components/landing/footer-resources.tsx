import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import type { LandingNavLink } from "@/types/landing-content";

const demoSchema = z.object({
  email: z.string().email("Enter a valid email"),
  company: z.string().min(1, "Company is required").max(200),
  message: z.string().max(2000).optional(),
});

type DemoForm = z.infer<typeof demoSchema>;

export interface FooterResourcesProps {
  links: LandingNavLink[];
  className?: string;
}

export function FooterResources({ links, className }: FooterResourcesProps) {
  const safeLinks = Array.isArray(links) ? links : [];
  const form = useForm<DemoForm>({
    resolver: zodResolver(demoSchema),
    defaultValues: { email: "", company: "", message: "" },
  });

  const onDemoSubmit = (values: DemoForm) => {
    toast.success("Demo request received", {
      description: `We’ll follow up at ${values.email}. (Wire to CRM when backend is ready.)`,
    });
    form.reset();
  };

  return (
    <footer
      className={cn("border-t border-border/60 px-6 py-16 lg:px-16 xl:px-24", className)}
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <h2 className="font-display text-2xl font-bold text-foreground">Resources</h2>
          <nav className="flex flex-col gap-3 text-sm" aria-label="Footer">
            {safeLinks.map((l) => {
              if (l.external) {
                return (
                  <a
                    key={l.label + l.href}
                    href={l.href}
                    className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                    rel="noreferrer"
                    target="_blank"
                  >
                    {l.label}
                  </a>
                );
              }
              if (l.href.startsWith("#")) {
                return (
                  <a
                    key={l.label + l.href}
                    href={l.href}
                    className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    {l.label}
                  </a>
                );
              }
              return (
                <Link
                  key={l.label + l.href}
                  to={l.href}
                  className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              to="/privacy"
              className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Terms
            </Link>
          </nav>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Connected AI Business OS. Tenant-scoped by design.
          </p>
        </div>
        <div id="demo" className="scroll-mt-28 lg:col-span-7">
          <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-card md:p-8">
            <h3 className="font-display text-xl font-semibold text-foreground">
              Book a demo
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Share your work email and we’ll coordinate a walkthrough. No passwords collected here.
            </p>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onDemoSubmit)}
                className="mt-6 space-y-4"
                noValidate
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Work email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          className="bg-surface-inner"
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Acme Inc."
                          className="bg-surface-inner"
                          aria-invalid={fieldState.invalid}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Message (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Integrations, compliance, timeline…"
                          className="min-h-[100px] resize-y bg-surface-inner"
                          aria-invalid={fieldState.invalid}
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
                  className="w-full sm:w-auto"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Sending…" : "Request demo"}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </footer>
  );
}
