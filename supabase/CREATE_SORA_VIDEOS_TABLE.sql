-- Tabela para armazenar vídeos gerados com Sora 2 (OpenAI)
CREATE TABLE IF NOT EXISTS generated_videos_sora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES emails(email) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  job_id TEXT UNIQUE,
  video_url TEXT,
  model TEXT NOT NULL CHECK (model IN ('sora-2', 'sora-2-pro')),
  seconds INTEGER NOT NULL CHECK (seconds IN (4, 8, 12)),
  size TEXT NOT NULL,
  has_reference BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_generated_videos_sora_user_email ON generated_videos_sora(user_email);
CREATE INDEX IF NOT EXISTS idx_generated_videos_sora_job_id ON generated_videos_sora(job_id);
CREATE INDEX IF NOT EXISTS idx_generated_videos_sora_status ON generated_videos_sora(status);
CREATE INDEX IF NOT EXISTS idx_generated_videos_sora_created_at ON generated_videos_sora(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE generated_videos_sora ENABLE ROW LEVEL SECURITY;

-- Dropar políticas antigas se existirem
DROP POLICY IF EXISTS "Users can view their own sora videos" ON generated_videos_sora;
DROP POLICY IF EXISTS "Users can insert their own sora videos" ON generated_videos_sora;
DROP POLICY IF EXISTS "Users can update their own sora videos" ON generated_videos_sora;
DROP POLICY IF EXISTS "Users can delete their own sora videos" ON generated_videos_sora;

-- Política: usuários só veem seus próprios vídeos
CREATE POLICY "Users can view their own sora videos"
  ON generated_videos_sora FOR SELECT
  USING (user_email = auth.jwt()->>'email');

-- Política: usuários só podem inserir seus próprios vídeos
CREATE POLICY "Users can insert their own sora videos"
  ON generated_videos_sora FOR INSERT
  WITH CHECK (user_email = auth.jwt()->>'email');

-- Política: usuários só podem atualizar seus próprios vídeos
CREATE POLICY "Users can update their own sora videos"
  ON generated_videos_sora FOR UPDATE
  USING (user_email = auth.jwt()->>'email');

-- Política: usuários só podem deletar seus próprios vídeos
CREATE POLICY "Users can delete their own sora videos"
  ON generated_videos_sora FOR DELETE
  USING (user_email = auth.jwt()->>'email');

-- Comentários
COMMENT ON TABLE generated_videos_sora IS 'Armazena vídeos gerados por Sora 2 da OpenAI';
COMMENT ON COLUMN generated_videos_sora.model IS 'Modelo usado (sora-2 ou sora-2-pro)';
COMMENT ON COLUMN generated_videos_sora.seconds IS 'Duração do vídeo em segundos (4, 8 ou 12)';
COMMENT ON COLUMN generated_videos_sora.size IS 'Resolução do vídeo (ex: 720x1280, 1280x720, 1024x1792, 1792x1024)';
COMMENT ON COLUMN generated_videos_sora.has_reference IS 'Se foi usado uma imagem de referência';
COMMENT ON COLUMN generated_videos_sora.job_id IS 'ID do job na OpenAI Sora API';

