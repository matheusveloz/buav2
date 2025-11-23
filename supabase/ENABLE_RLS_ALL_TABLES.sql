-- ============================================================
-- HABILITAR RLS EM TODAS AS TABELAS - VERSÃO CORRIGIDA
-- ============================================================
-- Execute este script NO SQL EDITOR do Supabase
-- ATENÇÃO: Execute APÓS o UPDATE_VEO_CONSTRAINT_FINAL.sql
-- ============================================================

-- ==================== IMPORTANTE ====================
-- Service Role (usado pela API) terá acesso total
-- Authenticated users terão acesso baseado no email
-- ====================================================

-- ==================== 1. TABELA: emails ====================
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Service role: acesso total (API backend)
CREATE POLICY "Service role full access on emails"
ON emails FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Usuários: podem ver e atualizar apenas seu próprio perfil
CREATE POLICY "Users can read own profile"
ON emails FOR SELECT TO authenticated
USING (email = auth.jwt()->>'email');

CREATE POLICY "Users can update own profile"
ON emails FOR UPDATE TO authenticated
USING (email = auth.jwt()->>'email')
WITH CHECK (email = auth.jwt()->>'email');

-- ==================== 2. TABELA: generated_images ====================
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on generated_images"
ON generated_images FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own images"
ON generated_images FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can insert own images"
ON generated_images FOR INSERT TO authenticated
WITH CHECK (user_email = auth.jwt()->>'email');

-- ==================== 3. TABELA: generated_videos_sora ====================
ALTER TABLE generated_videos_sora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on generated_videos_sora"
ON generated_videos_sora FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own videos"
ON generated_videos_sora FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can insert own videos"
ON generated_videos_sora FOR INSERT TO authenticated
WITH CHECK (user_email = auth.jwt()->>'email');

-- ==================== 4. TABELA: payments ====================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on payments"
ON payments FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own payments"
ON payments FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

-- ==================== 5. TABELA: plans ====================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on plans"
ON plans FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Planos são públicos (todos podem ver)
CREATE POLICY "Anyone can view plans"
ON plans FOR SELECT TO authenticated, anon
USING (true);

-- ==================== 6. TABELA: subscriptions ====================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on subscriptions"
ON subscriptions FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own subscriptions"
ON subscriptions FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

-- ==================== 7. TABELA: transactions ====================
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on transactions"
ON transactions FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

-- ==================== 8. TABELA: user_audio_generations ====================
ALTER TABLE user_audio_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on user_audio_generations"
ON user_audio_generations FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own audio generations"
ON user_audio_generations FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can insert own audio generations"
ON user_audio_generations FOR INSERT TO authenticated
WITH CHECK (user_email = auth.jwt()->>'email');

-- ==================== 9. TABELA: user_audios ====================
ALTER TABLE user_audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on user_audios"
ON user_audios FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own audios"
ON user_audios FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can insert own audios"
ON user_audios FOR INSERT TO authenticated
WITH CHECK (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can delete own audios"
ON user_audios FOR DELETE TO authenticated
USING (user_email = auth.jwt()->>'email');

-- ==================== 10. TABELA: user_avatars ====================
ALTER TABLE user_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on user_avatars"
ON user_avatars FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own avatars"
ON user_avatars FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can insert own avatars"
ON user_avatars FOR INSERT TO authenticated
WITH CHECK (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can delete own avatars"
ON user_avatars FOR DELETE TO authenticated
USING (user_email = auth.jwt()->>'email');

-- ==================== 11. TABELA: user_voice_clones ====================
ALTER TABLE user_voice_clones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on user_voice_clones"
ON user_voice_clones FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own voice clones"
ON user_voice_clones FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email' OR is_public = true);

CREATE POLICY "Users can insert own voice clones"
ON user_voice_clones FOR INSERT TO authenticated
WITH CHECK (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can update own voice clones"
ON user_voice_clones FOR UPDATE TO authenticated
USING (user_email = auth.jwt()->>'email')
WITH CHECK (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can delete own voice clones"
ON user_voice_clones FOR DELETE TO authenticated
USING (user_email = auth.jwt()->>'email');

-- ==================== 12. TABELA: videos ====================
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on videos"
ON videos FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own videos"
ON videos FOR SELECT TO authenticated
USING (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can insert own videos"
ON videos FOR INSERT TO authenticated
WITH CHECK (user_email = auth.jwt()->>'email');

CREATE POLICY "Users can update own videos"
ON videos FOR UPDATE TO authenticated
USING (user_email = auth.jwt()->>'email')
WITH CHECK (user_email = auth.jwt()->>'email');

-- ==================== 13. TABELA: voice_cache_pool ====================
ALTER TABLE voice_cache_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on voice_cache_pool"
ON voice_cache_pool FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Cache de vozes é público (leitura)
CREATE POLICY "Anyone can read voice cache"
ON voice_cache_pool FOR SELECT TO authenticated, anon
USING (true);

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

-- Listar todas as tabelas com RLS habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Listar todas as políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verificar se há alguma política duplicada (não deve ter)
SELECT 
  tablename,
  policyname,
  COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, policyname
HAVING COUNT(*) > 1;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- ✅ RLS habilitado em TODAS as 13 tabelas
-- ✅ Service Role tem acesso total (sua API Next.js)
-- ✅ Usuários autenticados veem apenas seus próprios dados
-- ✅ Tabelas públicas (plans, voice_cache_pool) visíveis a todos
-- ✅ Aplicação funcionando normalmente!
-- ============================================================

-- ============================================================
-- TROUBLESHOOTING
-- ============================================================
-- Se algo der errado, você pode desabilitar RLS em uma tabela:
-- ALTER TABLE nome_tabela DISABLE ROW LEVEL SECURITY;
--
-- Ou remover uma política específica:
-- DROP POLICY "nome_da_politica" ON nome_tabela;
--
-- Para ver os erros de RLS no log:
-- SELECT * FROM pg_stat_activity WHERE state = 'active';
-- ============================================================

