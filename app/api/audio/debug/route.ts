import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getAudioBucket, shouldUseSupabaseStorage } from '@/lib/audio-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const usesSupabaseStorage = shouldUseSupabaseStorage();
    const bucket = getAudioBucket();

    const debugPayload: Record<string, unknown> = {
      storageDriver: usesSupabaseStorage ? 'supabase-storage' : 'filesystem',
      bucket,
    };

    if (usesSupabaseStorage) {
      const listResult = await supabase.storage.from(bucket).list('', { limit: 1 });
      debugPayload.listAttempt = {
        success: !listResult.error,
        error: listResult.error
          ? {
              message: listResult.error.message,
              name: listResult.error.name,
            }
          : null,
        sampleCount: listResult.data?.length ?? 0,
      };
    } else {
      debugPayload.listAttempt = { skipped: true };
    }

    return NextResponse.json({ ok: true, debug: debugPayload });
  } catch (error) {
    console.error('Erro inesperado no debug de áudio', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


