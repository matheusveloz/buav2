-- ============================================
-- DIAGNÓSTICO: Plano não atualiza após upgrade
-- ============================================

-- 1️⃣ VER ESTADO ATUAL DO USUÁRIO
-- Esperado: plano deveria ser 'pro', 'premium' ou 'unlimited'
-- Problema: está mostrando 'free'
SELECT 
  email,
  plano AS "Plano Atual",
  creditos AS "Créditos do Plano",
  creditos_extras AS "Créditos Extras",
  (creditos + COALESCE(creditos_extras, 0)) AS "Total de Créditos",
  created_at AS "Conta Criada Em",
  updated_at AS "Última Atualização"
FROM emails 
WHERE email = 'empresa.stnnetwork@gmail.com';

-- ============================================

-- 2️⃣ VER HISTÓRICO DE ASSINATURAS
-- Deve mostrar múltiplas assinaturas (antigas canceladas, 1 ativa)
SELECT 
  plano AS "Plano",
  status AS "Status",
  data_inicio AS "Início",
  data_cancelamento AS "Cancelamento",
  proxima_cobranca AS "Próxima Cobrança",
  stripe_subscription_id AS "Stripe Sub ID"
FROM subscriptions 
WHERE user_email = 'empresa.stnnetwork@gmail.com' 
ORDER BY data_inicio DESC;

-- ============================================

-- 3️⃣ VER HISTÓRICO DE TRANSAÇÕES
-- Confirma que upgrades foram registrados
SELECT 
  type AS "Tipo",
  plan AS "Plano",
  credits_added AS "Créditos Adicionados",
  amount AS "Valor (R$)",
  status AS "Status",
  created_at AS "Data",
  stripe_session_id AS "Session ID"
FROM transactions 
WHERE user_email = 'empresa.stnnetwork@gmail.com' 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================

-- 4️⃣ VERIFICAR POLÍTICAS RLS (Row Level Security)
-- Se houver políticas restritivas, podem bloquear o UPDATE
SELECT 
  schemaname AS "Schema",
  tablename AS "Tabela",
  policyname AS "Nome da Política",
  permissive AS "Tipo",
  roles AS "Roles",
  cmd AS "Comando",
  qual AS "Condição",
  with_check AS "Checagem"
FROM pg_policies 
WHERE tablename = 'emails';

-- ============================================

-- 5️⃣ TESTAR UPDATE MANUAL (COMO TESTE)
-- Execute este UPDATE para ver se funciona manualmente:
/*
UPDATE emails 
SET 
  plano = 'premium',
  creditos = 1650
WHERE email = 'empresa.stnnetwork@gmail.com'
RETURNING email, plano, creditos;
*/

-- ⚠️ DESCOMENTE acima (remova /* e */) para executar
-- Se funcionar: problema é nas permissões do webhook
-- Se não funcionar: problema é RLS ou permissões da tabela

-- ============================================

-- 6️⃣ VERIFICAR TRIGGERS NA TABELA EMAILS
-- Triggers podem estar interferindo
SELECT 
  trigger_name AS "Nome do Trigger",
  event_manipulation AS "Evento",
  action_timing AS "Timing",
  action_statement AS "Ação"
FROM information_schema.triggers 
WHERE event_object_table = 'emails';

-- ============================================

-- 7️⃣ SOLUÇÃO TEMPORÁRIA - CORRIGIR PLANO MANUALMENTE
-- Execute APENAS se quiser corrigir agora para continuar testando
/*
-- Baseado na última transação, definir o plano correto
WITH ultima_transacao AS (
  SELECT plan, credits_added
  FROM transactions
  WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND type = 'upgrade'
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE emails e
SET 
  plano = (SELECT plan FROM ultima_transacao),
  creditos = (SELECT credits_added FROM ultima_transacao)
WHERE e.email = 'empresa.stnnetwork@gmail.com'
RETURNING email, plano, creditos;
*/

-- ⚠️ DESCOMENTE acima para executar correção

-- ============================================

-- 8️⃣ VER PERMISSÕES DO SERVICE ROLE
-- Verificar se o service role tem permissão UPDATE na tabela emails
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants 
WHERE table_name = 'emails'
  AND grantee != 'postgres'
ORDER BY grantee;

-- ============================================

-- 📋 RELATÓRIO ESPERADO
-- =====================
-- 
-- Query 1 (Estado Atual):
--   ❌ Se plano = 'free' → PROBLEMA CONFIRMADO
--   ✅ Se plano = 'premium' → Tudo OK (problema pode ser cache frontend)
--
-- Query 2 (Assinaturas):
--   ✅ Deve mostrar várias assinaturas (antigas canceladas)
--   ❌ Se não tem nenhuma → Webhook não está criando assinaturas
--
-- Query 3 (Transações):
--   ✅ 10 transações registradas (como reportado)
--   ✅ Confirma que webhook foi chamado
--
-- Query 4 (RLS):
--   ❌ Se tem políticas restritivas → Pode ser o problema
--   ✅ Se vazio ou permissivo → RLS não é o problema
--
-- Query 5 (Update Manual):
--   ✅ Se funcionar → Problema é permissão do webhook
--   ❌ Se falhar → Problema é RLS ou estrutura da tabela
--
-- Query 6 (Triggers):
--   ⚠️ Se tem triggers → Podem estar interferindo
--   ✅ Se vazio → Triggers não são o problema
--
-- Query 7 (Correção):
--   Use apenas para corrigir temporariamente
--   Não resolve a causa raiz
--
-- Query 8 (Permissões):
--   ✅ Service role deve ter UPDATE privilege
--   ❌ Se não tiver → CAUSA RAIZ ENCONTRADA

-- ============================================
-- PRÓXIMOS PASSOS APÓS EXECUTAR ESTE SCRIPT:
-- ============================================
-- 1. Execute cada query em ordem
-- 2. Copie os resultados
-- 3. Compartilhe para análise
-- 4. Se Query 5 (update manual) funcionar, o problema é:
--    → Variável de ambiente SUPABASE_SERVICE_ROLE_KEY incorreta
--    → Ou webhook não está usando admin client corretamente

