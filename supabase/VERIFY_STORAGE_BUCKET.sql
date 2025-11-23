-- =====================================================
-- Verificar e Criar Bucket de Storage
-- =====================================================

-- 1. Verificar se o bucket existe
SELECT 
    id as bucket_name,
    name as display_name,
    public as is_public,
    created_at,
    updated_at,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE id = 'generated-images';

-- Se o resultado estiver VAZIO, você precisa criar o bucket!

-- =====================================================
-- INSTRUÇÕES PARA CRIAR O BUCKET:
-- =====================================================

-- OPÇÃO 1: Via Dashboard (RECOMENDADO)
-- 1. Acesse seu projeto no Supabase Dashboard
-- 2. No menu lateral, clique em "Storage"
-- 3. Clique no botão "New bucket"
-- 4. Configure:
--    - Bucket name: generated-images
--    - Public bucket: ✅ (MARCAR COMO PÚBLICO)
--    - File size limit: 10485760 (10MB)
--    - Allowed MIME types: image/*
-- 5. Clique em "Create bucket"

-- OPÇÃO 2: Via API/SQL (requer service_role)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'generated-images',
--   'Generated Images',
--   true, -- Público
--   10485760, -- 10MB
--   ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
-- );

-- 2. Verificar políticas RLS do bucket (se criado)
SELECT 
    name,
    definition,
    check_expression
FROM storage.policies
WHERE bucket_id = 'generated-images';

-- 3. Criar política para permitir uploads (se necessário)
-- Permite upload para usuários autenticados
-- CREATE POLICY "Allow authenticated uploads" ON storage.objects
-- FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'generated-images');

-- Permite leitura pública
-- CREATE POLICY "Allow public downloads" ON storage.objects
-- FOR SELECT TO public
-- USING (bucket_id = 'generated-images');
