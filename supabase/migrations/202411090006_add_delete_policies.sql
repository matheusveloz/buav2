-- Policies de DELETE para user_avatars
create policy if not exists "user_avatars_delete_own"
  on public.user_avatars
  for delete
  to authenticated
  using (auth.email() = user_email);

-- Policies de DELETE para user_audios
create policy if not exists "user_audios_delete_own"
  on public.user_audios
  for delete
  to authenticated
  using (auth.email() = user_email);

-- Policies de DELETE para videos
create policy if not exists "videos_delete_own"
  on public.videos
  for delete
  to authenticated
  using (auth.email() = user_email);

