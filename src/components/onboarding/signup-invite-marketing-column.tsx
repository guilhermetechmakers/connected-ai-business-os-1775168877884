import { BarChart3, Bot, Link2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

const BULLETS = [
  {
    icon: Link2,
    title: "Orchestrate your stack",
    body: "Connect CRM, PM, finance, and chat without ripping out existing tools.",
  },
  {
    icon: BarChart3,
    title: "Unified operational context",
    body: "Dashboards, workflows, and reporting grounded in tenant-scoped data.",
  },
  {
    icon: Bot,
    title: "Role-aware AI",
    body: "RAG with citations, permission checks, and audited actions.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise posture",
    body: "Tenant isolation, SSO-ready auth, and structured onboarding.",
  },
] as const;

type SignupInviteMarketingColumnProps = {
  eyebrow?: string;
  headline: string;
  headlineAccent?: string;
  subhead: string;
  className?: string;
};

export function SignupInviteMarketingColumn({
  eyebrow = "Connected AI Business OS",
  headline,
  headlineAccent,
  subhead,
  className,
}: SignupInviteMarketingColumnProps) {
  return (
    <div
      className={cn(
        "relative space-y-10 lg:sticky lg:top-24 animate-slide-in-left",
        className,
      )}
    >
      <div className="pointer-events-none absolute -left-10 top-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl animate-mesh-drift" />
      <div className="relative space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
          {headline}
          {headlineAccent ? (
            <>
              {" "}
              <span className="text-gradient-accent">{headlineAccent}</span>
            </>
          ) : null}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {subhead}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {(BULLETS ?? []).map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-2xl border border-border/70 bg-card/40 p-4 shadow-card transition-all duration-150 hover:-translate-y-1 hover:border-primary/25 hover:shadow-card-hover"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg border border-secondary/40 bg-surface-inner">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <p className="font-display text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
