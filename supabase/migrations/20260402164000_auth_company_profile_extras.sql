-- Optional company/profile fields for auth UI (idempotent)

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industry text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS allowed_auth_methods text[] NOT NULL DEFAULT ARRAY['email', 'google', 'microsoft']::text[];

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
