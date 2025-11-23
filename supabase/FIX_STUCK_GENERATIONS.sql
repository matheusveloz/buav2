-- ========================================
-- FIX: Limpar Gerações Travadas
-- ========================================
-- Problema: Gerações ficam com status "processing" 
-- mas não estão realmente processando (fantasmas)
-- Solução: Marcar como "failed" se > 10 minutos
-- ========================================

-- 1️⃣ VERIFICAR quantas gerações estão travadas
SELECT 
  id,
  task_id,
  user_email,
  model,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS minutes_ago
FROM generated_images
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;

-- 2️⃣ LIMPAR gerações travadas (> 10 minutos)
-- ⚠️ Execute este comando para limpar
UPDATE generated_images 
SET 
  status = 'failed',
  updated_at = NOW()
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- 3️⃣ VERIFICAR gerações do seu usuário especificamente
SELECT 
  id,
  task_id,
  model,
  status,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 60 AS minutes_ago
FROM generated_images
WHERE user_email = 'jeova251ok@gmail.com'
  AND status = 'processing'
ORDER BY created_at DESC;

-- 4️⃣ LIMPAR apenas suas gerações travadas
-- ⚠️ Execute este se quiser limpar apenas suas gerações
UPDATE generated_images 
SET 
  status = 'failed',
  updated_at = NOW()
WHERE user_email = 'jeova251ok@gmail.com'
  AND status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- 5️⃣ VERIFICAR resultado (deve mostrar 0 linhas)
SELECT COUNT(*) as stuck_generations
FROM generated_images
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- ========================================
-- EXPLICAÇÃO DO PROBLEMA
-- ========================================
-- Gerações podem ficar "travadas" quando:
-- 1. O servidor reinicia durante geração
-- 2. A API falha sem retornar erro
-- 3. O polling para de funcionar
-- 4. O usuário fecha o navegador
-- 
-- Solução: Timeout automático no polling (já implementado)
-- Mas gerações antigas precisam ser limpas manualmente
-- ========================================

-- 6️⃣ PREVENIR NO FUTURO: Criar rotina de limpeza automática
-- (Opcional - executar periodicamente via cron job)
CREATE OR REPLACE FUNCTION cleanup_stuck_generations()
RETURNS void AS $$
BEGIN
  UPDATE generated_images 
  SET 
    status = 'failed',
    updated_at = NOW()
  WHERE status = 'processing'
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- Agendar limpeza automática a cada 5 minutos
-- (Requer extensão pg_cron - descomente se disponível)
-- SELECT cron.schedule(
--   'cleanup-stuck-generations',
--   '*/5 * * * *', -- A cada 5 minutos
--   'SELECT cleanup_stuck_generations();'
-- );

-- ========================================
-- LOGS ÚTEIS
-- ========================================

-- Ver todas as gerações das últimas 24h
SELECT 
  status,
  COUNT(*) as total,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))) as avg_seconds
FROM generated_images
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status;

-- Ver gerações lentas (> 2 minutos)
SELECT 
  id,
  task_id,
  model,
  status,
  num_images,
  EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at)) as seconds_total
FROM generated_images
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at)) > 120
ORDER BY seconds_total DESC
LIMIT 20;

