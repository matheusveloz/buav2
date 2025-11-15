-- ================================================================
-- POLICIES PARA user_audio_generations
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- Habilitar RLS
ALTER TABLE public.user_audio_generations ENABLE ROW LEVEL SECURITY;

-- Policy para INSERT (permitir usuários autenticados e service_role)
DROP POLICY IF EXISTS "user_audio_generations_insert" ON public.user_audio_generations;
CREATE POLICY "user_audio_generations_insert"
  ON public.user_audio_generations
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Permitir qualquer insert de usuário autenticado

-- Policy para SELECT (usuários podem ver suas próprias gerações)
DROP POLICY IF EXISTS "user_audio_generations_select_own" ON public.user_audio_generations;
CREATE POLICY "user_audio_generations_select_own"
  ON public.user_audio_generations
  FOR SELECT
  TO authenticated
  USING (auth.email() = user_email OR auth.role() = 'service_role');

-- Verificar policies criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'user_audio_generations'
ORDER BY policyname;

-- Testar insert
-- SELECT auth.email(); -- Ver qual é seu email
-- INSERT INTO user_audio_generations (user_email) VALUES ('seu-email@exemplo.com');
-- SELECT * FROM user_audio_generations WHERE user_email = 'seu-email@exemplo.com';

