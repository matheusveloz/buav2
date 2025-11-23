-- ==========================================
-- Adicionar coluna para LOCK de processamento
-- Evita que múltiplas instâncias do cron processem a mesma task
-- ==========================================

-- 1. Adicionar coluna processing_started_at
ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP;

-- 2. Criar índice para consultas rápidas do Cron
CREATE INDEX IF NOT EXISTS idx_generated_images_processing_lock 
ON generated_images(status, processing_started_at) 
WHERE status = 'processing';

-- 3. Comentário explicativo
COMMENT ON COLUMN generated_images.processing_started_at IS 
'Timestamp de quando o cron iniciou o processamento. Usado para lock atômico e evitar duplicação.';

-- ==========================================
-- Como funciona o LOCK:
-- ==========================================
-- 1. Cron busca tasks com: status='processing' AND processing_started_at IS NULL
-- 2. Cron tenta atualizar: SET processing_started_at=NOW() WHERE processing_started_at IS NULL
-- 3. Se UPDATE retornar 0 rows = outro cron já pegou esta task
-- 4. Se UPDATE retornar 1 row = este cron tem o lock exclusivo
-- ==========================================

