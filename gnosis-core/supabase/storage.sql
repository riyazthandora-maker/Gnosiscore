-- ============================================================
-- GnosisCore — Supabase Storage Setup
-- Paste into SQL Editor AFTER schema.sql
-- ============================================================

-- Create the private documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,   -- 10 MB hard ceiling (Pro tier max; enforced in API too)
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/markdown']
)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage objects
-- Users can upload to their own folder: documents/<their-user-id>/...
DROP POLICY IF EXISTS "storage_user_insert" ON storage.objects;
CREATE POLICY "storage_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_user_select" ON storage.objects;
CREATE POLICY "storage_user_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "storage_user_delete" ON storage.objects;
CREATE POLICY "storage_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
