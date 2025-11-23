-- ==========================================
-- UPDATE MODEL CONSTRAINT - BUUA V2
-- ==========================================
-- Este script atualiza a constraint do campo 'model' para incluir
-- os modelos da LaoZhang API (sora_video2-15s, sora_video2-landscape-15s, sora-2-pro-all)
--
-- Execute este script no SQL Editor do Supabase
-- ==========================================

-- 1. Verificar modelos existentes no banco (apenas para debug)
SELECT DISTINCT model, COUNT(*) as count
FROM generated_videos_sora
GROUP BY model
ORDER BY count DESC;

-- 2. Remover constraint antiga de 'model'
ALTER TABLE generated_videos_sora
DROP CONSTRAINT IF EXISTS generated_videos_sora_model_check;

-- 3. CORRIGIR DADOS EXISTENTES - Normalizar modelos inválidos
UPDATE generated_videos_sora
SET model = CASE
  -- Se for modelo LaoZhang com duração 10s
  WHEN model = 'sora_video2' THEN 'sora_video2-15s'
  WHEN model = 'sora_video2-landscape' THEN 'sora_video2-landscape-15s'
  
  -- Se for qualquer variação de "sora-2-pro" que não seja exatamente "sora-2-pro"
  WHEN model LIKE '%pro%' AND model != 'sora-2-pro' THEN 'sora-2-pro-all'
  
  -- Se já estiver correto, manter
  WHEN model IN ('sora-2', 'sora-2-pro', 'sora_video2-15s', 'sora_video2-landscape-15s', 'sora-2-pro-all') THEN model
  
  -- Fallback: se for desconhecido, converter para sora_video2-15s (padrão)
  ELSE 'sora_video2-15s'
END
WHERE model NOT IN ('sora-2', 'sora-2-pro', 'sora_video2-15s', 'sora_video2-landscape-15s', 'sora-2-pro-all');

-- 4. Criar nova constraint com TODOS os modelos suportados
ALTER TABLE generated_videos_sora
ADD CONSTRAINT generated_videos_sora_model_check
CHECK (model IN (
  -- OpenAI Models (originais)
  'sora-2',
  'sora-2-pro',
  
  -- LaoZhang Models (novos)
  'sora_video2-15s',              -- Retrato (9:16) - Standard
  'sora_video2-landscape-15s',    -- Paisagem (16:9) - Standard
  'sora-2-pro-all'                -- High Quality 4K (1024x1792)
));

-- 5. Verificar resultado
SELECT 
  '✅ Constraint atualizada com sucesso!' as status,
  'Modelos suportados: sora-2, sora-2-pro, sora_video2-15s, sora_video2-landscape-15s, sora-2-pro-all' as models;

-- 6. Verificar distribuição de modelos após a correção
SELECT DISTINCT model, COUNT(*) as count
FROM generated_videos_sora
GROUP BY model
ORDER BY count DESC;

