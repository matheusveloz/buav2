-- =====================================================
-- ATUALIZAR CONSTRAINT PARA ACEITAR gpt-image-1
-- =====================================================

-- Remover constraint antiga
ALTER TABLE public.generated_images 
DROP CONSTRAINT IF EXISTS generated_images_model_check;

-- Adicionar constraint nova que aceita gpt-image-1
ALTER TABLE public.generated_images 
ADD CONSTRAINT generated_images_model_check 
CHECK (model IN ('newport-flux', 'dall-e-3', 'gpt-image-1'));

-- Comentário atualizado
COMMENT ON COLUMN public.generated_images.model IS 'Modelo usado: newport-flux (v1-fast), dall-e-3 ou gpt-image-1 (v2-quality)';

