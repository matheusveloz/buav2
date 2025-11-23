-- =====================================================
-- Verificar Políticas RLS do Storage
-- =====================================================

-- 1. Verificar políticas existentes para o bucket
SELECT 
    id,
    name,
    definition,
    bucket_id,
    CASE 
        WHEN definition LIKE '%INSERT%' THEN 'Upload'
        WHEN definition LIKE '%SELECT%' THEN 'Download'
        WHEN definition LIKE '%UPDATE%' THEN 'Update'
        WHEN definition LIKE '%DELETE%' THEN 'Delete'
        ELSE 'Other'
    END as action_type
FROM storage.policies
WHERE bucket_id = 'generated-images'
ORDER BY name;

-- 2. Se não houver políticas, criar as básicas:

-- Permitir uploads para service_role (usado pela API)
/*
INSERT INTO storage.policies (bucket_id, name, definition, check_expression)
VALUES (
    'generated-images',
    'Allow service role uploads',
    'service_role',
    'true'
);
*/

-- Permitir leitura pública (já que o bucket é público)
/*
INSERT INTO storage.policies (bucket_id, name, definition)
VALUES (
    'generated-images',
    'Allow public downloads',
    'public'
);
*/

-- 3. Verificar se há objetos no bucket (teste se uploads anteriores funcionaram)
SELECT 
    id,
    name,
    bucket_id,
    created_at,
    updated_at,
    metadata
FROM storage.objects
WHERE bucket_id = 'generated-images'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Testar permissões (substitua com seu email)
-- Este teste mostra se você consegue ver os objetos
/*
SELECT 
    COUNT(*) as total_objects,
    pg_size_pretty(SUM(metadata->>'size')::bigint) as total_size
FROM storage.objects
WHERE bucket_id = 'generated-images';
*/
