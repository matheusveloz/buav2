-- =====================================================
-- ATUALIZAR CONSTRAINT PARA ACEITAR MODELOS GEMINI
-- Adiciona suporte para Nano Banana (Gemini) models
-- =====================================================

-- Remover constraint antiga
ALTER TABLE public.generated_images 
DROP CONSTRAINT IF EXISTS generated_images_model_check;

-- Adicionar constraint nova que aceita todos os modelos
ALTER TABLE public.generated_images 
ADD CONSTRAINT generated_images_model_check 
CHECK (model IN (
  'newport-flux',                        -- v1-fast (Newport AI)
  'dall-e-3',                           -- DALL-E 3 (legado, se usado)
  'gpt-image-1',                        -- OpenAI DALL-E (rota /dalle)
  'gemini-2.5-flash-image-preview',     -- Nano Banana text-to-image
  'gemini-2.5-flash-image-edit'         -- Nano Banana image-to-image
));

-- Comentário atualizado
COMMENT ON COLUMN public.generated_images.model IS 
'Modelos suportados:
- newport-flux: v1-fast (Newport AI)
- gpt-image-1: DALL-E (OpenAI)
- gemini-2.5-flash-image-preview: Nano Banana text-to-image (v2-quality)
- gemini-2.5-flash-image-edit: Nano Banana image edit (v2-quality)';

-- Verificar constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'generated_images_model_check';

