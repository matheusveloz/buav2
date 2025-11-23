-- ==========================================
-- Adicionar colunas para Vercel Cron
-- ==========================================

-- 1. Adicionar coluna para armazenar imagens de referência
ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS reference_images JSONB;

-- 2. Adicionar coluna para aspect ratio (16:9, 1:1, etc)
ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(10);

-- 3. Criar índice para consultas rápidas do Cron
CREATE INDEX IF NOT EXISTS idx_generated_images_status_created 
ON generated_images(status, created_at DESC);

-- 4. Verificar as colunas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'generated_images' 
  AND column_name IN ('reference_images', 'aspect_ratio')
ORDER BY column_name;

-- ==========================================
-- Resultado esperado:
-- ==========================================
-- aspect_ratio     | character varying
-- reference_images | jsonb

