-- =====================================================
-- TESTE: Verificar Contagem de Imagens Diárias
-- =====================================================

-- 1. Simular usuário FREE que gerou 4 imagens hoje
-- Substitua 'seu-email@exemplo.com' pelo email real

-- Ver quantas imagens foram criadas hoje
SELECT 
    COUNT(*) as total_records,
    SUM(num_images) as total_images_count,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing
FROM generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND created_at >= CURRENT_DATE;

-- 2. Ver detalhes das imagens de hoje
SELECT 
    id,
    status,
    num_images,
    LEFT(prompt, 30) as prompt_preview,
    created_at,
    completed_at
FROM generated_images
WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- 3. Teste: Deletar uma imagem e ver se a contagem muda
-- (NÃO execute isso em produção! É só exemplo)
/*
-- ANTES: Contar
SELECT SUM(num_images) FROM generated_images 
WHERE user_email = 'seu-email@exemplo.com' AND created_at >= CURRENT_DATE;

-- Deletar uma
DELETE FROM generated_images 
WHERE id = 'algum-id-aqui';

-- DEPOIS: Contar novamente
SELECT SUM(num_images) FROM generated_images 
WHERE user_email = 'seu-email@exemplo.com' AND created_at >= CURRENT_DATE;

-- Se a contagem diminuir, o sistema estava contando errado!
*/
