-- Company contact fields for Settings / company profile (idempotent)

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS contact_email text;
