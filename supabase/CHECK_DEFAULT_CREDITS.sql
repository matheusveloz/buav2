-- =====================================================
-- Verificar DEFAULT de créditos na tabela emails
-- =====================================================

-- Verificar se há DEFAULT na coluna creditos
SELECT 
    column_name, 
    column_default, 
    data_type
FROM information_schema.columns
WHERE table_name = 'emails'
    AND column_name IN ('creditos', 'creditos_extras');

-- Verificar últimas contas criadas e seus créditos
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

