-- Adicionar constraint UNIQUE no voice_id da tabela user_voice_clones
-- Isso permite que o upsert funcione corretamente no código de clone

-- Remover duplicatas existentes (manter o registro mais recente)
DELETE FROM public.user_voice_clones a
USING public.user_voice_clones b
WHERE a.id < b.id
  AND a.voice_id = b.voice_id;

-- Adicionar constraint UNIQUE (ignora se já existir)
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

