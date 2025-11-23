-- =====================================================
-- FIX: Statement Timeout no Histórico de Imagens
-- =====================================================

-- 1. Criar índice composto para otimizar a query principal
-- Combina user_email + created_at DESC para acelerar a busca paginada
CREATE INDEX IF NOT EXISTS idx_generated_images_user_created 
ON public.generated_images(user_email, created_at DESC);

-- 2. Criar índice composto para filtros por status
CREATE INDEX IF NOT EXISTS idx_generated_images_user_status_created 
ON public.generated_images(user_email, status, created_at DESC);

-- 3. Otimizar a política RLS para usar os índices corretamente
-- Dropar política antiga
DROP POLICY IF EXISTS "Users can view own generated images" ON public.generated_images;

-- Recriar política otimizada usando email direto
-- Usa auth.jwt() que é mais eficiente e compatível com o sistema
CREATE POLICY "Users can view own generated images"
  ON public.generated_images
  FOR SELECT
  USING (user_email = (auth.jwt() ->> 'email'));

-- NOTA IMPORTANTE: Se continuar com timeout após aplicar este script,
-- execute temporariamente a política simplificada abaixo para verificar
-- se o problema é na RLS ou nos índices:
--
-- DROP POLICY IF EXISTS "Users can view own generated images" ON public.generated_images;
-- CREATE POLICY "Users can view own generated images"
--   ON public.generated_images FOR SELECT USING (true);
--
-- Se funcionar com USING (true), o problema está na RLS.
-- Se não funcionar, o problema está nos índices ou na quantidade de dados.

-- 4. Atualizar estatísticas da tabela para melhorar o planner
ANALYZE public.generated_images;

-- 5. Verificar índices criados
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'generated_images' 
ORDER BY indexname;

-- INSTRUÇÕES DE APLICAÇÃO:
-- 1. Execute este script no SQL Editor do Supabase
-- 2. Verifique se os índices foram criados com sucesso
-- 3. Teste a query abaixo para verificar performance:

/*
EXPLAIN ANALYZE
SELECT id, task_id, status, image_urls, prompt, num_images, created_at, completed_at, model
FROM public.generated_images
WHERE user_email = 'SEU_EMAIL_AQUI'
ORDER BY created_at DESC
LIMIT 12;
*/

-- Resultado esperado:
-- - Execution Time: < 100ms
-- - Index Scan usando idx_generated_images_user_created

