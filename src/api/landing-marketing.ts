import {
  DEFAULT_LANDING_BUNDLE,
} from "@/data/landing-defaults";
import type {
  LandingFeatureCard,
  LandingMarketingBundle,
  LandingPricingTier,
  LandingTestimonial,
} from "@/types/landing-content";

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function normalizeFeature(raw: unknown): LandingFeatureCard | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const icon =
    typeof raw.icon === "string"
      ? raw.icon
      : typeof raw.icon_key === "string"
        ? raw.icon_key
        : "layers";
  const title = typeof raw.title === "string" ? raw.title : "";
  const description = typeof raw.description === "string" ? raw.description : "";
  if (!id || !title) return null;
  return { id, icon, title, description };
}

function normalizeTestimonial(raw: unknown): LandingTestimonial | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const logoUrl =
    typeof raw.logoUrl === "string"
      ? raw.logoUrl
      : typeof raw.logo_url === "string"
        ? raw.logo_url
        : "";
  const quote = typeof raw.quote === "string" ? raw.quote : "";
  const author =
    typeof raw.author === "string"
      ? raw.author
      : typeof raw.name === "string"
        ? raw.name
        : "";
  const role =
    typeof raw.role === "string"
      ? raw.role
      : typeof raw.title === "string"
        ? raw.title
        : "";
  if (!id || !quote || !author) return null;
  return { id, logoUrl, quote, author, role };
}

function normalizePricingTier(raw: unknown): LandingPricingTier | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const name = typeof raw.name === "string" ? raw.name : "";
  const period = typeof raw.period === "string" ? raw.period : "monthly";
  const features = asStringArray(raw.features);
  const ctaRaw = raw.cta;
  const ctaFromNested = isRecord(ctaRaw)
    ? {
        label: typeof ctaRaw.label === "string" ? ctaRaw.label : "Get started",
        href: typeof ctaRaw.href === "string" ? ctaRaw.href : "/auth/signup-invite",
      }
    : null;
  const cta =
    ctaFromNested ??
    (typeof raw.cta_label === "string" || typeof raw.cta_href === "string"
      ? {
          label:
            typeof raw.cta_label === "string" && raw.cta_label.trim()
              ? raw.cta_label
              : "Get started",
          href:
            typeof raw.cta_href === "string" && raw.cta_href.trim()
              ? raw.cta_href
              : "/auth/signup-invite",
        }
      : { label: "Get started", href: "/auth/signup-invite" });
  let priceStr = "";
  if (typeof raw.display_price === "string" && raw.display_price.trim()) {
    priceStr = raw.display_price.trim();
  } else if (typeof raw.price === "string") {
    priceStr = raw.price;
  } else if (typeof raw.price === "number" && Number.isFinite(raw.price)) {
    priceStr =
      raw.price > 0 ? `$${raw.price.toLocaleString("en-US")}` : "Custom";
  }
  if (!priceStr && typeof raw.priceLabel === "string") {
    priceStr = raw.priceLabel;
  }
  if (!priceStr) priceStr = "Custom";

  const highlight =
    raw.highlight === true ||
    raw.is_highlighted === true ||
    raw.is_highlighted === "true";

  if (!id || !name) return null;
  return {
    id,
    name,
    price: priceStr,
    period,
    features,
    cta,
    highlight,
  };
}

export function normalizeMarketingBundlePayload(
  payload: unknown,
): LandingMarketingBundle {
  const base = DEFAULT_LANDING_BUNDLE;
  if (!isRecord(payload)) return base;

  const featuresRaw = payload.features ?? payload.featureCards;
  const featuresList = Array.isArray(featuresRaw) ? featuresRaw : [];
  const features = featuresList
    .map(normalizeFeature)
    .filter((x): x is LandingFeatureCard => x !== null);

  const testimonialsRaw = payload.testimonials ?? payload.items;
  const testimonialsList = Array.isArray(testimonialsRaw)
    ? testimonialsRaw
    : [];
  const testimonials = testimonialsList
    .map(normalizeTestimonial)
    .filter((x): x is LandingTestimonial => x !== null);

  const pricingRaw = payload.pricing ?? payload.tiers;
  const pricingList = Array.isArray(pricingRaw) ? pricingRaw : [];
  const pricing = pricingList
    .map(normalizePricingTier)
    .filter((x): x is LandingPricingTier => x !== null);

  return {
    features: features.length > 0 ? features : base.features,
    testimonials:
      testimonials.length > 0 ? testimonials : base.testimonials,
    pricing: pricing.length > 0 ? pricing : base.pricing,
  };
}

const getApiBase = () =>
  (import.meta.env.VITE_API_URL ?? "http://localhost:3000/api").replace(
    /\/$/,
    "",
  );

async function fetchJsonSafe<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchSupabaseMarketingBundle(): Promise<unknown | null> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anon?.trim()) return null;
  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/functions/v1/marketing-api`,
      {
        method: "GET",
        headers: {
          apikey: anon,
          Authorization: `Bearer ${anon}`,
        },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * Loads marketing content from Edge Function (preferred), REST stubs, or static defaults.
 */
export async function fetchLandingMarketingBundle(): Promise<LandingMarketingBundle> {
  const edgePayload = await fetchSupabaseMarketingBundle();
  if (edgePayload !== null) {
    return normalizeMarketingBundlePayload(edgePayload);
  }

  const [pRes, fRes, tRes] = await Promise.all([
    fetchJsonSafe<unknown>("/pricing"),
    fetchJsonSafe<unknown>("/features"),
    fetchJsonSafe<unknown>("/testimonials"),
  ]);

  const pricingData = pRes && isRecord(pRes) ? pRes.data ?? pRes.pricing : pRes;
  const featuresData = fRes && isRecord(fRes) ? fRes.data ?? fRes.features : fRes;
  const testimonialsData =
    tRes && isRecord(tRes) ? tRes.data ?? tRes.testimonials : tRes;

  const pricingList = Array.isArray(pricingData) ? pricingData : [];
  const featuresList = Array.isArray(featuresData) ? featuresData : [];
  const testimonialsList = Array.isArray(testimonialsData)
    ? testimonialsData
    : [];

  const merged = {
    pricing: pricingList,
    features: featuresList,
    testimonials: testimonialsList,
  };

  const hasAny =
    merged.pricing.length > 0 ||
    merged.features.length > 0 ||
    merged.testimonials.length > 0;

  if (!hasAny) return DEFAULT_LANDING_BUNDLE;

  return normalizeMarketingBundlePayload(merged);
}
