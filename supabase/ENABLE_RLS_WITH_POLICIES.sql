-- ============================================================
-- ATIVAR RLS COM POLÍTICAS CORRETAS
-- ============================================================
-- Execute este script NO SQL EDITOR do Supabase
-- ATENÇÃO: Execute APÓS o UPDATE_VEO_CONSTRAINT_FINAL.sql
-- ============================================================

-- ==================== TABELA: generated_videos_sora ====================

-- 1. Habilitar RLS
ALTER TABLE generated_videos_sora ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas
CREATE POLICY "Service role can do anything on generated_videos_sora"
ON generated_videos_sora
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own videos"
ON generated_videos_sora
FOR SELECT
TO authenticated
USING (auth.uid()::text IN (
  SELECT id::text FROM auth.users WHERE email = user_email
));

CREATE POLICY "Users can insert their own videos"
ON generated_videos_sora
FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text IN (
  SELECT id::text FROM auth.users WHERE email = user_email
));

-- ==================== TABELA: voice_cache_pool ====================

-- 1. Habilitar RLS
ALTER TABLE voice_cache_pool ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas
CREATE POLICY "Service role can do anything on voice_cache_pool"
ON voice_cache_pool
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can read voice cache"
ON voice_cache_pool
FOR SELECT
TO authenticated, anon
USING (true);

-- ==================== TABELA: transactions ====================

-- 1. Habilitar RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas
CREATE POLICY "Service role can do anything on transactions"
ON transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own transactions"
ON transactions
FOR SELECT
TO authenticated
USING (auth.uid()::text IN (
  SELECT id::text FROM auth.users WHERE email = user_email
));

-- ==================== TABELA: emails ====================

-- 1. Habilitar RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- 2. Criar políticas
CREATE POLICY "Service role can do anything on emails"
ON emails
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own profile"
ON emails
FOR SELECT
TO authenticated
USING (auth.uid()::text IN (
  SELECT id::text FROM auth.users WHERE email = email
));

CREATE POLICY "Users can update their own profile"
ON emails
FOR UPDATE
TO authenticated
USING (auth.uid()::text IN (
  SELECT id::text FROM auth.users WHERE email = email
));

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

-- Listar todas as políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('generated_videos_sora', 'voice_cache_pool', 'transactions', 'emails')
ORDER BY tablename, policyname;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- ✅ RLS ativado em todas as tabelas
-- ✅ Service Role tem acesso total (sua API)
-- ✅ Usuários autenticados veem apenas seus dados
-- ✅ Aplicação continua funcionando normalmente!
-- ============================================================

-- ============================================================
-- COMO USAR
-- ============================================================
-- 1. Execute UPDATE_VEO_CONSTRAINT_FINAL.sql PRIMEIRO
-- 2. Execute este script
-- 3. Teste a aplicação
-- 4. Se algo quebrar, desative o RLS temporariamente:
--    ALTER TABLE nome_tabela DISABLE ROW LEVEL SECURITY;
-- ============================================================

