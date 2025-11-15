import { redirect } from 'next/navigation';
import { buildInitialProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import CreateVoiceClient from './create-voice-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CreateVoicePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('[CreateVoicePage] Erro ao obter usuário autenticado:', userError.message);
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
    console.error('[CreateVoicePage] Erro ao carregar perfil do usuário:', profileError.message);
  }

  const initialProfile = buildInitialProfile(profile);

  // Tenta carregar áudios gerados pela API de voz
  // Se a coluna generated_by_voice_api não existir, carrega todos os áudios do usuário
  type AudioRow = {
    id: string;
    audio_url: string;
    original_filename: string | null;
    extension: string | null;
    created_at: string;
    generated_by_voice_api?: boolean | null;
  };

  let audioRows: AudioRow[] | null = null;
  let audioError: { code?: string; message: string } | null = null;

  const firstResult = await supabase
    .from('user_audios')
    .select('id, audio_url, original_filename, extension, created_at, generated_by_voice_api')
    .eq('user_email', user.email)
    .eq('generated_by_voice_api', true)
    .order('created_at', { ascending: false })
    .limit(40);

  // Se der erro de coluna não encontrada, tenta sem filtrar por generated_by_voice_api
  // PGRST204 = PostgREST: coluna não encontrada no schema cache
  // 42703 = PostgreSQL: coluna não existe
  if (firstResult.error && (firstResult.error.code === '42703' || firstResult.error.code === 'PGRST204')) {
    console.warn('[CreateVoicePage] Campo generated_by_voice_api não existe, carregando todos os áudios');
    const retryResult = await supabase
      .from('user_audios')
      .select('id, audio_url, original_filename, extension, created_at')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })
      .limit(40);
    audioRows = retryResult.data as AudioRow[] | null;
    audioError = retryResult.error;
  } else {
    audioRows = firstResult.data as AudioRow[] | null;
    audioError = firstResult.error;
  }

  if (audioError) {
    console.error('[CreateVoicePage] Erro ao carregar áudios do usuário:', audioError.message);
  }

  const initialAudios =
    audioRows?.map((row) => ({
      id: row.id,
      name: row.original_filename ?? 'Áudio',
      url: row.audio_url ?? '',
      extension: row.extension ?? 'mp3',
      createdAt: row.created_at,
    })) ?? [];

  const { data: cloneRows, error: clonesError } = await supabase
    .from('user_voice_clones')
    .select('voice_id, name, description, category, sample_url, created_at')
    .eq('user_email', user.email)
    .order('created_at', { ascending: false });

  if (clonesError) {
    console.error('[CreateVoicePage] Erro ao carregar vozes clonadas do usuário:', clonesError.message);
  }

  const initialClonedVoices =
    cloneRows?.map((clone) => ({
      id: clone.voice_id,
      name: clone.name ?? 'Voz clonada',
      description: clone.description ?? null,
      category: clone.category ?? 'cloned',
      previewUrl: clone.sample_url ?? null,
      createdAt: clone.created_at,
    })) ?? [];

  return (
    <CreateVoiceClient
      initialProfile={initialProfile}
      userEmail={user.email}
      initialAudios={initialAudios}
      initialClonedVoices={initialClonedVoices}
    />
  );
}


