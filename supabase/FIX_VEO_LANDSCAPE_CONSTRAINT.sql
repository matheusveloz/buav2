-- ============================================================
-- FIX: Adicionar modelos VEO LANDSCAPE na constraint
-- ============================================================
-- Execute este script AGORA no SQL Editor do Supabase
-- ============================================================

-- 1. Remover a constraint antiga
ALTER TABLE generated_videos_sora 
DROP CONSTRAINT IF EXISTS generated_videos_sora_model_check;

-- 2. Adicionar nova constraint COM TODOS os modelos VEO (incluindo landscape)
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
    'veo-3.1-landscape',         -- Landscape Standard ($0.25)
    'veo-3.1-landscape-fast',    -- Landscape Fast ($0.15)
    
    -- ========== VEO 3.1 COM PREFIXO (backend adiciona) ==========
    'veo-veo-3.1-fl',            
    'veo-veo-3.1',
    'veo-veo-3.1-fast-fl',
    'veo-veo-3.1-fast',
    'veo-veo-3.1-landscape',     -- ⭐ ADICIONADO!
    'veo-veo-3.1-landscape-fast' -- ⭐ ADICIONADO!
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
  'veo-3.1-fl',
  'veo-3.1',
  'veo-3.1-fast-fl',
  'veo-3.1-fast',
  'veo-3.1-landscape',
  'veo-3.1-landscape-fast',
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
-- ✅ Constraint atualizada com modelos VEO LANDSCAPE
-- ✅ Agora aceita: veo-veo-3.1-landscape e veo-veo-3.1-landscape-fast
-- ✅ Veo 3.1 LANDSCAPE agora funcionando!
-- ============================================================

