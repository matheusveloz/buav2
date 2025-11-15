-- Verificar e criar política de UPDATE para user_audios
-- Este script permite que usuários atualizem seus próprios áudios

-- Verificar se a política já existe
DO $$
BEGIN
  -- Primeiro, verificar se RLS está habilitado
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_audios'
  ) THEN
    RAISE NOTICE 'Tabela user_audios não encontrada!';
    RETURN;
  END IF;

  -- Habilitar RLS se não estiver habilitado
  ALTER TABLE public.user_audios ENABLE ROW LEVEL SECURITY;
  RAISE NOTICE 'RLS habilitado para user_audios';

  -- Remover política UPDATE antiga se existir
  DROP POLICY IF EXISTS "Users can update own audios" ON public.user_audios;
  DROP POLICY IF EXISTS "update_own_audios" ON public.user_audios;
  DROP POLICY IF EXISTS "Users can update their own audios" ON public.user_audios;
  RAISE NOTICE 'Políticas antigas de UPDATE removidas (se existiam)';

  -- Criar nova política de UPDATE
  CREATE POLICY "Users can update their own audios"
    ON public.user_audios
    FOR UPDATE
    TO authenticated
    USING (user_email = auth.jwt() ->> 'email')
    WITH CHECK (user_email = auth.jwt() ->> 'email');
  
  RAISE NOTICE 'Nova política de UPDATE criada com sucesso!';

  -- Verificar políticas de SELECT (necessária para o .select() após update)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_audios'
    AND policyname LIKE '%select%'
    AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "Users can view their own audios"
      ON public.user_audios
      FOR SELECT
      TO authenticated
      USING (user_email = auth.jwt() ->> 'email');
    
    RAISE NOTICE 'Política de SELECT criada';
  ELSE
    RAISE NOTICE 'Política de SELECT já existe';
  END IF;

END $$;

-- Verificar as políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_audios'
ORDER BY policyname;

