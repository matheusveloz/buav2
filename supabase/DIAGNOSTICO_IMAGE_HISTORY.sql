-- =====================================================
-- DIAGNÓSTICO: Verificar Performance do Histórico de Imagens
-- Execute este script no Supabase SQL Editor para diagnosticar problemas
-- =====================================================

-- 1. Verificar todos os índices da tabela generated_images
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'generated_images' 
ORDER BY indexname;

-- 2. Verificar tamanho da tabela
SELECT 
  pg_size_pretty(pg_total_relation_size('generated_images')) as table_size,
  pg_size_pretty(pg_relation_size('generated_images')) as data_size,
  pg_size_pretty(pg_indexes_size('generated_images')) as indexes_size;

-- 3. Contar registros por usuário
SELECT 
  user_email,
  COUNT(*) as total_images,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM generated_images
GROUP BY user_email
ORDER BY total_images DESC
LIMIT 10;

-- 4. Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'generated_images';

-- 5. Testar performance da query (SUBSTITUA O EMAIL)
EXPLAIN ANALYZE
SELECT id, task_id, status, image_urls, prompt, num_images, created_at, completed_at, model
FROM public.generated_images
WHERE user_email = 'SEU_EMAIL_AQUI'  -- ⚠️ SUBSTITUA PELO SEU EMAIL
ORDER BY created_at DESC
LIMIT 12;

-- 6. Ver queries lentas recentes (requer pg_stat_statements)
-- Pode não funcionar se a extensão não estiver habilitada
/*
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%generated_images%'
  AND query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 5;
*/

-- 7. Verificar fragmentação dos índices
SELECT 
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename = 'generated_images'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 8. Verificar se ANALYZE foi executado recentemente
SELECT 
  schemaname,
  relname,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE relname = 'generated_images';

-- =====================================================
-- INTERPRETAÇÃO DOS RESULTADOS
-- =====================================================

-- ✅ BOM:
-- - Índice "idx_generated_images_user_created" existe
-- - Execution Time < 100ms no EXPLAIN ANALYZE
-- - Index Scan (não Seq Scan)
-- - dead_rows < 10% de live_rows

-- ❌ PROBLEMA:
-- - Índice não existe
-- - Execution Time > 500ms
-- - Seq Scan (scan sequencial - ruim!)
-- - dead_rows > 20% de live_rows (precisa VACUUM)

-- 🔧 AÇÕES CORRETIVAS:
-- Se não houver índice composto:
--   → Execute FIX_IMAGE_HISTORY_TIMEOUT.sql
--
-- Se houver Seq Scan:
--   → Execute ANALYZE generated_images;
--
-- Se houver muitos dead_rows:
--   → Execute VACUUM ANALYZE generated_images;
--
-- Se Execution Time > 500ms com índices:
--   → Problema pode ser RLS ou conexão lenta
--   → Teste desabilitar RLS temporariamente



