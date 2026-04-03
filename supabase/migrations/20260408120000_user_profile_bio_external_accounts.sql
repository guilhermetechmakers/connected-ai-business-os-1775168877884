-- User profile: bio, external account usage metadata (idempotent)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE public.external_accounts
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_external_accounts_profile_revoked
  ON public.external_accounts (profile_id, revoked);

COMMENT ON COLUMN public.profiles.bio IS 'Optional user biography / notes (tenant-scoped profile).';
COMMENT ON COLUMN public.external_accounts.last_used_at IS 'Last successful OAuth/SSO sign-in using this binding.';
COMMENT ON COLUMN public.external_accounts.revoked IS 'Soft-revoke flag; retained for audit when not deleted.';
