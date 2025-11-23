-- =====================================================
-- Adicionar Soft Delete para Imagens
-- =====================================================

-- 1. Adicionar coluna deleted_at
ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_generated_images_deleted_at 
ON generated_images(deleted_at) 
WHERE deleted_at IS NOT NULL;

-- 3. Criar índice composto para contagem diária (ignorando deletadas)
CREATE INDEX IF NOT EXISTS idx_generated_images_user_created_active 
ON generated_images(user_email, created_at DESC) 
WHERE deleted_at IS NULL;

-- Verificar estrutura
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'generated_images'
    AND column_name IN ('id', 'deleted_at', 'status', 'created_at')
ORDER BY ordinal_position;
