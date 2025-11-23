-- ============================================
-- VERIFICAR SE CONTA FOI BLOQUEADA
-- ============================================

-- 1️⃣ Verificar status da conta
SELECT 
  email,
  ativo AS "Conta Ativa (1=sim, 0=não)",
  plano AS "Plano Atual",
  creditos AS "Créditos",
  motivo_bloqueio AS "Motivo do Bloqueio",
  data_bloqueio AS "Data do Bloqueio",
  created_at AS "Conta Criada",
  updated_at AS "Última Atualização"
FROM emails 
WHERE email = 'empresa.stnnetwork@gmail.com';

-- ============================================

-- 2️⃣ Verificar últimas transações
SELECT 
  type AS "Tipo",
  plan AS "Plano",
  amount AS "Valor",
  status AS "Status",
  created_at AS "Data",
  stripe_session_id AS "Stripe Session ID"
FROM transactions 
WHERE user_email = 'empresa.stnnetwork@gmail.com'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================

-- 3️⃣ Verificar assinaturas
SELECT 
  plano AS "Plano",
  status AS "Status",
  data_inicio AS "Início",
  data_cancelamento AS "Cancelamento",
  stripe_subscription_id AS "Stripe Sub ID"
FROM subscriptions 
WHERE user_email = 'empresa.stnnetwork@gmail.com'
ORDER BY data_inicio DESC;

-- ============================================

-- 4️⃣ TESTE: Se a conta não foi bloqueada, simular bloqueio MANUAL
-- ⚠️ Execute APENAS se quiser testar o bloqueio manualmente
/*
UPDATE emails 
SET 
  ativo = 0,
  motivo_bloqueio = 'Teste manual de bloqueio por reembolso',
  data_bloqueio = NOW()
WHERE email = 'empresa.stnnetwork@gmail.com';
*/

-- 5️⃣ TESTE: Para DESBLOQUEAR a conta
-- ⚠️ Execute para voltar ao normal
/*
UPDATE emails 
SET 
  ativo = 1,
  motivo_bloqueio = NULL,
  data_bloqueio = NULL
WHERE email = 'empresa.stnnetwork@gmail.com';
*/

