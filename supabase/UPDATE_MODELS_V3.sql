-- ==================== VERSÃO 3.0 - SUPORTE AOS MODELOS LAOZHANG ====================
-- Adicionar novos modelos V3 (LaoZhang) na constraint da tabela
-- Execute este SQL no Supabase SQL Editor
-- ==================================================================================

-- 1. Remover a constraint antiga
ALTER TABLE generated_videos_sora
DROP CONSTRAINT IF EXISTS generated_videos_sora_model_check;

-- 2. Criar nova constraint com TODOS os modelos (V1, V2 e V3)
ALTER TABLE generated_videos_sora
ADD CONSTRAINT generated_videos_sora_model_check
CHECK (model IN (
  -- V1/V2 (OpenAI - Legado)
  'sora-2',
  'sora-2-pro',
  -- V3 (LaoZhang - Novo)
  'sora_video2',
  'sora_video2-landscape',
  'sora_video2-15s',
  'sora_video2-landscape-15s'
));

-- 3. Verificar se a constraint foi criada corretamente
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'generated_videos_sora'::regclass
  AND conname = 'generated_videos_sora_model_check';

-- ==================== RESULTADO ESPERADO ====================
-- Deve mostrar a constraint com todos os 6 modelos
-- ============================================================

COMMENT ON CONSTRAINT generated_videos_sora_model_check ON generated_videos_sora
IS 'Aceita modelos V1/V2 (OpenAI) e V3 (LaoZhang): sora-2, sora-2-pro, sora_video2, sora_video2-landscape, sora_video2-15s, sora_video2-landscape-15s';

-- ==================== SUCESSO! ====================
-- ✅ Constraint atualizada
-- ✅ 6 modelos suportados
-- ✅ Compatível com V1, V2 e V3
-- ==================================================


