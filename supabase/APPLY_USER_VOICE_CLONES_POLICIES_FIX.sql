-- ================================================================
-- FIX: Policies para user_voice_clones funcionarem no servidor
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- Remover policies antigas
DROP POLICY IF EXISTS "user_voice_clones_select_own" ON public.user_voice_clones;
DROP POLICY IF EXISTS "user_voice_clones_insert_own" ON public.user_voice_clones;
DROP POLICY IF EXISTS "user_voice_clones_update_own" ON public.user_voice_clones;
DROP POLICY IF EXISTS "user_voice_clones_delete_own" ON public.user_voice_clones;

-- Criar policies que funcionam com service_role e authenticated
-- SELECT: permite usuário autenticado ver suas próprias vozes
CREATE POLICY "user_voice_clones_select_own"
  ON public.user_voice_clones
  FOR SELECT
  USING (
    auth.email() = user_email 
    OR auth.role() = 'service_role'
  );

-- INSERT: permite usuário autenticado e service_role inserir
CREATE POLICY "user_voice_clones_insert_own"
  ON public.user_voice_clones
  FOR INSERT
  WITH CHECK (
    auth.email() = user_email 
    OR auth.role() = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'email' = user_email
  );

-- UPDATE: permite usuário autenticado atualizar suas próprias vozes
CREATE POLICY "user_voice_clones_update_own"
  ON public.user_voice_clones
  FOR UPDATE
  USING (
    auth.email() = user_email 
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.email() = user_email 
    OR auth.role() = 'service_role'
  );

-- DELETE: permite usuário autenticado deletar suas próprias vozes
CREATE POLICY "user_voice_clones_delete_own"
  ON public.user_voice_clones
  FOR DELETE
  USING (
    auth.email() = user_email 
    OR auth.role() = 'service_role'
  );

-- Verificar policies criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_voice_clones'
ORDER BY policyname;

