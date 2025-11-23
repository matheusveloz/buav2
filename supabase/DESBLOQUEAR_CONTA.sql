-- ============================================
-- DESBLOQUEAR CONTA
-- ============================================

-- Execute isto para DESBLOQUEAR a conta e voltar ao normal:

UPDATE emails 
SET 
  ativo = 1,
  motivo_bloqueio = NULL,
  data_bloqueio = NULL
WHERE email = 'empresa.stnnetwork@gmail.com';

-- Verificar que desbloqueou:
SELECT email, ativo, motivo_bloqueio, plano, creditos
FROM emails 
WHERE email = 'empresa.stnnetwork@gmail.com';

-- ============================================
-- Resultado esperado:
-- ativo: 1 (conta ativa)
-- motivo_bloqueio: null
-- data_bloqueio: null
-- ============================================

