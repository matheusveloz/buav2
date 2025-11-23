-- =====================================================
-- MIGRAÇÃO: Data URLs para Supabase Storage
-- =====================================================
-- Problema: image_urls com base64 são enormes (2-5MB cada)
-- Solução: Armazenar arquivos no Storage e salvar apenas URLs
-- =====================================================

-- 1. Criar bucket no Supabase Storage (se não existir)
-- Execute isto no Dashboard do Supabase:
-- Storage → New Bucket → Nome: "generated-images" → Public: Yes

-- 2. Adicionar nova coluna para URLs do Storage (temporária durante migração)
ALTER TABLE public.generated_images 
ADD COLUMN IF NOT EXISTS storage_urls jsonb;

-- 3. Criar função para verificar tamanho dos dados
CREATE OR REPLACE FUNCTION check_image_data_size()
RETURNS TABLE (
    user_email text,
    total_images bigint,
    avg_size_kb numeric,
    total_size_mb numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gi.user_email,
        COUNT(*) as total_images,
        ROUND(AVG(LENGTH(gi.image_urls::text)::numeric / 1024), 2) as avg_size_kb,
        ROUND(SUM(LENGTH(gi.image_urls::text)::numeric / 1024 / 1024), 2) as total_size_mb
    FROM public.generated_images gi
    WHERE gi.image_urls IS NOT NULL
    GROUP BY gi.user_email
    ORDER BY total_size_mb DESC;
END;
$$ LANGUAGE plpgsql;

-- 4. Verificar usuários com mais dados
SELECT * FROM check_image_data_size() LIMIT 10;

-- 5. Para o usuário específico
SELECT 
    COUNT(*) as total_images,
    ROUND(SUM(LENGTH(image_urls::text)::numeric / 1024 / 1024), 2) as total_size_mb
FROM public.generated_images 
WHERE user_email = 'empresa.stnnetwork@gmail.com';

-- NOTA: A migração completa requer:
-- 1. Script Node.js/Python para baixar cada data URL
-- 2. Upload para Supabase Storage
-- 3. Atualizar registro com URL do Storage
-- 4. Remover data URL original

-- Estrutura esperada após migração:
-- image_urls: [
--   {
--     "imageUrl": "https://seu-projeto.supabase.co/storage/v1/object/public/generated-images/user123/img_abc123.png",
--     "imageType": "png"
--   }
-- ]
