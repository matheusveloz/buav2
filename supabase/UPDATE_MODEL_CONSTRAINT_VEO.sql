-- ============================================================
-- ATUALIZAR CONSTRAINT DE MODEL PARA INCLUIR VEO 3.1
-- ============================================================
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Remover a constraint antiga
ALTER TABLE generated_videos_sora 
DROP CONSTRAINT IF EXISTS generated_videos_sora_model_check;

-- 2. Atualizar registros com modelos inválidos (se houver)
-- Normalizar modelos antigos para os novos padrões
UPDATE generated_videos_sora
SET model = CASE
  -- Modelos Sora 2 (v1.0)
  WHEN model LIKE '%sora%video%15%' OR model = 'sora_video2-15s' THEN 'sora_video2-15s'
  WHEN model LIKE '%sora%landscape%' OR model = 'sora_video2-landscape-15s' THEN 'sora_video2-landscape-15s'
  WHEN model LIKE '%sora-2-pro%' OR model LIKE '%pro%all%' THEN 'sora-2-pro-all'
  
  -- Modelos Veo 3.1 (v2.0) - NOVOS!
  WHEN model LIKE '%veo-3.1-fl%' THEN 'veo-3.1-fl'
  WHEN model LIKE '%veo-3.1-fast-fl%' THEN 'veo-3.1-fast-fl'
  WHEN model LIKE '%veo-3.1%' AND model NOT LIKE '%fl%' AND model NOT LIKE '%fast%' THEN 'veo-3.1'
  WHEN model LIKE '%veo-3.1-fast%' AND model NOT LIKE '%fl%' THEN 'veo-3.1-fast'
  
  -- Fallback para modelos antigos
  WHEN model = 'sora-2-pro' THEN 'sora-2-pro-all'
  WHEN model = 'sora-2' THEN 'sora_video2-15s'
  ELSE model
END
WHERE model NOT IN (
  'sora_video2-15s',
  'sora_video2-landscape-15s', 
  'sora-2-pro-all',
  'veo-3.1-fl',
  'veo-3.1',
  'veo-3.1-fast-fl',
  'veo-3.1-fast'
);

-- 3. Adicionar nova constraint com modelos Veo 3.1
ALTER TABLE generated_videos_sora
ADD CONSTRAINT generated_videos_sora_model_check 
CHECK (
  model IN (
    -- ========== SORA 2 (v1.0 Buua Legado) ==========
    'sora_video2-15s',           -- Retrato 15s (Standard)
    'sora_video2-landscape-15s', -- Paisagem 15s (Standard)
    'sora-2-pro-all',            -- High Quality 4K
    
    -- ========== VEO 3.1 (v2.0 Buua High) ==========
    'veo-3.1-fl',                -- Image-to-Video Standard ($0.25)
    'veo-3.1',                   -- Text-to-Video Standard ($0.25)
    'veo-3.1-fast-fl',           -- Image-to-Video Fast ($0.15)
    'veo-3.1-fast',              -- Text-to-Video Fast ($0.15)
    
    -- Prefixos para identificação no frontend
    'veo-veo-3.1-fl',            -- Com prefixo (caso backend adicione)
    'veo-veo-3.1',
    'veo-veo-3.1-fast-fl',
    'veo-veo-3.1-fast',
    'veo-veo-3.1-landscape',     -- Landscape Standard
    'veo-veo-3.1-landscape-fast' -- Landscape Fast
  )
);

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

-- Listar todos os modelos únicos atualmente no banco
SELECT DISTINCT model, COUNT(*) as count
FROM generated_videos_sora
GROUP BY model
ORDER BY count DESC;

-- Verificar se há algum modelo inválido após a atualização
SELECT id, model, created_at
FROM generated_videos_sora
WHERE model NOT IN (
  'sora_video2-15s',
  'sora_video2-landscape-15s',
  'sora-2-pro-all',
  'veo-3.1-fl',
  'veo-3.1',
  'veo-3.1-fast-fl',
  'veo-3.1-fast',
  'veo-veo-3.1-fl',
  'veo-veo-3.1',
  'veo-veo-3.1-fast-fl',
  'veo-veo-3.1-fast',
  'veo-veo-3.1-landscape',
  'veo-veo-3.1-landscape-fast'
)
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- ✅ Constraint atualizada com modelos Veo 3.1
-- ✅ Registros antigos normalizados
-- ✅ Veo 3.1 agora funcionando!
-- ============================================================

