-- =====================================================
-- Verificação Simplificada do Storage
-- =====================================================

-- 1. Verificar se o bucket existe e suas configurações
SELECT 
    id as bucket_name,
    name as display_name,
    public as is_public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'generated-images';

-- 2. Verificar se há arquivos no bucket
SELECT 
    COUNT(*) as total_files,
    MAX(created_at) as last_upload
FROM storage.objects
WHERE bucket_id = 'generated-images';

-- 3. Ver últimos 5 arquivos (se houver)
SELECT 
    id,
    name,
    created_at,
    metadata->>'size' as file_size,
    metadata->>'mimetype' as mime_type
FROM storage.objects
WHERE bucket_id = 'generated-images'
ORDER BY created_at DESC
LIMIT 5;
