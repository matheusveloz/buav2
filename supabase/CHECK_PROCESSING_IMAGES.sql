-- =====================================================
-- Verificar Imagens em Processamento
-- =====================================================

-- 1. Ver últimas imagens com status
SELECT 
    id,
    user_email,
    status,
    num_images,
    prompt,
    task_id,
    created_at,
    completed_at
FROM generated_images
ORDER BY created_at DESC
LIMIT 10;

-- 2. Ver imagens em processamento especificamente
SELECT 
    id,
    user_email,
    status,
    num_images,
    prompt,
    task_id,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_ago
FROM generated_images
WHERE status = 'processing'
ORDER BY created_at DESC;

-- 3. Ver se há imagens órfãs (processing há muito tempo)
SELECT 
    id,
    user_email,
    status,
    num_images,
    prompt,
    created_at,
    NOW() - created_at as age
FROM generated_images
WHERE status = 'processing'
    AND created_at < NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 4. Limpar imagens órfãs (processing há mais de 10 minutos)
-- DESCOMENTE para executar:
/*
UPDATE generated_images
SET status = 'failed',
    completed_at = NOW()
WHERE status = 'processing'
    AND created_at < NOW() - INTERVAL '10 minutes';
*/
