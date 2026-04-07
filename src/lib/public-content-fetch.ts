import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import type { Database } from "@/types/database";

type PricingRow = Database["public"]["Tables"]["marketing_pricing_tiers"]["Row"];
type FeatureRow = Database["public"]["Tables"]["marketing_feature_highlights"]["Row"];
type TestimonialRow = Database["public"]["Tables"]["marketing_testimonials"]["Row"];

function getSupabaseRestConfig(): { base: string; key: string } | null {
  if (!isSupabaseConfigured) return null;
  return { base: supabaseUrl.replace(/\/$/, ""), key: supabaseAnonKey };
}

async function restSelect<T>(path: string): Promise<T[]> {
  const cfg = getSupabaseRestConfig();
  if (!cfg) return [];
  try {
    const res = await fetch(`${cfg.base}/rest/v1/${path}`, {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    });
    if (!res.ok) return [];
    const json: unknown = await res.json();
    return Array.isArray(json) ? (json as T[]) : [];
  } catch {
    return [];
  }
}

async function tryApiPath<T>(relativePath: string): Promise<T[] | null> {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw !== "string" || !raw) return null;
  const base = raw.replace(/\/$/, "");
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  try {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const data = (json as { data?: unknown })?.data ?? json;
    if (Array.isArray(data)) return data as T[];
    return null;
  } catch {
    return null;
  }
}

/** GET /api/pricing or /pricing — returns raw rows or tier-shaped objects. */
export async function fetchMarketingPricingTiers(): Promise<PricingRow[]> {
  const fromDb = await restSelect<PricingRow>(
    "marketing_pricing_tiers?select=*&order=sort_order.asc",
  );
  if (fromDb.length > 0) return fromDb;

  const fromApi =
    (await tryApiPath<PricingRow>("/api/pricing")) ??
    (await tryApiPath<PricingRow>("/pricing"));
  if (fromApi && fromApi.length > 0) return fromApi;

  return [];
}

export async function fetchMarketingFeatureHighlights(): Promise<FeatureRow[]> {
  const fromDb = await restSelect<FeatureRow>(
    "marketing_feature_highlights?select=*&order=sort_order.asc",
  );
  if (fromDb.length > 0) return fromDb;

  const fromApi =
    (await tryApiPath<FeatureRow>("/api/features")) ??
    (await tryApiPath<FeatureRow>("/features"));
  if (fromApi && fromApi.length > 0) return fromApi;

  return [];
}

export async function fetchMarketingTestimonials(): Promise<TestimonialRow[]> {
  const fromDb = await restSelect<TestimonialRow>(
    "marketing_testimonials?select=*&order=sort_order.asc",
  );
  if (fromDb.length > 0) return fromDb;

  const fromApi =
    (await tryApiPath<TestimonialRow>("/api/testimonials")) ??
    (await tryApiPath<TestimonialRow>("/testimonials"));
  if (fromApi && fromApi.length > 0) return fromApi;

  return [];
}

export interface LogoAssetDto {
  id: string;
  variant: string;
  url: string;
}

export async function fetchLogoAssets(): Promise<LogoAssetDto[]> {
  const fromApi =
    (await tryApiPath<LogoAssetDto>("/api/logo-assets")) ??
    (await tryApiPath<LogoAssetDto>("/logo-assets"));
  return Array.isArray(fromApi) ? fromApi : [];
}
