export interface LandingPricingTier {
  id: string;
  name: string;
  /** Display label e.g. "$2.5k" or "Custom" */
  price: string;
  period: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
}

export interface LandingFeatureCard {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface LandingTestimonial {
  id: string;
  logoUrl: string;
  quote: string;
  author: string;
  role: string;
}

export type LogoVariant = "light" | "dark" | "favicon" | "social";

export interface LogoAsset {
  id: string;
  variant: LogoVariant;
  url: string;
}

export interface CompareFeatureRow {
  id: string;
  capability: string;
  starter: boolean | string;
  growth: boolean | string;
  enterprise: boolean | string;
}

export interface LandingMarketingBundle {
  features: LandingFeatureCard[];
  testimonials: LandingTestimonial[];
  pricing: LandingPricingTier[];
}

export interface LandingNavLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface LandingCta {
  label: string;
  href: string;
}
