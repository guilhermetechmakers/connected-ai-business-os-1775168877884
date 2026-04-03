-- Public marketing content for landing (read-only for anon). Idempotent.

CREATE TABLE IF NOT EXISTS public.marketing_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  name text NOT NULL,
  display_price text NOT NULL,
  period text NOT NULL DEFAULT 'per month',
  features text[] NOT NULL DEFAULT '{}'::text[],
  cta_label text NOT NULL DEFAULT 'Get started',
  cta_href text,
  is_highlighted boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_feature_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_key text NOT NULL DEFAULT 'Sparkles',
  title text NOT NULL,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url text,
  quote text NOT NULL,
  author text NOT NULL,
  role text NOT NULL,
  company_key text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_feature_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_pricing_tiers_public_select ON public.marketing_pricing_tiers;
CREATE POLICY marketing_pricing_tiers_public_select
  ON public.marketing_pricing_tiers
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS marketing_feature_highlights_public_select ON public.marketing_feature_highlights;
CREATE POLICY marketing_feature_highlights_public_select
  ON public.marketing_feature_highlights
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS marketing_testimonials_public_select ON public.marketing_testimonials;
CREATE POLICY marketing_testimonials_public_select
  ON public.marketing_testimonials
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.marketing_pricing_tiers TO anon, authenticated;
GRANT SELECT ON public.marketing_feature_highlights TO anon, authenticated;
GRANT SELECT ON public.marketing_testimonials TO anon, authenticated;
