-- =====================================================
-- Criar Bucket para Imagens Geradas no Supabase Storage
-- =====================================================

-- IMPORTANTE: Execute este comando no Dashboard do Supabase:
-- 1. Vá para Storage → New Bucket
-- 2. Nome: "generated-images"
-- 3. Public bucket: YES (marcar como público)
-- 4. File size limit: 10MB
-- 5. Allowed MIME types: image/*

-- Ou use o SQL abaixo no SQL Editor (requer permissões de admin):

-- Verificar se o bucket existe
SELECT * FROM storage.buckets WHERE id = 'generated-images';

-- Se não existir, criar manualmente no Dashboard
-- O SQL para criar bucket requer permissões especiais