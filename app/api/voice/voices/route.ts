import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { listElevenLabsVoices, type ElevenLabsVoice, ElevenLabsApiError } from '@/lib/elevenlabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type VoicePayload = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  previewUrl?: string | null;
  type: 'native' | 'cloned';
  owned?: boolean;
  labels?: Record<string, unknown> | null;
  audioUrl?: string; // URL do áudio de referência (para vozes virtuais)
};

function mapVoice(voice: ElevenLabsVoice, type: VoicePayload['type'], owned = false): VoicePayload {
  return {
    id: voice.voice_id,
    name: voice.name,
    description: voice.description ?? null,
    category: voice.category ?? null,
    previewUrl: voice.preview_url ?? null,
    type,
    owned,
    labels: voice.labels ?? null,
  };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { data: clones, error: clonesError } = await supabase
      .from('user_voice_clones')
      .select('voice_id, name, description, category, sample_url, labels')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false });

    if (clonesError) {
      console.error('[GET /api/voice/voices] Erro ao carregar clones do usuário:', clonesError);
    }

    let voicesFromApi: ElevenLabsVoice[] = [];
    let warning: string | null = null;

    try {
      voicesFromApi = await listElevenLabsVoices();
    } catch (error) {
      warning =
        error instanceof ElevenLabsApiError
          ? `Falha ao carregar vozes da ElevenLabs (${error.status}).`
          : 'Falha ao carregar vozes da ElevenLabs.';
      console.error('[GET /api/voice/voices] Falha ao consultar ElevenLabs:', error);
    }

    const voices: VoicePayload[] = [];

    const nativeVoices = voicesFromApi
      .filter((voice) => {
        const category = (voice.category ?? '').toLowerCase();
        return !category.includes('cloned') && !category.includes('custom');
      })
      .slice(0, 5);

    nativeVoices.forEach((voice) => {
      voices.push(mapVoice(voice, 'native', false));
    });

    const userClones =
      clones?.map((clone) => ({
        id: clone.voice_id,
        name: clone.name ?? 'Voz personalizada',
        description: clone.description ?? null,
        category: clone.category ?? 'cloned',
        previewUrl: clone.sample_url ?? null,
        labels: (clone.labels as Record<string, unknown> | null) ?? null,
        type: 'cloned' as const,
        owned: true,
        audioUrl: clone.sample_url ?? undefined, // Incluir audioUrl para vozes virtuais
      })) ?? [];

    voices.push(...userClones);

    return NextResponse.json({
      voices,
      warning,
    });
  } catch (error) {
    console.error('[GET /api/voice/voices] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao carregar vozes.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}


