-- ============================================
-- TESTE DEFINITIVO: Verificar e Bloquear Conta
-- ============================================

-- PASSO 1: Verificar estado atual
SELECT 
  email,
  ativo AS "Conta Ativa? (1=sim, 0=bloqueado)",
  plano,
  creditos,
  motivo_bloqueio,
  data_bloqueio
FROM emails 
WHERE email = 'empresa.stnnetwork@gmail.com';

-- ============================================
-- RESULTADO ESPERADO:
-- Se ativo = 1 → Conta NÃO está bloqueada
-- Se ativo = 0 → Conta JÁ está bloqueada
-- ============================================

-- PASSO 2: Se ativo = 1, execute isto para BLOQUEAR:
UPDATE emails 
SET 
  ativo = 0,
  motivo_bloqueio = 'Teste de bloqueio - Reembolso simulado',
  data_bloqueio = NOW()
WHERE email = 'empresa.stnnetwork@gmail.com';

-- PASSO 3: Confirmar que bloqueou
SELECT 
  email,
  ativo,
  motivo_bloqueio,
  data_bloqueio
FROM emails 
WHERE email = 'empresa.stnnetwork@gmail.com';

-- ============================================
-- DEVE MOSTRAR:
-- ativo: 0
-- motivo_bloqueio: "Teste de bloqueio..."
-- data_bloqueio: (timestamp atual)
-- ============================================

