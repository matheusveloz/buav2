alter table if exists public.user_voice_clones
  enable row level security;

create policy if not exists "user_voice_clones_select_own"
  on public.user_voice_clones
  for select
  to authenticated
  using (auth.email() = user_email);

create policy if not exists "user_voice_clones_insert_own"
  on public.user_voice_clones
  for insert
  to authenticated
  with check (auth.email() = user_email);

create policy if not exists "user_voice_clones_update_own"
  on public.user_voice_clones
  for update
  to authenticated
  using (auth.email() = user_email)
  with check (auth.email() = user_email);

create policy if not exists "user_voice_clones_delete_own"
  on public.user_voice_clones
  for delete
  to authenticated
  using (auth.email() = user_email);







