-- =====================================================
-- FIX DEFINITIVO: Permission denied for table users
-- =====================================================
-- Problema: Políticas RLS estão tentando acessar auth.users
-- que não tem permissão para service_role
-- Solução: Service role não precisa de RLS (bypass)
-- =====================================================

-- 1. Remover TODAS as políticas existentes de generated_images
DROP POLICY IF EXISTS "Users can view own generated images" ON public.generated_images;
DROP POLICY IF EXISTS "Users can view own images" ON public.generated_images;
DROP POLICY IF EXISTS "Service role full access on generated_images" ON public.generated_images;
DROP POLICY IF EXISTS "Users can insert own generated images" ON public.generated_images;
DROP POLICY IF EXISTS "Users can insert own images" ON public.generated_images;
DROP POLICY IF EXISTS "Users can update own generated images" ON public.generated_images;
DROP POLICY IF EXISTS "Users can update own images" ON public.generated_images;
DROP POLICY IF EXISTS "Users can delete own images" ON public.generated_images;
DROP POLICY IF EXISTS "Users can delete own generated images" ON public.generated_images;

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para Service Role (usado pela API)
-- Service role BYPASSA RLS completamente - não faz subqueries
CREATE POLICY "Service role full access on generated_images"
  ON public.generated_images
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Criar políticas SIMPLES para usuários autenticados
-- IMPORTANTE: Não usar subquery para auth.users!
-- Usar apenas auth.jwt() que não precisa de acesso ao banco

-- SELECT: Ver suas próprias imagens
CREATE POLICY "Users can view own images"
  ON public.generated_images
  FOR SELECT
  TO authenticated
  USING (user_email = (auth.jwt() ->> 'email'));

-- INSERT: Criar suas próprias imagens
CREATE POLICY "Users can insert own images"
  ON public.generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (user_email = (auth.jwt() ->> 'email'));

-- UPDATE: Atualizar suas próprias imagens
CREATE POLICY "Users can update own images"
  ON public.generated_images
  FOR UPDATE
  TO authenticated
  USING (user_email = (auth.jwt() ->> 'email'))
  WITH CHECK (user_email = (auth.jwt() ->> 'email'));

-- DELETE: Deletar suas próprias imagens
CREATE POLICY "Users can delete own images"
  ON public.generated_images
  FOR DELETE
  TO authenticated
  USING (user_email = (auth.jwt() ->> 'email'));

-- 5. Atualizar estatísticas
ANALYZE public.generated_images;

-- 6. Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'generated_images'
ORDER BY policyname;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- ✅ Service role full access on generated_images (ALL, service_role)
-- ✅ Users can view own images (SELECT, authenticated)
-- ✅ Users can insert own images (INSERT, authenticated)  
-- ✅ Users can update own images (UPDATE, authenticated)
-- ✅ Users can delete own images (DELETE, authenticated)
-- =====================================================

-- =====================================================
-- POR QUE FUNCIONA AGORA:
-- =====================================================
-- ❌ ANTES: Usava subquery (SELECT email FROM auth.users WHERE id = auth.uid())
--    → auth.users precisa de permissão explícita
--    → Service role não consegue acessar auth.users
--    → ERRO: permission denied for table users
--
-- ✅ AGORA: Usa apenas auth.jwt() ->> 'email'
--    → Não faz subquery no banco
--    → Pega email diretamente do JWT token
--    → Service role bypassa RLS completamente
--    → API funciona perfeitamente!
-- =====================================================


