-- Storage bucket + tenant-scoped policies for report export artifacts (CSV/PDF/JSON)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-exports',
  'report-exports',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'text/csv',
    'application/json'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS report_exports_insert_tenant ON storage.objects;
CREATE POLICY report_exports_insert_tenant ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-exports'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );

DROP POLICY IF EXISTS report_exports_select_tenant ON storage.objects;
CREATE POLICY report_exports_select_tenant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-exports'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );

DROP POLICY IF EXISTS report_exports_update_tenant ON storage.objects;
CREATE POLICY report_exports_update_tenant ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'report-exports'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'report-exports'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );

DROP POLICY IF EXISTS report_exports_delete_tenant ON storage.objects;
CREATE POLICY report_exports_delete_tenant ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'report-exports'
    AND split_part(name, '/', 1) = public.current_company_id()::text
  );
