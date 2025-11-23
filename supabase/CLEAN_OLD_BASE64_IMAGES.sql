-- =====================================================
-- Limpeza Rápida de Imagens Base64 Antigas
-- =====================================================
-- ATENÇÃO: Execute com cuidado! Isso remove dados permanentemente.
-- =====================================================

-- 1. Verificar quantas imagens serão afetadas
SELECT 
    COUNT(*) as total_to_clean,
    MIN(created_at) as oldest_image,
    MAX(created_at) as newest_image
FROM public.generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND image_urls::text LIKE '%data:image%'
    AND created_at < CURRENT_DATE - INTERVAL '7 days'; -- Mais antigas que 7 dias

-- 2. OPÇÃO A: Remover completamente registros antigos
-- DESCOMENTE para executar:
/*
DELETE FROM public.generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND image_urls::text LIKE '%data:image%'
    AND created_at < CURRENT_DATE - INTERVAL '7 days';
*/

-- 3. OPÇÃO B: Manter registros mas limpar as imagens (recomendado)
-- DESCOMENTE para executar:
/*
UPDATE public.generated_images
SET image_urls = '[{"imageUrl":"cleaned_for_performance","imageType":"png"}]'::jsonb
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND image_urls::text LIKE '%data:image%'
    AND created_at < CURRENT_DATE - INTERVAL '7 days';
*/

-- 4. OPÇÃO C: Limpar TODAS as imagens base64 (mais agressivo)
-- DESCOMENTE para executar:
/*
UPDATE public.generated_images
SET image_urls = '[{"imageUrl":"cleaned_for_performance","imageType":"png"}]'::jsonb
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND image_urls::text LIKE '%data:image%';
*/

-- 5. Verificar resultado
SELECT 
    COUNT(*) as remaining_base64_images,
    ROUND(SUM(LENGTH(image_urls::text)::numeric / 1024 / 1024), 2) as total_mb
FROM public.generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND image_urls::text LIKE '%data:image%';
