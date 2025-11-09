create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  task_id text unique not null,
  status text not null default 'pending',
  source_video_url text,
  audio_url text,
  local_video_path text,
  remote_video_url text,
  failure_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists videos_user_email_idx on public.videos (user_email);

