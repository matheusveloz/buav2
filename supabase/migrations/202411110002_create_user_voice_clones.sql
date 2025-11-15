create table if not exists public.user_voice_clones (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  voice_id text not null,
  name text,
  description text,
  category text,
  labels jsonb,
  sample_url text,
  is_public boolean default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_voice_clones_voice_id_key on public.user_voice_clones (voice_id);
create index if not exists user_voice_clones_user_email_idx on public.user_voice_clones (user_email);







