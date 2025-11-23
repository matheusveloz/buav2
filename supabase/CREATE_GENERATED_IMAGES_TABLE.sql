-- =====================================================
-- TABELA: generated_images
-- Armazena todas as imagens geradas via Newport AI Flux
-- =====================================================

CREATE TABLE IF NOT EXISTS public.generated_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES public.emails(email) ON DELETE CASCADE,
  
  -- Tipo de geração
  generation_type TEXT NOT NULL CHECK (generation_type IN ('text2image', 'image2image', 'text2image+image2image')),
  
  -- Dados da requisição
  prompt TEXT NOT NULL,
  reference_image_url TEXT, -- URL da imagem de referência (se image2image)
  width INTEGER NOT NULL DEFAULT 512,
  height INTEGER NOT NULL DEFAULT 512,
  seed INTEGER DEFAULT -1,
  num_images INTEGER NOT NULL DEFAULT 1,
  
  -- Dados da tarefa Newport AI
  task_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  
  -- URLs das imagens geradas
  image_urls JSONB, -- Array de URLs: [{"imageUrl": "...", "imageType": "png"}, ...]
  
  -- Créditos
  credits_used INTEGER NOT NULL DEFAULT 2,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_generated_images_user_email ON public.generated_images(user_email);
CREATE INDEX IF NOT EXISTS idx_generated_images_task_id ON public.generated_images(task_id);
CREATE INDEX IF NOT EXISTS idx_generated_images_status ON public.generated_images(status);
CREATE INDEX IF NOT EXISTS idx_generated_images_created_at ON public.generated_images(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas suas próprias imagens
CREATE POLICY "Users can view own generated images"
  ON public.generated_images
  FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

-- Política: usuários podem inserir suas próprias imagens
CREATE POLICY "Users can insert own generated images"
  ON public.generated_images
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- Política: usuários podem atualizar suas próprias imagens
CREATE POLICY "Users can update own generated images"
  ON public.generated_images
  FOR UPDATE
  USING (auth.jwt() ->> 'email' = user_email);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_generated_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.generated_images
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_images_updated_at();

-- Comentários
COMMENT ON TABLE public.generated_images IS 'Armazena todas as imagens geradas via Newport AI Flux API';
COMMENT ON COLUMN public.generated_images.generation_type IS 'Tipo: text2image, image2image, ou text2image+image2image (ambos)';
COMMENT ON COLUMN public.generated_images.credits_used IS '2 créditos por imagem gerada';
COMMENT ON COLUMN public.generated_images.task_id IS 'Task ID retornado pela Newport AI API';
COMMENT ON COLUMN public.generated_images.image_urls IS 'Array JSON com URLs das imagens geradas';

