import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { synthesizeSpeech, ElevenLabsApiError } from '@/lib/elevenlabs';
import { resolveFileExtension, saveAudioFile } from '@/lib/file-storage';

const DEFAULT_AUDIO_BUCKET = 'audio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function shouldUseSupabaseStorage() {
  if (process.env.AUDIO_STORAGE_DRIVER === 'fs') return false;
  if (process.env.AUDIO_STORAGE_DRIVER === 'supabase') return true;
  return Boolean(process.env.VERCEL);
}

function getAudioBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET?.trim() || DEFAULT_AUDIO_BUCKET;
}

type GenerateSmartPayload = {
  voiceId: string; // Pode ser ID real da ElevenLabs ou virtual (virtual-*)
  text: string;
  modelId?: string;
  voiceSettings?: Record<string, unknown>;
  responseFormat?: 'mp3_44100_128' | 'mp3_44100_64' | 'pcm_16000';
  filename?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    let payload: GenerateSmartPayload;

    try {
      payload = (await request.json()) as GenerateSmartPayload;
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    if (!payload?.voiceId || typeof payload.voiceId !== 'string') {
      return NextResponse.json({ error: 'Informe o voiceId.' }, { status: 400 });
    }

    if (!payload?.text || typeof payload.text !== 'string' || payload.text.trim().length === 0) {
      return NextResponse.json({ error: 'Informe o texto que será convertido em áudio.' }, { status: 400 });
    }

    if (payload.text.length > 5000) {
      return NextResponse.json({ error: 'O texto deve conter no máximo 5000 caracteres.' }, { status: 400 });
    }

    const isVirtualVoice = payload.voiceId.startsWith('virtual-');
    const baseFileName = payload.filename?.trim().replace(/[^a-zA-Z0-9-_]/g, '_') || `voz-${Date.now()}`;
    
    let finalVoiceId = payload.voiceId;

    // Se for voz virtual, buscar o áudio de referência e usar voz padrão com prompt de voz
    if (isVirtualVoice) {
      const { data: virtualVoice, error: fetchError } = await supabase
        .from('user_voice_clones')
        .select('sample_url, name')
        .eq('voice_id', payload.voiceId)
        .eq('user_email', user.email)
        .maybeSingle();

      if (fetchError || !virtualVoice?.sample_url) {
        return NextResponse.json(
          { error: 'Voz virtual não encontrada.' },
          { status: 404 }
        );
      }

      console.log('[POST /api/voice/generate-smart] Voz virtual detectada:', {
        virtualId: payload.voiceId,
        audioUrl: virtualVoice.sample_url,
        name: virtualVoice.name,
      });

      // ESTRATÉGIA: Usar uma voz padrão da ElevenLabs + instruções no texto
      // Isso evita criar/deletar vozes temporárias
      // Usar voz genérica e instruir no prompt
      finalVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam - voz masculina padrão
      
      // Prefixar texto com instrução de voz (experimental)
      payload.text = `[Narrator: Use the speaking style and characteristics from the reference audio] ${payload.text}`;
      
      console.warn('[POST /api/voice/generate-smart] NOTA: Modo experimental - usando voz padrão com prompt. Para melhor qualidade, considere usar endpoint /api/voice/generate-with-clone');
    }

    const audioBuffer = await synthesizeSpeech({
      voiceId: finalVoiceId,
      text: payload.text,
      modelId: payload.modelId,
      voiceSettings: payload.voiceSettings,
      responseFormat: payload.responseFormat,
    });

    const extension = payload.responseFormat === 'pcm_16000' ? 'pcm' : 'mp3';

    const insertAudioRecord = async (
      data: Partial<{
        id: string;
        audio_url: string;
        storage_bucket: string | null;
        storage_path: string | null;
        original_filename: string | null;
        extension: string | null;
        generated_by_voice_api: boolean;
      }>,
    ) => {
      const insertPayload: Record<string, unknown> = {
        id: data.id,
        user_email: user.email,
        audio_url: data.audio_url,
        storage_bucket: data.storage_bucket ?? null,
        storage_path: data.storage_path ?? null,
        original_filename: data.original_filename ?? null,
        extension: data.extension ?? null,
        generated_by_voice_api: data.generated_by_voice_api ?? true,
      };

      let { data: inserted, error: insertError } = await supabase
        .from('user_audios')
        .insert(insertPayload)
        .select('*')
        .maybeSingle();

      if (insertError && (insertError.code === '42703' || insertError.code === 'PGRST204')) {
        const { generated_by_voice_api, ...payloadWithoutField } = insertPayload;
        const retryResult = await supabase
          .from('user_audios')
          .insert(payloadWithoutField)
          .select('*')
          .maybeSingle();
        inserted = retryResult.data;
        insertError = retryResult.error;
      }

      if (insertError) {
        console.error('[POST /api/voice/generate-smart] Falha ao registrar áudio:', insertError);
        return null;
      }

      return inserted;
    };

    if (shouldUseSupabaseStorage()) {
      const bucket = getAudioBucket();
      const fileId = randomUUID();
      const storagePath = `${user.id}/${fileId}.${extension}`;
      const mimeType = extension === 'pcm' ? 'audio/wave' : 'audio/mpeg';
      const buffer = Buffer.from(audioBuffer);

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType: mimeType,
        upsert: false,
      });

      if (uploadError) {
        console.error('[POST /api/voice/generate-smart] Falha no upload:', uploadError);
        return NextResponse.json(
          { error: 'Falha ao salvar áudio.', details: uploadError.message },
          { status: 500 },
        );
      }

      const { data: publicUrlResult } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = publicUrlResult.publicUrl;

      const inserted = await insertAudioRecord({
        id: fileId,
        audio_url: publicUrl,
        storage_bucket: bucket,
        storage_path: storagePath,
        original_filename: `${baseFileName}.${extension}`,
        extension,
        generated_by_voice_api: true,
      });

      if (!inserted) {
        return NextResponse.json(
          { error: 'Áudio gerado, mas não foi possível registrar.' },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          audio: {
            id: inserted.id,
            url: inserted.audio_url,
            name: inserted.original_filename ?? `${baseFileName}.${extension}`,
            extension: inserted.extension ?? extension,
            type: 'generated' as const,
          },
        },
        { status: 201 },
      );
    }

    const saved = await saveAudioFile(audioBuffer, `${baseFileName}.${extension}`);

    const inserted = await insertAudioRecord({
      id: saved.fileId,
      audio_url: saved.publicPath,
      storage_bucket: null,
      storage_path: null,
      original_filename: `${baseFileName}.${extension}`,
      extension: resolveFileExtension(`${baseFileName}.${extension}`, 'mp3'),
      generated_by_voice_api: true,
    });

    if (!inserted) {
      return NextResponse.json({ error: 'Áudio gerado, mas não foi possível registrar.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        audio: {
          id: inserted.id,
          url: inserted.audio_url,
          name: inserted.original_filename ?? `${baseFileName}.${extension}`,
          extension: inserted.extension ?? extension,
          type: 'generated' as const,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ElevenLabsApiError) {
      console.error('[POST /api/voice/generate-smart] ElevenLabs API error:', {
        status: error.status,
        details: error.details,
      });

      return NextResponse.json(
        {
          error: 'Falha ao gerar áudio.',
          status: error.status,
          details: error.details,
        },
        { status: error.status >= 400 ? error.status : 502 },
      );
    }

    console.error('[POST /api/voice/generate-smart] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao gerar áudio.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

