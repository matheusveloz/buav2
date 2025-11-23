-- =====================================================
-- Debug: Verificar Limite Diário FREE
-- =====================================================

-- 1. Ver suas imagens de hoje
SELECT 
    id,
    model,
    status,
    num_images,
    LEFT(prompt, 40) as prompt_preview,
    created_at
FROM generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- 2. Contar TOTAL de imagens criadas hoje (todas, incluindo deletadas/failed)
SELECT 
    SUM(num_images) as total_images_created_today,
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing
FROM generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND created_at >= CURRENT_DATE;

-- 3. Ver últimas 20 imagens (de todos os dias)
SELECT 
    TO_CHAR(created_at, 'YYYY-MM-DD') as date,
    model,
    status,
    num_images,
    LEFT(prompt, 30) as prompt_preview
FROM generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
ORDER BY created_at DESC
LIMIT 20;

-- 4. TESTE: Verificar se você tem v2-quality funcionando
SELECT 
    model,
    status,
    COUNT(*) as count,
    SUM(num_images) as total_images
FROM generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY model, status
ORDER BY model, status;
