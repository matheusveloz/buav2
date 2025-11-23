-- =====================================================
-- FIX: Créditos Free apenas no primeiro acesso
-- =====================================================
-- Problema: Sistema estava dando 90 créditos sempre
-- Solução: Dar 90 créditos apenas no primeiro login
-- =====================================================

-- 1. Verificar usuários atuais do plano free
SELECT 
    email,
    plano,
    creditos,
    creditos_extras,
    created_at,
    CASE 
        WHEN creditos = 90 AND creditos_extras = 0 THEN 'Possível primeiro acesso'
        WHEN creditos < 90 THEN 'Já usou créditos'
        WHEN creditos > 90 THEN 'Tem créditos extras'
        ELSE 'Outros'
    END as status
FROM emails
WHERE plano = 'free'
ORDER BY created_at DESC;

-- 2. Criar trigger para novos usuários (opcional)
-- Este trigger garante que novos usuários free recebam 90 créditos
CREATE OR REPLACE FUNCTION set_initial_free_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for inserção de novo usuário com plano free sem créditos definidos
    IF NEW.plano = 'free' AND NEW.creditos IS NULL THEN
        NEW.creditos := 90;
        NEW.creditos_extras := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger (descomente se quiser usar)
-- DROP TRIGGER IF EXISTS set_initial_credits_trigger ON emails;
-- CREATE TRIGGER set_initial_credits_trigger
-- BEFORE INSERT ON emails
-- FOR EACH ROW
-- EXECUTE FUNCTION set_initial_free_credits();

-- 3. Atualizar usuários free existentes que nunca usaram créditos
-- CUIDADO: Execute com cautela!
-- UPDATE emails
-- SET creditos = 0
-- WHERE plano = 'free' 
--   AND creditos = 90 
--   AND creditos_extras = 0
--   AND NOT EXISTS (
--       SELECT 1 FROM generated_videos_sora 
--       WHERE user_email = emails.email
--   )
--   AND NOT EXISTS (
--       SELECT 1 FROM generated_images 
--       WHERE user_email = emails.email
--   );

-- =====================================================
-- MUDANÇAS NO CÓDIGO:
-- =====================================================
-- 1. lib/profile.ts: DEFAULT_PROFILE.credits mudado de 90 para 0
-- 2. app/auth/callback/page.tsx: Agora cria usuário com 90 créditos no primeiro login
-- =====================================================

