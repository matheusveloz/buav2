create table if not exists public.user_avatars (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  video_path text not null,
  preview_path text,
  thumbnail_path text,
  original_filename text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_avatars_user_email_idx on public.user_avatars (user_email);

