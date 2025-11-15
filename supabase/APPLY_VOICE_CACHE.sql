-- ================================================================
-- SCRIPT PARA CRIAR TABELA DE CACHE DE VOZES
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- Criar tabela de cache de vozes clonadas
CREATE TABLE IF NOT EXISTS public.voice_cache_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id text NOT NULL UNIQUE, -- ID da voz na ElevenLabs
  audio_url_hash text NOT NULL UNIQUE, -- SHA256 hash da URL do áudio
  audio_url text NOT NULL, -- URL original do áudio de referência
  voice_name text NOT NULL, -- Nome da voz clonada (ex: cache-abc123)
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_used_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  use_count integer NOT NULL DEFAULT 1 -- Contador de quantas vezes foi usada
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS voice_cache_pool_hash_idx ON public.voice_cache_pool (audio_url_hash);
CREATE INDEX IF NOT EXISTS voice_cache_pool_last_used_idx ON public.voice_cache_pool (last_used_at);

-- Comentários para documentação
COMMENT ON TABLE public.voice_cache_pool IS 'Pool de vozes clonadas cacheadas para reutilização (máx 25-30)';
COMMENT ON COLUMN public.voice_cache_pool.audio_url_hash IS 'Hash SHA256 da URL do áudio - usado para identificar áudios duplicados';
COMMENT ON COLUMN public.voice_cache_pool.use_count IS 'Contador de uso - usado para LRU (Least Recently Used) quando atingir limite';
COMMENT ON COLUMN public.voice_cache_pool.last_used_at IS 'Última vez que a voz foi usada - para gerenciamento LRU';

-- Verificar se a tabela foi criada
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'voice_cache_pool'
ORDER BY ordinal_position;

-- Resultado esperado:
-- Deve mostrar todas as colunas: id, voice_id, audio_url_hash, audio_url, voice_name, created_at, last_used_at, use_count

