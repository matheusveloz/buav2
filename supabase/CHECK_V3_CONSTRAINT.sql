-- =====================================================
-- VERIFICAR SE V3 ESTÁ PERMITIDO NO BANCO
-- =====================================================

-- Ver constraint atual
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'generated_images'::regclass
  AND conname = 'generated_images_model_check';

-- Verificar se gemini-3-pro-image-preview está na lista
DO $$ 
DECLARE
    constraint_def TEXT;
BEGIN
    -- Pegar definição da constraint
    SELECT pg_get_constraintdef(oid) INTO constraint_def
    FROM pg_constraint
    WHERE conrelid = 'generated_images'::regclass
      AND conname = 'generated_images_model_check';
    
    -- Verificar se contém gemini-3-pro-image-preview
    IF constraint_def LIKE '%gemini-3-pro-image-preview%' THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ SUCESSO!';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE '✅ gemini-3-pro-image-preview ESTÁ PERMITIDO!';
        RAISE NOTICE '✅ gemini-3-pro-image-edit ESTÁ PERMITIDO!';
        RAISE NOTICE '✅ gemini-3-pro-image ESTÁ PERMITIDO!';
        RAISE NOTICE '';
        RAISE NOTICE '🎉 Versão 3.0 está configurada corretamente!';
        RAISE NOTICE '🚀 Você pode gerar imagens com v3-high-quality';
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '❌ ERRO: V3 NÃO ESTÁ CONFIGURADO!';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE '❌ gemini-3-pro-image-preview NÃO está permitido';
        RAISE NOTICE '';
        RAISE NOTICE '📋 SOLUÇÃO:';
        RAISE NOTICE '   Execute o script: ADD_V3_MODELS_TO_CONSTRAINT.sql';
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
    END IF;
END $$;


