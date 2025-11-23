-- ============================================
-- TESTE FINAL: Verificar estado atual da conta
-- ============================================

-- Execute esta query no Supabase para ver o estado REAL da conta:

SELECT 
  email,
  ativo AS "Ativo (0=bloqueado, 1=ativo)",
  plano,
  creditos,
  motivo_bloqueio,
  data_bloqueio,
  created_at,
  updated_at
FROM emails 
WHERE email = 'empresa.stnnetwork@gmail.com';

-- ============================================
-- RESULTADO ESPERADO:
-- ativo: 0 (bloqueado)
-- motivo_bloqueio: "Reembolso processado..."
-- ============================================

-- Se ativo = 1, execute isto para bloquear manualmente:
/*
UPDATE emails 
SET 
  ativo = 0,
  motivo_bloqueio = 'Reembolso de teste - Conta bloqueada manualmente',
  data_bloqueio = NOW()
WHERE email = 'empresa.stnnetwork@gmail.com';
*/

-- Depois execute esta query para confirmar:
-- SELECT ativo, motivo_bloqueio FROM emails WHERE email = 'empresa.stnnetwork@gmail.com';

