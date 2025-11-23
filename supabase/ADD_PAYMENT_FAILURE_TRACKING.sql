-- Adicionar coluna para rastrear tentativas de falha de pagamento
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS tentativas_falha INTEGER DEFAULT 0;

-- Adicionar comentário explicativo
COMMENT ON COLUMN subscriptions.tentativas_falha IS 'Número de tentativas de pagamento que falharam (Stripe tenta até 4 vezes)';

-- Atualizar registros existentes
UPDATE subscriptions 
SET tentativas_falha = 0 
WHERE tentativas_falha IS NULL;

