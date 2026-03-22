-- ============================================================
-- STORAGE — Event Photos bucket
-- Run this in the Supabase SQL Editor after schema_media.sql.
-- ============================================================

-- Create a public bucket for event photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-photos', 'event-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin_all_event_photos" ON storage.objects
  FOR ALL
  USING  (bucket_id = 'event-photos')
  WITH CHECK (bucket_id = 'event-photos');

-- Create a public bucket for page featured images
INSERT INTO storage.buckets (id, name, public)
VALUES ('page-images', 'page-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "admin_all_page_images" ON storage.objects
  FOR ALL
  USING  (bucket_id = 'page-images')
  WITH CHECK (bucket_id = 'page-images');
