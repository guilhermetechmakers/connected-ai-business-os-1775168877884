import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { LandingHeroChart } from "./landing-hero-chart";

export interface LandingHeroCta {
  label: string;
  href: string;
}

export interface LandingHeroProps {
  title: string;
  highlightWords: string[];
  subtitle: string;
  ctaPrimary: LandingHeroCta;
  ctaSecondary: LandingHeroCta;
  illustration?: ReactNode;
  trustBadges?: string[];
  className?: string;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedTitle(title: string, highlightWords: string[]) {
  const words = Array.isArray(highlightWords) ? highlightWords.filter((w) => w?.trim()) : [];
  if (words.length === 0) {
    return title;
  }
  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
  const parts = title.split(pattern);
  return parts.map((part, i) => {
    const isHit = words.some((w) => w.toLowerCase() === part.toLowerCase());
    if (isHit) {
      return (
        <span key={`${part}-${i}`} className="text-gradient-accent">
          {part}
        </span>
      );
    }
    return <span key={`${part}-${i}`}>{part}</span>;
  });
}

export function LandingHero({
  title,
  highlightWords,
  subtitle,
  ctaPrimary,
  ctaSecondary,
  illustration,
  trustBadges,
  className,
}: LandingHeroProps) {
  const badges =
    Array.isArray(trustBadges) && trustBadges.length > 0
      ? trustBadges
      : [
          "SOC2-ready audit trails",
          "Row-level tenant isolation",
        ];

  const defaultIllustration = (
    <Card className="border-border/80 bg-card/90 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover motion-reduce:transform-none">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-display text-xl">Operations pulse</CardTitle>
          <span className="relative flex h-2.5 w-2.5" aria-label="Live">
            <span className="absolute inline-flex h-full w-full animate-pulse-live rounded-full bg-success/40 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
          </span>
        </div>
        <CardDescription>
          KPI trend, integrations, and AI signals in one surface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LandingHeroChart />
        <div className="space-y-2">
          {(
            [
              { label: "Integrations healthy", value: "12 / 12" },
              { label: "Workflow success (24h)", value: "99.2%" },
              { label: "AI actions pending approval", value: "3" },
            ] as const
          ).map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-surface-inner px-4 py-3"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="font-mono text-sm text-primary">{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <section
      className={cn(
        "relative overflow-hidden px-6 pb-24 pt-16 lg:px-24 lg:pt-24",
        className,
      )}
      aria-labelledby="landing-hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40 motion-reduce:animate-none motion-safe:animate-mesh-drift"
        aria-hidden
      >
        <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-secondary/30 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-16 lg:grid-cols-12 lg:items-center">
          <div className="space-y-8 lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Multi-tenant business OS
            </p>
            <h1
              id="landing-hero-heading"
              className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground md:text-6xl lg:text-[clamp(3.5rem,5vw,5.5rem)]"
            >
              {renderHighlightedTitle(title, highlightWords)}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              {subtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="cta" size="lg" asChild>
                {ctaPrimary.href.startsWith("#") ? (
                  <a href={ctaPrimary.href}>{ctaPrimary.label}</a>
                ) : (
                  <Link to={ctaPrimary.href}>{ctaPrimary.label}</Link>
                )}
              </Button>
              <Button variant="outline" size="lg" asChild>
                {ctaSecondary.href.startsWith("#") ? (
                  <a href={ctaSecondary.href}>{ctaSecondary.label}</a>
                ) : (
                  <Link to={ctaSecondary.href}>{ctaSecondary.label}</Link>
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              {badges.map((b) => (
                <span key={b} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                  {b}
                </span>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">{illustration ?? defaultIllustration}</div>
        </div>
      </div>
    </section>
  );
}
