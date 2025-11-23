-- =====================================================
-- FIX: Corrigir bug de 150 créditos ao criar conta
-- =====================================================
-- Problema: Novos usuários estão recebendo 150 créditos ao invés de 90
-- =====================================================

-- 1️⃣ VERIFICAR O PROBLEMA
-- =====================================================

-- Verificar se há DEFAULT na coluna creditos
SELECT 
    column_name, 
    column_default, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'emails'
    AND column_name IN ('creditos', 'creditos_extras');

-- Verificar triggers na tabela emails
SELECT 
    trigger_name, 
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'emails';

-- Verificar funções que podem estar alterando créditos
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND (routine_name LIKE '%credit%' OR routine_name LIKE '%credito%');

-- 2️⃣ VERIFICAR ÚLTIMAS CONTAS CRIADAS
-- =====================================================

SELECT 
    email,
    creditos,
    creditos_extras,
    creditos + creditos_extras as total_creditos,
    plano,
    data_criacao,
    ativo
FROM emails
ORDER BY data_criacao DESC
LIMIT 10;

-- 3️⃣ CORRIGIR A DESCRIÇÃO DO PLANO FREE
-- =====================================================

UPDATE plans
SET descricao = 'Ideal para começar e validar fluxos com 90 créditos iniciais.'
WHERE slug = 'free' AND descricao LIKE '%150%';

-- Verificar a correção
SELECT slug, nome, creditos_mensais, creditos_bonus, descricao
FROM plans
WHERE slug = 'free';

-- 4️⃣ REMOVER DEFAULT SE EXISTIR
-- =====================================================

-- Se a verificação acima mostrou DEFAULT, execute:
ALTER TABLE emails ALTER COLUMN creditos DROP DEFAULT;
ALTER TABLE emails ALTER COLUMN creditos_extras DROP DEFAULT;

-- 5️⃣ VERIFICAR SE HÁ TRIGGER PROBLEMÁTICO
-- =====================================================

-- Se houver um trigger set_initial_free_credits ou similar que está
-- definindo 150 ao invés de 90, remova:
-- DROP TRIGGER IF EXISTS set_initial_credits_trigger ON emails;
-- DROP FUNCTION IF EXISTS set_initial_free_credits();

-- 6️⃣ CORRIGIR USUÁRIOS QUE JÁ FORAM CRIADOS COM 150
-- =====================================================

-- ATENÇÃO: Execute com cautela! Isso vai reduzir os créditos
-- de usuários FREE que ainda não usaram nenhum crédito e têm 150

-- Primeiro, veja quem será afetado:
SELECT 
    email,
    creditos,
    creditos_extras,
    data_criacao,
    'Será ajustado para 90' as acao
FROM emails
WHERE plano = 'free' 
    AND creditos = 150 
    AND creditos_extras = 0
    AND NOT EXISTS (
        SELECT 1 FROM generated_videos_sora 
        WHERE user_email = emails.email
    )
    AND NOT EXISTS (
        SELECT 1 FROM generated_images 
        WHERE user_email = emails.email
    );

-- Se quiser corrigir os créditos desses usuários, descomente:
-- UPDATE emails
-- SET creditos = 90
-- WHERE plano = 'free' 
--     AND creditos = 150 
--     AND creditos_extras = 0
--     AND NOT EXISTS (
--         SELECT 1 FROM generated_videos_sora 
--         WHERE user_email = emails.email
--     )
--     AND NOT EXISTS (
--         SELECT 1 FROM generated_images 
--         WHERE user_email = emails.email
--     );

-- 7️⃣ VERIFICAÇÃO FINAL
-- =====================================================

-- Verificar se tudo está correto
SELECT 
    'Configuração da tabela plans' as verificacao,
    slug, 
    creditos_mensais::text as valor,
    descricao
FROM plans
WHERE slug = 'free'

UNION ALL

SELECT 
    'Últimos usuários criados' as verificacao,
    email,
    creditos::text as valor,
    data_criacao::text as descricao
FROM emails
ORDER BY verificacao DESC, descricao DESC
LIMIT 6;

-- =====================================================
-- RESULTADO ESPERADO
-- =====================================================
-- ✅ Sem DEFAULT na coluna creditos
-- ✅ Sem triggers problemáticos
-- ✅ Descrição do plano FREE corrigida
-- ✅ Novos usuários receberão 90 créditos
-- =====================================================

