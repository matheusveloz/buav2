-- =====================================================
-- Verificar e Corrigir Créditos Iniciais
-- =====================================================

-- 1. Verificar triggers que podem estar adicionando créditos
SELECT 
    trigger_name, 
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'emails';

-- 2. Verificar se há DEFAULT na coluna creditos
SELECT 
    column_name, 
    column_default, 
    data_type
FROM information_schema.columns
WHERE table_name = 'emails'
    AND column_name IN ('creditos', 'creditos_extras');

-- 3. Verificar funções relacionadas a créditos
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%credit%'
    OR routine_name LIKE '%credito%';

-- 4. Verificar últimas contas criadas e seus créditos
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

-- =====================================================
-- CORREÇÃO: Remover qualquer DEFAULT indesejado
-- =====================================================

-- Se a coluna tem DEFAULT 150, remover:
-- ALTER TABLE emails ALTER COLUMN creditos DROP DEFAULT;
-- ALTER TABLE emails ALTER COLUMN creditos_extras DROP DEFAULT;

-- =====================================================
-- SOLUÇÃO: Garantir que novos usuários recebam apenas 90
-- =====================================================

-- O código em app/auth/callback/page.tsx já está correto (linha 75):
-- creditos: 90

-- Mas pode haver um trigger ou default no banco interferindo.
-- Execute as queries acima para identificar o problema.
