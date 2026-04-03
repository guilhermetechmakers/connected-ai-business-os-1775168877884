-- Optional health / remediation fields for integration connectors (idempotent).

ALTER TABLE public.connectors
  ADD COLUMN IF NOT EXISTS last_error_message text;

ALTER TABLE public.connectors
  ADD COLUMN IF NOT EXISTS last_error_remediation text;

COMMENT ON COLUMN public.connectors.last_error_message IS 'Last integration or sync error (no secrets).';
COMMENT ON COLUMN public.connectors.last_error_remediation IS 'Actionable remediation hint for operators.';
