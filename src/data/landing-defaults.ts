import type {
  CompareFeatureRow,
  LandingFeatureCard,
  LandingMarketingBundle,
  LandingPricingTier,
  LandingTestimonial,
} from "@/types/landing-content";

export const DEFAULT_LANDING_FEATURES: LandingFeatureCard[] = [
  {
    id: "integrations",
    icon: "plug",
    title: "Integrations",
    description:
      "OAuth and API-key connectors with health, sync logs, and mapping—CRM, PM, finance, docs, and chat in one tenant layer.",
  },
  {
    id: "ai-workspace",
    icon: "sparkles",
    title: "AI Workspace",
    description:
      "RAG with citations, audited threads, and permission-gated actions so teams get answers without bypassing policy.",
  },
  {
    id: "workflows",
    icon: "workflow",
    title: "Workflows",
    description:
      "Triggers, conditions, approvals, and retries automate cross-system work with full execution visibility.",
  },
  {
    id: "dashboards",
    icon: "layout-dashboard",
    title: "Dashboards",
    description:
      "Widget-driven layouts, KPI cards, and executive views scoped by role—single pane for fragmented operations.",
  },
];

export const DEFAULT_LANDING_TESTIMONIALS: LandingTestimonial[] = [
  {
    id: "t1",
    logoUrl: "",
    quote:
      "We stopped rebuilding internal tools per client. Onboarding dropped from quarters to weeks.",
    author: "Jordan Lee",
    role: "COO, Meridian Ops",
  },
  {
    id: "t2",
    logoUrl: "",
    quote:
      "Executive briefs and risk signals finally sit on top of the same data our teams execute on.",
    author: "Priya Shah",
    role: "CEO, Northline Collective",
  },
  {
    id: "t3",
    logoUrl: "",
    quote:
      "Workflow approvals across Slack and HubSpot just work - audit trail included.",
    author: "Alex Rivera",
    role: "VP Operations, Harborstack",
  },
];

export const DEFAULT_LANDING_PRICING: LandingPricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$499",
    period: "per month · up to 25 seats",
    features: [
      "Core integrations (3)",
      "Global dashboard",
      "AI Workspace (Ask mode)",
      "Standard support",
    ],
    cta: { label: "Sign up", href: "/auth/signup-invite" },
  },
  {
    id: "growth",
    name: "Growth",
    price: "$2,500",
    period: "per month · up to 50 seats",
    features: [
      "Unlimited integrations",
      "Advanced workflows & approvals",
      "Department workspaces",
      "AI Analyze & Report modes",
    ],
    cta: { label: "Start trial", href: "/auth/signup-invite" },
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "annual contract · SAML & VPC options",
    features: [
      "Dedicated support & SLAs",
      "Custom connectors",
      "Impersonation & audit exports",
      "Solution engineering",
    ],
    cta: { label: "Contact sales", href: "/#demo" },
  },
];

export const DEFAULT_LANDING_BUNDLE: LandingMarketingBundle = {
  features: DEFAULT_LANDING_FEATURES,
  testimonials: DEFAULT_LANDING_TESTIMONIALS,
  pricing: DEFAULT_LANDING_PRICING,
};

export const COMPARE_FEATURE_MATRIX: CompareFeatureRow[] = [
  {
    id: "row-1",
    capability: "Tenant isolation & RLS",
    starter: true,
    growth: true,
    enterprise: true,
  },
  {
    id: "row-2",
    capability: "Integrations & sync logs",
    starter: "3 connectors",
    growth: "Unlimited",
    enterprise: "Custom SLA",
  },
  {
    id: "row-3",
    capability: "Workflows & approvals",
    starter: false,
    growth: true,
    enterprise: true,
  },
  {
    id: "row-4",
    capability: "AI Workspace modes",
    starter: "Ask",
    growth: "Ask, Analyze, Report",
    enterprise: "Full + Action (gated)",
  },
  {
    id: "row-5",
    capability: "SSO (SAML/OIDC)",
    starter: false,
    growth: "Add-on",
    enterprise: true,
  },
  {
    id: "row-6",
    capability: "Audit export",
    starter: false,
    growth: "30 days",
    enterprise: "Custom retention",
  },
];

/** Alias for React Query hooks and pages that expect this name */
export const DEFAULT_COMPARE_MATRIX = COMPARE_FEATURE_MATRIX;

