-- ================================================================
-- SCRIPT PARA ADICIONAR CONSTRAINT UNIQUE NO voice_id
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- Passo 1: Remover duplicatas existentes (mantém o registro mais recente)
DELETE FROM public.user_voice_clones a
USING public.user_voice_clones b
WHERE a.id < b.id
  AND a.voice_id = b.voice_id;

-- Passo 2: Adicionar constraint UNIQUE no voice_id (ignora se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_voice_clones_voice_id_unique' 
      AND conrelid = 'public.user_voice_clones'::regclass
  ) THEN
    ALTER TABLE public.user_voice_clones
      ADD CONSTRAINT user_voice_clones_voice_id_unique UNIQUE (voice_id);
  END IF;
END $$;

-- Passo 3: Verificar se a constraint foi criada
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.user_voice_clones'::regclass
  AND conname = 'user_voice_clones_voice_id_unique';

-- Resultado esperado:
-- constraint_name                      | constraint_type | constraint_definition
-- user_voice_clones_voice_id_unique    | u               | UNIQUE (voice_id)

