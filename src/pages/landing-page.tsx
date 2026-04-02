import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { AnimatedPage } from "@/components/animated-page";
import { cn } from "@/lib/utils";
import { PublicChrome } from "@/components/layout/public-chrome";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Unified operational context",
    body: "Normalize CRM, PM, finance, and docs into one tenant-scoped layer with source metadata and permissions.",
  },
  {
    title: "Workflows across your stack",
    body: "Triggers, approvals, retries, and execution logs connect systems without replacing them.",
  },
  {
    title: "Role-aware AI workspace",
    body: "RAG with citations, audited conversations, and gated actions aligned to enterprise policies.",
  },
];

const testimonials = [
  {
    quote:
      "We stopped rebuilding internal tools per client. Onboarding dropped from quarters to weeks.",
    name: "Jordan Lee",
    role: "COO, Meridian Ops",
  },
  {
    quote:
      "Executive briefs and risk signals finally sit on top of the same data our teams execute on.",
    name: "Priya Shah",
    role: "CEO, Northline Collective",
  },
];

const tiers = [
  {
    name: "Growth",
    price: "$2.5k",
    detail: "per month · up to 50 seats",
    bullets: ["Core integrations", "Dashboards & modules", "AI workspace (Ask)"],
  },
  {
    name: "Scale",
    price: "$6k",
    detail: "per month · up to 200 seats",
    bullets: [
      "Advanced workflows",
      "Executive AI briefs",
      "Priority connector roadmap",
    ],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    detail: "SAML, VPC, dedicated support",
    bullets: ["Custom SLAs", "Impersonation & audit exports", "Solution engineering"],
  },
];

export default function LandingPage() {
  return (
    <PublicChrome>
      <AnimatedPage>
        <section className="relative overflow-hidden px-6 pb-24 pt-16 lg:px-24 lg:pt-24">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-16 lg:grid-cols-12 lg:items-center">
              <div className="space-y-8 lg:col-span-7">
                <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Multi-tenant business OS
                </p>
                <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-6xl lg:text-7xl">
                  Orchestrate your{" "}
                  <span className="text-gradient-accent">SaaS stack</span> with
                  grounded AI
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                  Connect tools, normalize context, automate cross-system work, and
                  give every role a safe AI copilot scoped to tenant data and
                  permissions.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button variant="cta" size="lg" asChild>
                    <Link to="/signup">
                      Start free trial
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <Link to="/login">View demo tenant</Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    SOC2-ready audit trails
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Row-level tenant isolation
                  </span>
                </div>
              </div>
              <div className="lg:col-span-5">
                <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">
                      Live operations pulse
                    </CardTitle>
                    <CardDescription>
                      KPIs, workflows, and AI signals in one pane.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: "Integrations healthy", value: "12 / 12" },
                      { label: "Workflow success (24h)", value: "99.2%" },
                      { label: "AI actions pending approval", value: "3" },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-inner px-4 py-3"
                      >
                        <span className="text-sm text-muted-foreground">
                          {row.label}
                        </span>
                        <span className="font-mono text-sm text-primary">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border/60 px-6 py-24 lg:px-24">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="max-w-2xl space-y-4">
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Built for fragmented operations
              </h2>
              <p className="text-lg text-muted-foreground">
                Department workspaces, module registry, and AI that respects roles
                keep leadership and builders aligned.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {features.map((f) => (
                <Card
                  key={f.title}
                  className="border-border/80 bg-card/80 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <CardHeader>
                    <CardTitle className="font-display text-lg">{f.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {f.body}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-24 lg:px-24">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
            {testimonials.map((t) => (
              <Card
                key={t.name}
                className="border-border/80 bg-surface-inner/80 shadow-card"
              >
                <CardContent className="space-y-6 pt-8">
                  <p className="text-lg leading-relaxed text-foreground">
                    “{t.quote}”
                  </p>
                  <div>
                    <p className="font-semibold text-foreground">{t.name}</p>
                    <p className="text-sm text-muted-foreground">{t.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="pricing" className="border-t border-border/60 px-6 py-24 lg:px-24">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="max-w-2xl space-y-4">
              <h2 className="font-display text-3xl font-bold md:text-4xl">
                Pricing that scales with tenants
              </h2>
              <p className="text-lg text-muted-foreground">
                Start fast with templates, expand into custom modules and AI action
                policies as you grow.
              </p>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              {tiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={cn(
                    "border-border/80 bg-card/90 shadow-card transition-all duration-200 hover:-translate-y-1",
                    tier.highlight && "ring-2 ring-primary/40 shadow-card-hover",
                  )}
                >
                  <CardHeader>
                    <CardTitle className="font-display text-xl">{tier.name}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">
                        {tier.price}
                      </span>
                      <span className="block text-sm">{tier.detail}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {tier.bullets.map((b) => (
                        <li key={b} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={tier.highlight ? "cta" : "outline"}
                      className="w-full"
                      asChild
                    >
                      <Link to="/signup">Talk to sales</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </AnimatedPage>
    </PublicChrome>
  );
}
