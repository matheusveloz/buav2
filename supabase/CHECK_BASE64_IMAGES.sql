-- =====================================================
-- Verificar imagens base64 que precisam migração
-- =====================================================

-- 1. Verificar tamanho total dos dados do usuário problema
SELECT 
    user_email,
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_records,
    ROUND(SUM(LENGTH(image_urls::text)::numeric / 1024 / 1024), 2) as total_size_mb,
    ROUND(AVG(LENGTH(image_urls::text)::numeric / 1024), 2) as avg_size_kb_per_record
FROM public.generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
GROUP BY user_email;

-- 2. Verificar quantas imagens são base64 vs Storage URLs
WITH image_analysis AS (
    SELECT 
        id,
        user_email,
        created_at,
        jsonb_array_length(image_urls) as num_images,
        image_urls,
        CASE 
            WHEN image_urls::text LIKE '%data:image%' THEN 'base64'
            WHEN image_urls::text LIKE '%supabase%' THEN 'storage'
            ELSE 'unknown'
        END as storage_type,
        LENGTH(image_urls::text) as data_size
    FROM public.generated_images
    WHERE user_email = 'empresa.stnnetwork@gmail.com'
        AND status = 'completed'
        AND image_urls IS NOT NULL
)
SELECT 
    storage_type,
    COUNT(*) as record_count,
    SUM(num_images) as total_images,
    ROUND(SUM(data_size)::numeric / 1024 / 1024, 2) as total_mb,
    ROUND(AVG(data_size)::numeric / 1024, 2) as avg_kb
FROM image_analysis
GROUP BY storage_type
ORDER BY storage_type;

-- 3. Listar os 10 maiores registros (candidatos para migração prioritária)
SELECT 
    id,
    created_at,
    jsonb_array_length(image_urls) as num_images,
    ROUND(LENGTH(image_urls::text)::numeric / 1024 / 1024, 2) as size_mb,
    LEFT(prompt, 50) || '...' as prompt_preview
FROM public.generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND status = 'completed'
    AND image_urls::text LIKE '%data:image%'
ORDER BY LENGTH(image_urls::text) DESC
LIMIT 10;

-- 4. Verificar distribuição por dia (para planejar migração)
SELECT 
    DATE(created_at) as date,
    COUNT(*) as records,
    SUM(jsonb_array_length(image_urls)) as total_images,
    ROUND(SUM(LENGTH(image_urls::text))::numeric / 1024 / 1024, 2) as total_mb
FROM public.generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND status = 'completed'
    AND image_urls::text LIKE '%data:image%'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;

-- SOLUÇÃO TEMPORÁRIA: Limpar imagens antigas
-- CUIDADO: Isso APAGA os dados! Faça backup primeiro!
/*
-- Apagar imagens mais antigas que 30 dias
DELETE FROM public.generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND created_at < CURRENT_DATE - INTERVAL '30 days'
    AND image_urls::text LIKE '%data:image%';

-- Ou converter para NULL (mantém registro mas remove imagens)
UPDATE public.generated_images
SET image_urls = NULL
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND created_at < CURRENT_DATE - INTERVAL '30 days'
    AND image_urls::text LIKE '%data:image%';
*/
