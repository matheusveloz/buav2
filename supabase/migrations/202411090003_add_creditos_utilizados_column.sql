alter table public.videos
  add column if not exists creditos_utilizados integer default 0;

