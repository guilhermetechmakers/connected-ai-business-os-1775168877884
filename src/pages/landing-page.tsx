import { useMemo } from "react";

import { AnimatedPage } from "@/components/animated-page";
import {
  FeatureHighlightCard,
  LandingHero,
  PricingSection,
  TestimonialsCarousel,
} from "@/components/landing";
import { PublicChrome } from "@/components/layout/public-chrome";
import {
  DEFAULT_LANDING_BUNDLE,
  DEFAULT_LANDING_FEATURES,
} from "@/data/landing-defaults";
import { useLandingMarketingBundle } from "@/hooks/use-landing-marketing";

export default function LandingPage() {
  const { data } = useLandingMarketingBundle();

  const features = useMemo(() => {
    const list = data?.features ?? [];
    return Array.isArray(list) && list.length > 0 ? list : DEFAULT_LANDING_FEATURES;
  }, [data?.features]);

  const testimonials = useMemo(() => {
    const list = data?.testimonials ?? [];
    return Array.isArray(list) && list.length > 0
      ? list
      : (DEFAULT_LANDING_BUNDLE.testimonials ?? []);
  }, [data?.testimonials]);

  const pricing = useMemo(() => {
    const list = data?.pricing ?? [];
    return Array.isArray(list) && list.length > 0
      ? list
      : (DEFAULT_LANDING_BUNDLE.pricing ?? []);
  }, [data?.pricing]);

  const compareColumnLabels = useMemo<[string, string, string]>(() => {
    const a = pricing[0]?.name ?? "Starter";
    const b = pricing[1]?.name ?? "Growth";
    const c = pricing[2]?.name ?? "Enterprise";
    return [a, b, c];
  }, [pricing]);

  return (
    <PublicChrome extendedMarketingFooter showGridBackground>
      <AnimatedPage>
        <main id="main-content">
          <LandingHero
            title="Orchestrate your SaaS stack with grounded AI"
            highlightWords={["SaaS stack", "grounded AI"]}
            subtitle="Connect tools, normalize context, automate cross-system work, and give every role a safe AI copilot scoped to tenant data and permissions."
            ctaPrimary={{ label: "Sign up", href: "/auth/signup-invite" }}
            ctaSecondary={{ label: "Book demo", href: "/#demo" }}
          />

          <section
            id="features"
            className="border-t border-border/60 px-6 py-24 lg:px-16 xl:px-24"
            aria-labelledby="features-heading"
          >
            <div className="mx-auto max-w-6xl space-y-12">
              <div className="max-w-2xl space-y-4">
                <h2
                  id="features-heading"
                  className="font-display text-3xl font-bold md:text-4xl"
                >
                  Modular capabilities
                </h2>
                <p className="prose prose-invert max-w-none text-lg text-muted-foreground">
                  Integration-first orchestration with department workspaces, audited AI, and
                  dashboards that respect roles—without replacing your existing SaaS.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-12">
                {features.map((f, i) => (
                  <FeatureHighlightCard
                    key={f.id}
                    icon={f.icon}
                    title={f.title}
                    description={f.description}
                    className={cnBentoCell(i)}
                  />
                ))}
              </div>
            </div>
          </section>

          <TestimonialsCarousel items={testimonials} />

          <PricingSection tiers={pricing} compareColumnLabels={compareColumnLabels} />
        </main>
      </AnimatedPage>
    </PublicChrome>
  );
}

function cnBentoCell(index: number): string {
  const layouts = ["lg:col-span-7", "lg:col-span-5", "lg:col-span-5", "lg:col-span-7"];
  return layouts[index] ?? "lg:col-span-6";
}
