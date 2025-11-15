-- Tabela para rastrear gerações de áudio diárias
CREATE TABLE IF NOT EXISTS public.user_audio_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  audio_id uuid,
  CONSTRAINT fk_audio FOREIGN KEY (audio_id) REFERENCES public.user_audios(id) ON DELETE SET NULL
);

-- Índice para performance nas consultas por email e data
CREATE INDEX IF NOT EXISTS user_audio_generations_email_date_idx 
  ON public.user_audio_generations (user_email, generated_at);

-- Função para contar gerações do dia
CREATE OR REPLACE FUNCTION count_daily_audio_generations(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Contar quantos áudios foram gerados hoje
  SELECT COUNT(*)
  INTO v_count
  FROM public.user_audio_generations
  WHERE user_email = p_email
    AND generated_at >= CURRENT_DATE
    AND generated_at < CURRENT_DATE + INTERVAL '1 day';
    
  RETURN v_count;
END;
$$;

-- Comentários
COMMENT ON TABLE public.user_audio_generations IS 'Rastreia gerações de áudio para aplicar limites diários';
COMMENT ON FUNCTION count_daily_audio_generations IS 'Conta quantos áudios um usuário gerou hoje';

