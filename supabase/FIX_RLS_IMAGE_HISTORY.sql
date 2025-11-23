-- =====================================================
-- FIX: RLS bloqueando acesso ao histórico de imagens
-- =====================================================
-- Problema: auth.jwt() retorna NULL na API server-side
-- Solução: Usar auth.uid() para validar usuário autenticado
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

-- 2. Garantir que RLS está habilitado
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- 3. Criar política para Service Role (usado pela API)
-- Service role tem acesso TOTAL - necessário para API funcionar
CREATE POLICY "Service role full access on generated_images"
  ON public.generated_images
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Criar política para usuários autenticados (SELECT)
-- Usa auth.uid() que funciona tanto no client quanto no server
CREATE POLICY "Users can view own images"
  ON public.generated_images
  FOR SELECT
  TO authenticated
  USING (
    user_email = (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- 5. Criar política para INSERT (usuários podem criar suas próprias imagens)
CREATE POLICY "Users can insert own images"
  ON public.generated_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_email = (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- 6. Criar política para UPDATE (usuários podem atualizar suas próprias imagens)
CREATE POLICY "Users can update own images"
  ON public.generated_images
  FOR UPDATE
  TO authenticated
  USING (
    user_email = (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    user_email = (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- 7. Criar política para DELETE (usuários podem deletar suas próprias imagens)
CREATE POLICY "Users can delete own images"
  ON public.generated_images
  FOR DELETE
  TO authenticated
  USING (
    user_email = (
      SELECT email 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- 8. Atualizar estatísticas
ANALYZE public.generated_images;

-- 9. Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'generated_images'
ORDER BY policyname;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- Você deve ver 5 políticas:
-- 1. Service role full access on generated_images (ALL, service_role)
-- 2. Users can view own images (SELECT, authenticated)
-- 3. Users can insert own images (INSERT, authenticated)  
-- 4. Users can update own images (UPDATE, authenticated)
-- 5. Users can delete own images (DELETE, authenticated)
-- =====================================================


