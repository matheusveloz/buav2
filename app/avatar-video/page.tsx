import { redirect } from 'next/navigation';
import AvatarVideoClient from './avatar-video-client';
import { buildInitialProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { listBuiltinAvatars } from '@/lib/avatar-library';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AvatarVideoPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('Erro ao obter usuário autenticado:', userError.message);
  }

  if (!user?.email) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('emails')
    .select('plano, creditos, creditos_extras')
    .eq('email', user.email)
    .maybeSingle();

  if (profileError) {
    console.error('Erro ao carregar perfil do usuário:', profileError.message);
  }

  const initialProfile = buildInitialProfile(profile);

  const builtinAvatars = await listBuiltinAvatars();

  const { data: userAvatarRows, error: userAvatarsError } = await supabase
    .from('user_avatars')
    .select('id, video_path, original_filename, created_at')
    .eq('user_email', user.email)
    .order('created_at', { ascending: false });

  const isUserAvatarsTableMissing =
    userAvatarsError?.code === '42P01' ||
    userAvatarsError?.message?.toLowerCase().includes('user_avatars');

  if (userAvatarsError && !isUserAvatarsTableMissing) {
    console.error('Erro ao carregar avatares do usuário:', userAvatarsError.message);
  }

  const userAvatars =
    isUserAvatarsTableMissing
      ? []
      : (userAvatarRows ?? [])
          .map((row) => ({
            id: row.id,
            label: row.original_filename ?? 'Avatar personalizado',
            videoUrl: row.video_path ?? '',
            type: 'uploaded' as const,
            createdAt: row.created_at,
          }))
          .filter((avatar) => avatar.videoUrl.length > 0);

  const { data: historyRows, error: historyError } = await supabase
    .from('videos')
    .select('id, task_id, status, local_video_path, remote_video_url, creditos_utilizados, created_at, source_video_url')
    .eq('user_email', user.email)
    .is('deleted_at', null) // 🔥 Filtrar vídeos deletados (soft delete)
    .order('created_at', { ascending: false })
    .limit(18);

  const isVideosTableMissing =
    historyError?.code === '42P01' ||
    historyError?.message?.toLowerCase().includes('videos');

  if (historyError && !isVideosTableMissing) {
    console.error('Erro ao carregar histórico de vídeos:', historyError.message);
  }

  const history =
    isVideosTableMissing
      ? []
      : historyRows?.map((item) => ({
          id: item.id,
          taskId: item.task_id,
          status: item.status,
          createdAt: item.created_at,
          localVideoPath: item.local_video_path,
          remoteVideoUrl: item.remote_video_url,
          creditosUtilizados: item.creditos_utilizados,
          avatarLabel: 'Avatar',
          previewVideoUrl: item.source_video_url, // URL do avatar original (para preview enquanto processa)
        })) ?? [];

  // Buscar áudios do usuário
  const { data: userAudioRows, error: userAudiosError } = await supabase
    .from('user_audios')
    .select('id, audio_url, original_filename, extension, created_at, generated_by_voice_api')
    .eq('user_email', user.email)
    .order('created_at', { ascending: false });

  const isUserAudiosTableMissing =
    userAudiosError?.code === '42P01' ||
    userAudiosError?.message?.toLowerCase().includes('user_audios');

  if (userAudiosError && !isUserAudiosTableMissing) {
    console.error('Erro ao carregar áudios do usuário:', userAudiosError.message);
  }

  const userAudios =
    isUserAudiosTableMissing
      ? []
      : (userAudioRows ?? [])
          .map((row) => ({
            id: row.id,
            name: row.original_filename ?? 'Áudio',
            url: row.audio_url ?? '',
            duration: undefined, // Será calculado no cliente se necessário
            generatedByVoiceApi: row.generated_by_voice_api ?? false,
          }))
          .filter((audio) => audio.url.length > 0);

  return (
    <AvatarVideoClient
      initialProfile={initialProfile}
      userEmail={user.email}
      userId={user.id}
      builtinAvatars={builtinAvatars}
      userAvatars={userAvatars}
      userAudios={userAudios}
      initialHistory={history}
    />
  );
}

