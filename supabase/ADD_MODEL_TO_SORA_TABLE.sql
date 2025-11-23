-- Adicionar coluna 'model' à tabela generated_videos_sora
ALTER TABLE generated_videos_sora 
ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'sora-2';

-- Adicionar constraint para validar o modelo
ALTER TABLE generated_videos_sora
DROP CONSTRAINT IF EXISTS generated_videos_sora_model_check;

ALTER TABLE generated_videos_sora
ADD CONSTRAINT generated_videos_sora_model_check 
CHECK (model IN ('sora-2', 'sora-2-pro'));

-- Comentário
COMMENT ON COLUMN generated_videos_sora.model IS 'Modelo usado (sora-2 ou sora-2-pro)';

