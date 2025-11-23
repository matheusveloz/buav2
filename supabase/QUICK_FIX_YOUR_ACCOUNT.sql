-- ========================================
-- 🚀 EXECUÇÃO RÁPIDA: Liberar Limite
-- ========================================
-- Execute APENAS este comando para resolver agora:
-- ========================================

UPDATE generated_images 
SET 
  status = 'failed',
  updated_at = NOW()
WHERE user_email = 'jeova251ok@gmail.com'
  AND status = 'processing'
  AND created_at < NOW() - INTERVAL '5 minutes';

-- ✅ Pronto! Agora você pode gerar novamente.

-- ========================================
-- VERIFICAR SE FUNCIONOU
-- ========================================
-- Deve retornar 0 (zero):
SELECT COUNT(*) as still_processing
FROM generated_images
WHERE user_email = 'jeova251ok@gmail.com'
  AND status = 'processing';

