create table if not exists public.user_audios (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  audio_url text not null,
  storage_bucket text,
  storage_path text,
  original_filename text,
  extension text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_audios_user_email_idx on public.user_audios (user_email);


