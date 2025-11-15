-- Adicionar campo para armazenar o public_id do Cloudinary
alter table public.videos
  add column if not exists cloudinary_public_id text;

-- Criar índice para facilitar busca
create index if not exists videos_cloudinary_public_id_idx 
  on public.videos (cloudinary_public_id);

