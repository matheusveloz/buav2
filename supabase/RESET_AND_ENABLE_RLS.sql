-- ============================================================
-- RESETAR E HABILITAR RLS - VERSÃO LIMPA
-- ============================================================
-- Este script REMOVE todas as políticas existentes e recria
-- Execute este script NO SQL EDITOR do Supabase
-- ============================================================

-- ==================== PARTE 1: LIMPAR POLÍTICAS EXISTENTES ====================

-- Remover políticas de emails
DROP POLICY IF EXISTS "Service role full access on emails" ON emails;
DROP POLICY IF EXISTS "Service role can do anything on emails" ON emails;
DROP POLICY IF EXISTS "Users can read own profile" ON emails;
DROP POLICY IF EXISTS "Users can view their own profile" ON emails;
DROP POLICY IF EXISTS "Users can update own profile" ON emails;
DROP POLICY IF EXISTS "Users can update their own profile" ON emails;

-- Remover políticas de generated_images
DROP POLICY IF EXISTS "Service role full access on generated_images" ON generated_images;
DROP POLICY IF EXISTS "Users can view own images" ON generated_images;
DROP POLICY IF EXISTS "Users can insert own images" ON generated_images;

-- Remover políticas de generated_videos_sora
DROP POLICY IF EXISTS "Service role full access on generated_videos_sora" ON generated_videos_sora;
DROP POLICY IF EXISTS "Service role can do anything on generated_videos_sora" ON generated_videos_sora;
DROP POLICY IF EXISTS "Users can view own videos" ON generated_videos_sora;
DROP POLICY IF EXISTS "Users can view their own videos" ON generated_videos_sora;
DROP POLICY IF EXISTS "Users can insert own videos" ON generated_videos_sora;
DROP POLICY IF EXISTS "Users can insert their own videos" ON generated_videos_sora;

-- Remover políticas de payments
DROP POLICY IF EXISTS "Service role full access on payments" ON payments;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;

-- Remover políticas de plans
DROP POLICY IF EXISTS "Service role full access on plans" ON plans;
DROP POLICY IF EXISTS "Anyone can view plans" ON plans;

-- Remover políticas de subscriptions
DROP POLICY IF EXISTS "Service role full access on subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;

-- Remover políticas de transactions
DROP POLICY IF EXISTS "Service role full access on transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can do anything on transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;

-- Remover políticas de user_audio_generations
DROP POLICY IF EXISTS "Service role full access on user_audio_generations" ON user_audio_generations;
DROP POLICY IF EXISTS "Users can view own audio generations" ON user_audio_generations;
DROP POLICY IF EXISTS "Users can insert own audio generations" ON user_audio_generations;

-- Remover políticas de user_audios
DROP POLICY IF EXISTS "Service role full access on user_audios" ON user_audios;
DROP POLICY IF EXISTS "Users can view own audios" ON user_audios;
DROP POLICY IF EXISTS "Users can insert own audios" ON user_audios;
DROP POLICY IF EXISTS "Users can delete own audios" ON user_audios;

-- Remover políticas de user_avatars
DROP POLICY IF EXISTS "Service role full access on user_avatars" ON user_avatars;
DROP POLICY IF EXISTS "Users can view own avatars" ON user_avatars;
DROP POLICY IF EXISTS "Users can insert own avatars" ON user_avatars;
DROP POLICY IF EXISTS "Users can delete own avatars" ON user_avatars;

-- Remover políticas de user_voice_clones
DROP POLICY IF EXISTS "Service role full access on user_voice_clones" ON user_voice_clones;
DROP POLICY IF EXISTS "Users can view own voice clones" ON user_voice_clones;
DROP POLICY IF EXISTS "Users can insert own voice clones" ON user_voice_clones;
DROP POLICY IF EXISTS "Users can update own voice clones" ON user_voice_clones;
DROP POLICY IF EXISTS "Users can delete own voice clones" ON user_voice_clones;

-- Remover políticas de videos
DROP POLICY IF EXISTS "Service role full access on videos" ON videos;
DROP POLICY IF EXISTS "Users can view own videos" ON videos;
DROP POLICY IF EXISTS "Users can insert own videos" ON videos;
DROP POLICY IF EXISTS "Users can update own videos" ON videos;

-- Remover políticas de voice_cache_pool
DROP POLICY IF EXISTS "Service role full access on voice_cache_pool" ON voice_cache_pool;
DROP POLICY IF EXISTS "Service role can do anything on voice_cache_pool" ON voice_cache_pool;
DROP POLICY IF EXISTS "Anyone can read voice cache" ON voice_cache_pool;

-- ==================== PARTE 2: HABILITAR RLS E CRIAR POLÍTICAS ====================

-- ==================== 1. TABELA: emails ====================
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on emails"
ON emails FOR ALL TO service_role
USING (true) WITH CHECK (true);

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

CREATE POLICY "Anyone can read voice cache"
ON voice_cache_pool FOR SELECT TO authenticated, anon
USING (true);

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

-- Contar políticas por tabela
SELECT 
  tablename,
  COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- ✅ Todas as políticas antigas removidas
-- ✅ RLS habilitado em TODAS as 13 tabelas
-- ✅ Novas políticas criadas sem conflitos
-- ✅ Service Role = acesso total
-- ✅ Users = acesso apenas aos próprios dados
-- ============================================================

