-- ========================================
-- 🚀 LIMPAR GERAÇÕES TRAVADAS - AMBAS AS CONTAS
-- ========================================

-- 1️⃣ VERIFICAR gerações travadas em AMBAS as contas
SELECT 
  user_email,
  COUNT(*) as total_processing,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)) as avg_minutes_ago
FROM generated_images
WHERE user_email IN ('jeova251ok@gmail.com', 'empresa.stnnetwork@gmail.com')
  AND status = 'processing'
GROUP BY user_email
ORDER BY user_email;

-- 2️⃣ VER DETALHES de cada geração travada
SELECT 
  user_email,
  id,
  task_id,
  model,
  status,
  num_images,
  created_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) as minutes_ago
FROM generated_images
WHERE user_email IN ('jeova251ok@gmail.com', 'empresa.stnnetwork@gmail.com')
  AND status = 'processing'
ORDER BY user_email, created_at DESC;

-- 3️⃣ LIMPAR gerações travadas (> 5 minutos) de AMBAS as contas
-- ⚠️ EXECUTE ESTE COMANDO
UPDATE generated_images 
SET 
  status = 'failed',
  updated_at = NOW()
WHERE user_email IN ('jeova251ok@gmail.com', 'empresa.stnnetwork@gmail.com')
  AND status = 'processing'
  AND created_at < NOW() - INTERVAL '5 minutes';

-- 4️⃣ VERIFICAR resultado (deve mostrar 0 para ambas)
SELECT 
  user_email,
  COUNT(*) as still_processing
FROM generated_images
WHERE user_email IN ('jeova251ok@gmail.com', 'empresa.stnnetwork@gmail.com')
  AND status = 'processing'
GROUP BY user_email
ORDER BY user_email;

-- 5️⃣ ESTATÍSTICAS gerais das contas
SELECT 
  user_email,
  status,
  COUNT(*) as total,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at)))) as avg_seconds
FROM generated_images
WHERE user_email IN ('jeova251ok@gmail.com', 'empresa.stnnetwork@gmail.com')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_email, status
ORDER BY user_email, status;

-- ========================================
-- 📊 RESULTADO ESPERADO
-- ========================================
-- Após executar o UPDATE (passo 3), ambas as contas
-- devem mostrar 0 (zero) gerações "processing"
-- ========================================

