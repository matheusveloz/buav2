-- ================================================================
-- SCRIPT PARA ADICIONAR COLUNA generated_by_voice_api NA TABELA user_audios
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- Adiciona a coluna generated_by_voice_api se ela não existir
ALTER TABLE IF EXISTS public.user_audios
  ADD COLUMN IF NOT EXISTS generated_by_voice_api BOOLEAN NOT NULL DEFAULT false;

-- Verifica se a coluna foi criada
SELECT 
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_audios' 
  AND column_name = 'generated_by_voice_api';

-- Resultado esperado:
-- column_name              | data_type | column_default | is_nullable
-- generated_by_voice_api   | boolean   | false          | NO

