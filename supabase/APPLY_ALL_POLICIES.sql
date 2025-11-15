-- ================================================================
-- SCRIPT COMPLETO PARA APLICAR TODAS AS POLICIES NO SUPABASE
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- ================================================================
-- 1. ATIVAR RLS EM TODAS AS TABELAS
-- ================================================================
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 2. POLICIES PARA user_avatars
-- ================================================================

-- Permitir INSERT
DROP POLICY IF EXISTS "user_avatars_insert_own" ON public.user_avatars;
CREATE POLICY "user_avatars_insert_own"
  ON public.user_avatars FOR INSERT
  TO authenticated
  WITH CHECK (auth.email() = user_email);

-- Permitir SELECT
DROP POLICY IF EXISTS "user_avatars_select_own" ON public.user_avatars;
CREATE POLICY "user_avatars_select_own"
  ON public.user_avatars FOR SELECT
  TO authenticated
  USING (auth.email() = user_email);

-- Permitir DELETE
DROP POLICY IF EXISTS "user_avatars_delete_own" ON public.user_avatars;
CREATE POLICY "user_avatars_delete_own"
  ON public.user_avatars FOR DELETE
  TO authenticated
  USING (auth.email() = user_email);

-- ================================================================
-- 3. POLICIES PARA user_audios
-- ================================================================

-- Permitir INSERT
DROP POLICY IF EXISTS "user_audios_insert_own" ON public.user_audios;
CREATE POLICY "user_audios_insert_own"
  ON public.user_audios FOR INSERT
  TO authenticated
  WITH CHECK (auth.email() = user_email);

-- Permitir SELECT
DROP POLICY IF EXISTS "user_audios_select_own" ON public.user_audios;
CREATE POLICY "user_audios_select_own"
  ON public.user_audios FOR SELECT
  TO authenticated
  USING (auth.email() = user_email);

-- Permitir DELETE
DROP POLICY IF EXISTS "user_audios_delete_own" ON public.user_audios;
CREATE POLICY "user_audios_delete_own"
  ON public.user_audios FOR DELETE
  TO authenticated
  USING (auth.email() = user_email);

-- ================================================================
-- 4. POLICIES PARA videos
-- ================================================================

-- Permitir INSERT
DROP POLICY IF EXISTS "videos_insert_own" ON public.videos;
CREATE POLICY "videos_insert_own"
  ON public.videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.email() = user_email);

-- Permitir SELECT
DROP POLICY IF EXISTS "videos_select_own" ON public.videos;
CREATE POLICY "videos_select_own"
  ON public.videos FOR SELECT
  TO authenticated
  USING (auth.email() = user_email);

-- Permitir UPDATE
DROP POLICY IF EXISTS "videos_update_own" ON public.videos;
CREATE POLICY "videos_update_own"
  ON public.videos FOR UPDATE
  TO authenticated
  USING (auth.email() = user_email);

-- Permitir DELETE
DROP POLICY IF EXISTS "videos_delete_own" ON public.videos;
CREATE POLICY "videos_delete_own"
  ON public.videos FOR DELETE
  TO authenticated
  USING (auth.email() = user_email);

-- ================================================================
-- 5. POLICIES PARA emails (permitir atualização de créditos)
-- ================================================================

-- Permitir SELECT próprio perfil
DROP POLICY IF EXISTS "emails_select_own" ON public.emails;
CREATE POLICY "emails_select_own"
  ON public.emails FOR SELECT
  TO authenticated
  USING (auth.email() = email);

-- Permitir UPDATE próprio perfil (para desconto de créditos)
DROP POLICY IF EXISTS "emails_update_own" ON public.emails;
CREATE POLICY "emails_update_own"
  ON public.emails FOR UPDATE
  TO authenticated
  USING (auth.email() = email);

-- ================================================================
-- 6. POLICIES PARA STORAGE (buckets)
-- ================================================================

-- BUCKET: audio
DROP POLICY IF EXISTS "audio_bucket_insert" ON storage.objects;
CREATE POLICY "audio_bucket_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio');

DROP POLICY IF EXISTS "audio_bucket_select" ON storage.objects;
CREATE POLICY "audio_bucket_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio');

DROP POLICY IF EXISTS "audio_bucket_delete" ON storage.objects;
CREATE POLICY "audio_bucket_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio');

-- BUCKET: avatars
DROP POLICY IF EXISTS "avatars_bucket_insert" ON storage.objects;
CREATE POLICY "avatars_bucket_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_bucket_select" ON storage.objects;
CREATE POLICY "avatars_bucket_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_bucket_delete" ON storage.objects;
CREATE POLICY "avatars_bucket_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

-- BUCKET: videos
DROP POLICY IF EXISTS "videos_bucket_insert" ON storage.objects;
CREATE POLICY "videos_bucket_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_bucket_select" ON storage.objects;
CREATE POLICY "videos_bucket_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_bucket_delete" ON storage.objects;
CREATE POLICY "videos_bucket_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'videos');

-- ================================================================
-- 6. VERIFICAÇÃO FINAL
-- ================================================================

-- Listar todas as policies das tabelas
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_avatars', 'user_audios', 'videos')
ORDER BY tablename, policyname;

-- Listar todas as policies de storage
SELECT * FROM storage.policies 
ORDER BY name;

