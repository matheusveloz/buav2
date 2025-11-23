-- ============================================
-- CORREÇÃO: Garantir que planos existem na tabela plans
-- ============================================

-- ❌ PROBLEMA IDENTIFICADO:
-- O campo emails.plano tem FOREIGN KEY para plans.slug
-- Se a tabela plans estiver vazia ou sem os slugs corretos,
-- o UPDATE vai FALHAR silenciosamente por violar a constraint!

-- ============================================
-- 1️⃣ VERIFICAR SE TABELA PLANS TEM OS SLUGS NECESSÁRIOS
-- ============================================

SELECT 
  slug AS "Slug do Plano",
  nome AS "Nome",
  creditos_mensais AS "Créditos Mensais",
  creditos_bonus AS "Bônus",
  preco_credito_extra AS "Preço Extra"
FROM plans 
ORDER BY 
  CASE slug
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'premium' THEN 3
    WHEN 'unlimited' THEN 4
    ELSE 5
  END;

-- ✅ RESULTADO ESPERADO: Deve mostrar 4 planos (free, pro, premium, unlimited)
-- ❌ SE VAZIO: É POR ISSO que o webhook não consegue atualizar!

-- ============================================
-- 2️⃣ POPULAR TABELA PLANS (SE ESTIVER VAZIA)
-- ============================================

-- Execute APENAS se a query acima retornar 0 resultados

INSERT INTO public.plans 
  (slug, nome, creditos_mensais, bonus_percentual, creditos_bonus, preco_credito_extra, 
   max_duracao_video_seg, max_uploads_avatars, max_processamentos, processamento_prioritario, 
   acesso_avatares_padrao, descricao)
