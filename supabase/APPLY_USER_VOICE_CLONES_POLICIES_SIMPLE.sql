-- ================================================================
-- FIX SIMPLES: Desabilitar RLS temporariamente ou usar policy permissiva
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- OPÇÃO 1: Desabilitar RLS (mais simples, mas menos seguro)
-- ALTER TABLE public.user_voice_clones DISABLE ROW LEVEL SECURITY;

-- OPÇÃO 2: Policy permissiva para authenticated users (recomendado)
DROP POLICY IF EXISTS "user_voice_clones_insert_own" ON public.user_voice_clones;

CREATE POLICY "user_voice_clones_insert_own"
  ON public.user_voice_clones
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Permite qualquer usuário autenticado inserir

-- Verificar se a policy foi criada
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'user_voice_clones' 
  AND policyname = 'user_voice_clones_insert_own';

-- Resultado esperado:
-- policyname                       | cmd    | with_check
-- user_voice_clones_insert_own     | INSERT | true

