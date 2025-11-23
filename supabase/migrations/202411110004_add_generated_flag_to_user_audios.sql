alter table if exists public.user_audios
  add column if not exists generated_by_voice_api boolean not null default false;








