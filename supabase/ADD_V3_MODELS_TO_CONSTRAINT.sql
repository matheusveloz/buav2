-- =====================================================
-- ADD V3 MODELS TO GENERATED_IMAGES MODEL CONSTRAINT
-- =====================================================
-- Data: 2024-11-22
-- Descrição: Adiciona suporte aos novos modelos Nano Banana 2 (v3-high-quality)
--            na constraint de check da tabela generated_images
-- =====================================================

-- 1. Verificar constraint atual
DO $$ 
BEGIN
    RAISE NOTICE '🔍 Verificando constraint atual...';
END $$;

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'generated_images'::regclass
  AND conname LIKE '%model%';

-- 2. Remover constraint antiga (se existir)
DO $$ 
BEGIN
    -- Verificar se a constraint existe
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'generated_images'::regclass 
          AND conname = 'generated_images_model_check'
    ) THEN
        RAISE NOTICE '📝 Removendo constraint antiga: generated_images_model_check';
        ALTER TABLE generated_images DROP CONSTRAINT generated_images_model_check;
        RAISE NOTICE '✅ Constraint antiga removida!';
    ELSE
        RAISE NOTICE '⚠️ Constraint generated_images_model_check não existe';
    END IF;
END $$;

-- 3. Criar nova constraint com todos os modelos (incluindo v3)
DO $$ 
BEGIN
    RAISE NOTICE '🆕 Criando nova constraint com suporte a v3...';
    
    ALTER TABLE generated_images
    ADD CONSTRAINT generated_images_model_check
    CHECK (
        model IN (
            -- Newport AI (Flux) - v1-fast
            'newport-flux',
            'flux-text2image',
            'flux-image2image',
            
            -- Nano Banana (Gemini 2.5) - v2-quality
            'gemini-2.5-flash-image',
            'gemini-2.5-flash-image-preview',
            'gemini-2.5-flash-image-edit',
            'gpt-image-1',  -- Alias para v2
            
            -- Nano Banana 2 (Gemini 3 Pro) - v3-high-quality ✨ NOVO
            'gemini-3-pro-image-preview',
            'gemini-3-pro-image-edit',
            'gemini-3-pro-image',
            
            -- Legacy/Outros
            'dall-e-3',
            'midjourney',
            'stable-diffusion'
        )
    );
    
    RAISE NOTICE '✅ Nova constraint criada com sucesso!';
END $$;

-- 4. Verificar constraint atualizada
DO $$ 
BEGIN
    RAISE NOTICE '🔍 Verificando constraint atualizada...';
END $$;

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'generated_images'::regclass
  AND conname = 'generated_images_model_check';

-- 5. Verificar que os novos modelos são aceitos
DO $$ 
BEGIN
    RAISE NOTICE '✅ Novos modelos v3 adicionados à constraint!';
    RAISE NOTICE '   • gemini-3-pro-image-preview';
    RAISE NOTICE '   • gemini-3-pro-image-edit';
    RAISE NOTICE '   • gemini-3-pro-image';
END $$;

-- 6. Estatísticas de uso por modelo
DO $$ 
BEGIN
    RAISE NOTICE '📊 Estatísticas de uso por modelo:';
END $$;

SELECT 
    model,
    COUNT(*) as total_generations,
    SUM(num_images) as total_images,
    SUM(credits_used) as total_credits_used,
    ROUND(AVG(credits_used)::numeric, 2) as avg_credits_per_generation,
    MIN(created_at) as first_use,
    MAX(created_at) as last_use
FROM generated_images
WHERE deleted_at IS NULL
GROUP BY model
ORDER BY total_generations DESC;

-- 7. Resumo
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Modelos adicionados:';
    RAISE NOTICE '   • gemini-3-pro-image-preview (text-to-image v3)';
    RAISE NOTICE '   • gemini-3-pro-image-edit (image-to-image v3)';
    RAISE NOTICE '   • gemini-3-pro-image (genérico v3)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Ação necessária:';
    RAISE NOTICE '   Execute este script no Supabase SQL Editor';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Após executar:';
    RAISE NOTICE '   Tente gerar uma nova imagem com v3-high-quality';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- ROLLBACK (se necessário)
-- =====================================================
-- Para reverter esta migração, execute:
/*
ALTER TABLE generated_images DROP CONSTRAINT generated_images_model_check;

ALTER TABLE generated_images
ADD CONSTRAINT generated_images_model_check
CHECK (
    model IN (
        'newport-flux',
        'flux-text2image',
        'flux-image2image',
        'gemini-2.5-flash-image',
        'gemini-2.5-flash-image-preview',
        'gemini-2.5-flash-image-edit',
        'gpt-image-1',
        'dall-e-3',
        'midjourney',
        'stable-diffusion'
    )
);
*/

