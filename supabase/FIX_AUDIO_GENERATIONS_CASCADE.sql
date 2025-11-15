-- ================================================================
-- FIX: Remover CASCADE para evitar deletar registros de geração
-- Quando o áudio é deletado, o registro de geração deve PERMANECER
-- Isso garante que o limite diário funcione corretamente
-- ================================================================

-- Passo 1: Remover a constraint existente com CASCADE
ALTER TABLE public.user_audio_generations
  DROP CONSTRAINT IF EXISTS fk_audio;

-- Passo 2: Recriar a foreign key SEM cascade (SET NULL em vez de CASCADE)
ALTER TABLE public.user_audio_generations
  ADD CONSTRAINT fk_audio 
  FOREIGN KEY (audio_id) 
  REFERENCES public.user_audios(id) 
  ON DELETE SET NULL;  -- Quando áudio deletado, audio_id vira NULL (mas registro permanece)

-- Verificar a constraint
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.user_audio_generations'::regclass
  AND conname = 'fk_audio';

-- Resultado esperado:
-- constraint_name | constraint_definition
-- fk_audio        | FOREIGN KEY (audio_id) REFERENCES user_audios(id) ON DELETE SET NULL

-- Testar: deletar um áudio e verificar que o registro de geração permanece
-- SELECT COUNT(*) FROM user_audio_generations WHERE user_email = 'seu-email@exemplo.com';
-- DELETE FROM user_audios WHERE id = '...';
-- SELECT COUNT(*) FROM user_audio_generations WHERE user_email = 'seu-email@exemplo.com';
-- O count deve continuar o mesmo!

