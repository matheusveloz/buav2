-- ============================================================
-- FIX FINAL: Adicionar TODOS os modelos VEO 3.1 na constraint
-- ============================================================
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Remover a constraint antiga
ALTER TABLE generated_videos_sora 
DROP CONSTRAINT IF EXISTS generated_videos_sora_model_check;

-- 2. Adicionar nova constraint COM TODOS os modelos VEO (incluindo landscape e -fl)
ALTER TABLE generated_videos_sora
ADD CONSTRAINT generated_videos_sora_model_check 
CHECK (
  model IN (
    -- ========== SORA 2 (v1.0 Buua Legado) ==========
    'sora_video2-15s',           -- Retrato 15s (Standard)
    'sora_video2-landscape-15s', -- Paisagem 15s (Standard)
    'sora-2-pro-all',            -- High Quality 4K
    
    -- ========== VEO 3.1 (v2.0 Buua High) ==========
    -- Retrato (9:16)
    'veo-3.1',                   -- Text-to-Video Standard ($0.25)
    'veo-3.1-fl',                -- Image-to-Video Standard ($0.25)
    'veo-3.1-fast',              -- Text-to-Video Fast ($0.15)
    'veo-3.1-fast-fl',           -- Image-to-Video Fast ($0.15)
    
    -- Landscape (16:9)
    'veo-3.1-landscape',         -- Text-to-Video Landscape Standard ($0.25)
    'veo-3.1-landscape-fl',      -- Image-to-Video Landscape Standard ($0.25) ⭐ ADICIONADO
    'veo-3.1-landscape-fast',    -- Text-to-Video Landscape Fast ($0.15)
    'veo-3.1-landscape-fast-fl', -- Image-to-Video Landscape Fast ($0.15) ⭐ ADICIONADO
    
    -- ========== VEO 3.1 COM PREFIXO (backend adiciona - LEGADO) ==========
    'veo-veo-3.1',
    'veo-veo-3.1-fl',            
    'veo-veo-3.1-fast',
    'veo-veo-3.1-fast-fl',
    'veo-veo-3.1-landscape',
    'veo-veo-3.1-landscape-fl',      -- ⭐ ADICIONADO
    'veo-veo-3.1-landscape-fast',
    'veo-veo-3.1-landscape-fast-fl'  -- ⭐ ADICIONADO
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
SELECT id, model, created_at, user_email
FROM generated_videos_sora
WHERE model NOT IN (
  'sora_video2-15s',
  'sora_video2-landscape-15s',
  'sora-2-pro-all',
  'veo-3.1',
  'veo-3.1-fl',
  'veo-3.1-fast',
  'veo-3.1-fast-fl',
  'veo-3.1-landscape',
  'veo-3.1-landscape-fl',
  'veo-3.1-landscape-fast',
  'veo-3.1-landscape-fast-fl',
  'veo-veo-3.1',
  'veo-veo-3.1-fl',
  'veo-veo-3.1-fast',
  'veo-veo-3.1-fast-fl',
  'veo-veo-3.1-landscape',
  'veo-veo-3.1-landscape-fl',
  'veo-veo-3.1-landscape-fast',
  'veo-veo-3.1-landscape-fast-fl'
)
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- ✅ Constraint atualizada com TODOS os modelos VEO 3.1
-- ✅ Agora aceita:
--    • veo-3.1 (retrato text-to-video)
--    • veo-3.1-fl (retrato image-to-video)
--    • veo-3.1-fast (retrato text-to-video fast)
--    • veo-3.1-fast-fl (retrato image-to-video fast)
--    • veo-3.1-landscape (landscape text-to-video)
--    • veo-3.1-landscape-fl (landscape image-to-video) ⭐
--    • veo-3.1-landscape-fast (landscape text-to-video fast)
--    • veo-3.1-landscape-fast-fl (landscape image-to-video fast) ⭐
-- ✅ Veo 3.1 COMPLETO funcionando!
-- ============================================================

