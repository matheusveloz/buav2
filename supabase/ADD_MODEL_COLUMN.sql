-- =====================================================
-- ADICIONAR COLUNA MODEL À TABELA generated_images
-- Para suportar múltiplos modelos (Newport Flux, gpt-image-1, etc.)
-- =====================================================

-- Adicionar coluna model (valores possíveis: 'newport-flux', 'gpt-image-1')
ALTER TABLE public.generated_images 
ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'newport-flux' CHECK (model IN ('newport-flux', 'gpt-image-1'));

-- Comentário
COMMENT ON COLUMN public.generated_images.model IS 'Modelo usado: newport-flux (v1-fast) ou gpt-image-1 (v2-quality)';

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_generated_images_model ON public.generated_images(model);

