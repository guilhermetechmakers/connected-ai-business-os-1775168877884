-- User profile management: extended profile fields, API key lifecycle, avatars, TOTP enrollment (idempotent)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS contact_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_api_keys_status_check'
  ) THEN
    ALTER TABLE public.user_api_keys
      ADD CONSTRAINT user_api_keys_status_check
      CHECK (status IN ('active', 'revoked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_api_keys_profile_status
  ON public.user_api_keys (profile_id, status);

CREATE TABLE IF NOT EXISTS public.avatar_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  url text NOT NULL,
  size_bytes integer NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avatar_assets_profile ON public.avatar_assets (profile_id);

CREATE TABLE IF NOT EXISTS public.profile_totp_enrollment (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  secret_b32 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_totp_active (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  secret_b32 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.avatar_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_totp_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_totp_active ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avatar_assets_select_self ON public.avatar_assets;
CREATE POLICY avatar_assets_select_self ON public.avatar_assets
  FOR SELECT USING (profile_id = auth.uid() AND company_id = public.current_company_id());

DROP POLICY IF EXISTS profile_totp_enrollment_deny ON public.profile_totp_enrollment;
CREATE POLICY profile_totp_enrollment_deny ON public.profile_totp_enrollment
  FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS profile_totp_active_deny ON public.profile_totp_active;
CREATE POLICY profile_totp_active_deny ON public.profile_totp_active
  FOR ALL USING (false) WITH CHECK (false);

-- Storage bucket for avatars (public read; uploads scoped per user via policies)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_select_public ON storage.objects;
CREATE POLICY avatars_select_public ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
