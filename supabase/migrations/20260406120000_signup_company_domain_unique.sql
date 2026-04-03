-- Signup / tenant domain hint uniqueness (idempotent)
-- Prevents duplicate workspace domain hints across companies when domain is set.

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_domain_unique_lower
  ON public.companies (lower(btrim(domain)))
  WHERE domain IS NOT NULL AND btrim(domain) <> '';
