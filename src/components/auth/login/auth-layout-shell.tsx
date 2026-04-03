import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import { LandingNavBar } from "@/components/landing/landing-nav-bar";
import { cn } from "@/lib/utils";
import type { LandingNavLink } from "@/types/landing-content";

const AUTH_NAV_LINKS: LandingNavLink[] = [
  { label: "Platform", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Demo", href: "/#demo" },
  { label: "Sign in", href: "/login" },
];

function AuthShellFooter() {
  return (
    <footer className="border-t border-border/60 py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 lg:flex-row lg:justify-between lg:px-16">
        <p>© {new Date().getFullYear()} Connected AI Business OS</p>
        <div className="flex flex-wrap gap-6">
          <Link to="/privacy" className="transition-colors duration-150 hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="transition-colors duration-150 hover:text-foreground">
            Terms
          </Link>
          <Link to="/cookies" className="transition-colors duration-150 hover:text-foreground">
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}

export type AuthLayoutShellProps = {
  children: ReactNode;
  className?: string;
};

export function AuthLayoutShell({ children, className }: AuthLayoutShellProps) {
  return (
    <div className={cn("grid-bg flex min-h-screen flex-col", className)}>
      <LandingNavBar
        links={AUTH_NAV_LINKS}
        ctaPrimary={{ label: "Get started", href: "/auth/signup-invite" }}
      />
      <div className="relative flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute -left-32 top-24 h-[420px] w-[420px] rounded-full bg-primary/10 blur-3xl motion-safe:animate-mesh-drift motion-reduce:animate-none"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 right-[-20%] h-[520px] w-[520px] rounded-full bg-secondary/25 blur-3xl motion-safe:animate-mesh-drift motion-reduce:animate-none"
          style={{ animationDelay: "2.5s" }}
          aria-hidden
        />

        <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-6 pb-20 pt-10 lg:flex-row lg:items-stretch lg:gap-16 lg:px-16 lg:pb-24 lg:pt-14">
          <section className="flex flex-1 flex-col justify-center motion-safe:animate-slide-in-left motion-reduce:animate-none lg:max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              Connected AI Business OS
            </p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
              Sign in to your{" "}
              <span className="text-gradient-accent">unified operations</span> layer
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Orchestrate integrations, workflows, and tenant-grounded AI with enterprise-grade
              access controls. This gateway keeps every session scoped to the right company context.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success motion-safe:animate-pulse-live motion-reduce:animate-none"
                  aria-hidden
                />
                Role-aware authentication with optional SSO and OAuth providers.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success motion-safe:animate-pulse-live motion-reduce:animate-none"
                  aria-hidden
                />
                Audit-friendly sign-in events without exposing sensitive internals in the UI.
              </li>
            </ul>
          </section>

          <section className="flex w-full flex-1 items-start justify-center lg:max-w-lg lg:justify-end">
            <div className="w-full motion-safe:animate-fade-in-up motion-reduce:animate-none">
              {children}
            </div>
          </section>
        </div>
      </div>
      <AuthShellFooter />
    </div>
  );
}