VALUES
  -- FREE
  (
    'free',
    'Free',
    90,
    0,
    0,
    NULL,
    30,  -- 30 segundos
    3,
    1,
    false,
    true,
    'Ideal para começar e validar fluxos com 90 créditos iniciais.'
  ),
  -- PRO
  (
    'pro',
    'Pro',
    500,
    0.1,  -- 10%
    50,
    0.30,
    180,  -- 3 minutos
    NULL,  -- ilimitado
    4,
    false,
    true,
    'Receba 500 créditos com bônus imediato e acelere seus fluxos.'
  ),
  -- PREMIUM
  (
    'premium',
    'Premium',
    1500,
    0.1,  -- 10%
    150,
    0.25,
    600,  -- 10 minutos
    NULL,  -- ilimitado
    8,
    true,
    true,
    'Volume elevado com prioridade de processamento para a sua equipe.'
  ),
  -- UNLIMITED
  (
    'unlimited',
    'Unlimited',
    4000,
    0.1,  -- 10%
    400,
    0.10,
    600,  -- 10 minutos
    NULL,  -- ilimitado
    12,
    true,
    true,
    'Projetos intensos com 4000 créditos e suporte prioritário.'
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3️⃣ VERIFICAR SE INSERÇÃO FOI BEM-SUCEDIDA
-- ============================================

SELECT 
  slug,
  nome,
  creditos_mensais + creditos_bonus AS "Total Créditos",
  CASE 
    WHEN EXISTS (SELECT 1 FROM emails WHERE plano = plans.slug) 
    THEN '✅ EM USO'
    ELSE '⚠️ SEM USUÁRIOS'
  END AS "Status"
FROM plans
ORDER BY 
  CASE slug
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'premium' THEN 3
    WHEN 'unlimited' THEN 4
  END;

-- ============================================
-- 4️⃣ TESTAR UPDATE DO PLANO AGORA
-- ============================================

-- Se tabela plans agora tem os slugs, o update deve funcionar:
UPDATE emails 
SET plano = 'pro'
WHERE email = 'empresa.stnnetwork@gmail.com'
RETURNING email, plano, creditos;

-- ✅ Se funcionar: Problema resolvido!
-- ❌ Se falhar: Ainda há outro problema (provavelmente RLS)

-- ============================================
-- 5️⃣ VERIFICAR CONSTRAINT DA FOREIGN KEY
-- ============================================

SELECT
  tc.constraint_name AS "Nome Constraint",
  tc.table_name AS "Tabela",
  kcu.column_name AS "Coluna",
  ccu.table_name AS "Tabela Referenciada",
  ccu.column_name AS "Coluna Referenciada"
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'emails'
  AND kcu.column_name = 'plano';

-- ============================================
-- 6️⃣ SE QUISER REMOVER TEMPORARIAMENTE A FK (NÃO RECOMENDADO)
-- ============================================

-- ⚠️ APENAS PARA DEBUG - NÃO USE EM PRODUÇÃO
-- Isso remove a constraint e permite qualquer valor em emails.plano

/*
ALTER TABLE public.emails
DROP CONSTRAINT emails_plano_fkey;
*/

-- Para recriar depois:
/*
ALTER TABLE public.emails
ADD CONSTRAINT emails_plano_fkey 
FOREIGN KEY (plano) REFERENCES public.plans(slug);
*/

-- ============================================
-- 7️⃣ CORRIGIR PLANO DO USUÁRIO BASEADO NA ÚLTIMA TRANSAÇÃO
-- ============================================

-- Agora que a tabela plans tem os dados, podemos corrigir:
WITH ultima_transacao AS (
  SELECT plan
  FROM transactions
  WHERE user_email = 'empresa.stnnetwork@gmail.com'
    AND type = 'upgrade'
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1
)
UPDATE emails e
SET plano = (SELECT plan FROM ultima_transacao)
WHERE e.email = 'empresa.stnnetwork@gmail.com'
  AND EXISTS (SELECT 1 FROM plans WHERE slug = (SELECT plan FROM ultima_transacao))
RETURNING email, plano, creditos;

-- ============================================
-- 8️⃣ VERIFICAR SE HÁ CONFLITOS DE DADOS
-- ============================================

-- Ver se há transações com planos que não existem na tabela plans
SELECT DISTINCT 
  t.plan AS "Plano na Transação",
  CASE 
    WHEN EXISTS (SELECT 1 FROM plans WHERE slug = t.plan) 
    THEN '✅ Existe'
    ELSE '❌ NÃO EXISTE'
  END AS "Existe em Plans?"
FROM transactions t
WHERE t.type = 'upgrade'
ORDER BY t.plan;

-- ============================================
-- 9️⃣ CRIAR ÍNDICES PARA PERFORMANCE (OPCIONAL)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_emails_plano ON emails(plano);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_email ON subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_email ON transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ============================================
-- 🎯 RESUMO DO PROBLEMA
-- ============================================

/*
CAUSA RAIZ:
- A tabela emails.plano tem FK para plans.slug
- Se a tabela plans está vazia, o UPDATE falha silenciosamente
- O webhook tenta fazer: UPDATE emails SET plano = 'pro' 
- Mas 'pro' não existe em plans.slug
- PostgreSQL rejeita o UPDATE por violar a constraint FK
- Webhook não vê erro (porque não está tratando FK violations)

SOLUÇÃO:
1. Popular tabela plans com os 4 planos
2. Garantir que slugs sejam: 'free', 'pro', 'premium', 'unlimited'
3. Webhook vai funcionar automaticamente depois disso

VERIFICAÇÃO:
Execute Query 1 primeiro
- Se retornar 0 linhas → Execute Query 2 (INSERT)
- Se retornar 4 linhas → Tabela já está OK, problema é outro
*/

-- ============================================
-- 🔟 ESTADO FINAL ESPERADO
-- ============================================

-- Execute para ver o estado completo do usuário:
SELECT 
  e.email,
  e.plano AS "Plano Atual",
  p.nome AS "Nome do Plano",
  e.creditos AS "Créditos",
  e.creditos_extras AS "Extras",
  (SELECT COUNT(*) FROM subscriptions s WHERE s.user_email = e.email AND s.status = 'ativa') AS "Assinaturas Ativas",
  (SELECT COUNT(*) FROM transactions t WHERE t.user_email = e.email AND t.status = 'completed') AS "Transações Completas"
FROM emails e
LEFT JOIN plans p ON e.plano = p.slug
WHERE e.email = 'empresa.stnnetwork@gmail.com';

-- ============================================
-- FIM DO SCRIPT DE CORREÇÃO
-- ============================================

