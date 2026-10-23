-- ============================================================
-- Storage
-- ============================================================
-- Public buckets: files are readable by URL (recipe photos are shown to friends),
-- but only the owner can list, upload or delete files in their own folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', true), ('avatars', 'avatars', true);

CREATE POLICY "Users can upload their own recipe images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Users can view their own recipe image files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Users can delete their own recipe images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
CREATE POLICY "Users can view their own avatar files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
