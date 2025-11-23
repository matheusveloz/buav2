-- ==================== CORREÇÃO: CONSTRAINT DE SECONDS ====================
-- A constraint atual só aceita: 4, 8, 12 (modelos OpenAI V1/V2)
-- Mas V3 (LaoZhang) usa: 10, 15 segundos
-- 
-- IMPORTANTE: Este script também corrige registros existentes com valores inválidos
-- Execute este SQL no Supabase SQL Editor
-- ===========================================================================

-- PASSO 1: Verificar valores atuais de seconds na tabela
SELECT seconds, COUNT(*) as total
FROM generated_videos_sora
GROUP BY seconds
ORDER BY seconds;

-- PASSO 2: Remover a constraint antiga
ALTER TABLE generated_videos_sora
DROP CONSTRAINT IF EXISTS generated_videos_sora_seconds_check;

-- PASSO 3: Corrigir registros com valores inválidos
-- (Se houver algum valor diferente de 4, 8, 10, 12, 15)

-- Normalizar valores próximos:
-- - valores <= 5 → 4
-- - valores entre 6-9 → 8
-- - valores entre 10-11 → 10
-- - valores entre 12-14 → 12
-- - valores >= 15 → 15

UPDATE generated_videos_sora
SET seconds = CASE
  WHEN seconds <= 5 THEN 4
  WHEN seconds >= 6 AND seconds <= 9 THEN 8
  WHEN seconds >= 10 AND seconds <= 11 THEN 10
  WHEN seconds >= 12 AND seconds <= 14 THEN 12
  WHEN seconds >= 15 THEN 15
  ELSE 10  -- fallback para qualquer outro valor
END
WHERE seconds NOT IN (4, 8, 10, 12, 15);

-- PASSO 4: Verificar se ainda há valores inválidos
SELECT seconds, COUNT(*) as total
FROM generated_videos_sora
WHERE seconds NOT IN (4, 8, 10, 12, 15)
GROUP BY seconds;

-- PASSO 5: Criar nova constraint com TODOS os valores suportados
ALTER TABLE generated_videos_sora
ADD CONSTRAINT generated_videos_sora_seconds_check
CHECK (seconds IN (4, 8, 10, 12, 15));

-- PASSO 6: Verificar se a constraint foi criada corretamente
SELECT conname, consrc
FROM pg_constraint
WHERE conrelid = 'generated_videos_sora'::regclass
  AND conname = 'generated_videos_sora_seconds_check';

-- PASSO 7: Adicionar comentário
COMMENT ON CONSTRAINT generated_videos_sora_seconds_check ON generated_videos_sora
IS 'Durações aceitas: 4s, 8s (OpenAI V1/V2) | 10s, 15s (LaoZhang V3) | 12s (ambos)';

-- ==================== RESULTADO ESPERADO ====================
-- ✅ Registros inválidos corrigidos
-- ✅ Constraint criada com sucesso
-- ✅ Aceita durações: 4, 8, 10, 12, 15 segundos
-- ✅ Compatível com V1, V2 e V3
-- ============================================================

