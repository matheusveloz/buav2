import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { synthesizeSpeech, cloneElevenLabsVoice, ElevenLabsApiError } from '@/lib/elevenlabs';
import { resolveFileExtension, saveAudioFile } from '@/lib/file-storage';
import { getMP3Duration, calculateCreditsFromDuration } from '@/lib/audio-duration';

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

async function deleteElevenLabsVoice(voiceId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY não configurada');

  const url = `${process.env.ELEVENLABS_API_URL?.trim() || 'https://api.elevenlabs.io'}/v1/voices/${voiceId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  });

  if (!response.ok) {
    console.warn('[DELETE Voice] Falha ao deletar voz temporária:', voiceId, response.status);
  } else {
    console.log('[DELETE Voice] Voz temporária deletada:', voiceId);
  }
}

type GenerateWithClonePayload = {
  audioUrl: string; // URL do áudio de referência
  voiceName?: string; // Nome temporário da voz
  text: string;
  modelId?: string;
  voiceSettings?: Record<string, unknown>;
  responseFormat?: 'mp3_44100_128' | 'mp3_44100_64' | 'pcm_16000';
  filename?: string;
};

export async function POST(request: NextRequest) {
  let tempVoiceId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    let payload: GenerateWithClonePayload;

    try {
      payload = (await request.json()) as GenerateWithClonePayload;
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    if (!payload?.audioUrl || typeof payload.audioUrl !== 'string') {
      return NextResponse.json({ error: 'Informe o audioUrl (URL do áudio de referência).' }, { status: 400 });
    }

    if (!payload?.text || typeof payload.text !== 'string' || payload.text.trim().length === 0) {
      return NextResponse.json({ error: 'Informe o texto que será convertido em áudio.' }, { status: 400 });
    }

    if (payload.text.length > 5000) {
      return NextResponse.json({ error: 'O texto deve conter no máximo 5000 caracteres.' }, { status: 400 });
    }

    // Calcular créditos necessários (30 créditos/minuto = 0.5 créditos/segundo)
    const estimatedDurationSeconds = Math.ceil(payload.text.length / 16);
    let creditsNeeded = Math.max(1, Math.ceil(estimatedDurationSeconds * 0.5));

    console.log('[POST /api/voice/generate-with-clone] Cálculo de créditos:', {
      textLength: payload.text.length,
      estimatedDuration: estimatedDurationSeconds,
      creditsNeeded,
    });

    // Verificar e descontar créditos
    const { data: profile, error: profileError } = await supabase
      .from('emails')
      .select('creditos, creditos_extras, plano')
      .eq('email', user.email)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: 'Erro ao verificar créditos.' }, { status: 500 });
    }

    const totalCredits = (profile?.creditos ?? 0) + (profile?.creditos_extras ?? 0);
    const userPlan = profile?.plano ?? 'free';

    // Verificar limite diário para plano FREE
    if (userPlan === 'free') {
      const { data: dailyCount } = await supabase.rpc('count_daily_audio_generations', {
        p_email: user.email,
      });

      let todayGenerations = 0;
      if (typeof dailyCount === 'number') {
        todayGenerations = dailyCount;
      } else if (Array.isArray(dailyCount) && dailyCount.length > 0) {
        todayGenerations = dailyCount[0]?.audios_hoje ?? 0;
      }

      const DAILY_LIMIT_FREE = 3;

      if (todayGenerations >= DAILY_LIMIT_FREE) {
        return NextResponse.json({
          error: 'Limite diário atingido',
          details: `Usuários do plano Free podem gerar até ${DAILY_LIMIT_FREE} áudios por dia. Você já gerou ${todayGenerations} áudios hoje. Faça upgrade para gerar ilimitados!`,
        }, { status: 403 });
      }
    }

    // Verificar créditos (estimativa - NÃO desconta ainda)
    if (totalCredits < creditsNeeded) {
      return NextResponse.json({
        error: 'Créditos insuficientes',
        details: `Você precisa de aproximadamente ${creditsNeeded} créditos, mas possui apenas ${totalCredits}.`,
      }, { status: 403 });
    }

    console.log('✅ Verificação OK (não descontado ainda):', {
      disponivel: totalCredits,
      estimativa: creditsNeeded,
    });

    console.log('[POST /api/voice/generate-with-clone] Iniciando clone temporário:', {
      audioUrl: payload.audioUrl,
      textLength: payload.text.length,
      voiceName: payload.voiceName,
    });

    // Passo 1: Baixar o áudio de referência
    const audioResponse = await fetch(payload.audioUrl);
    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: `Falha ao baixar áudio de referência (${audioResponse.status})` },
        { status: 400 }
      );
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const contentType = audioResponse.headers.get('content-type') ?? 'audio/mpeg';
    const extension = contentType.includes('wav') ? 'wav' : contentType.includes('m4a') ? 'm4a' : 'mp3';

    console.log('[POST /api/voice/generate-with-clone] Áudio baixado:', {
      size: audioBuffer.byteLength,
      type: contentType,
      extension,
    });

    // Passo 2: Clonar voz temporariamente
    const clonedVoice = await cloneElevenLabsVoice({
      name: payload.voiceName || `temp-${Date.now()}`,
      description: 'Voz temporária (será deletada após uso)',
      files: [{
        buffer: audioBuffer,
        fileName: `sample.${extension}`,
        mimeType: contentType,
      }],
      makePublic: false,
      removeBackgroundNoise: true, // Remove ruído de fundo automaticamente ✨
    });

    tempVoiceId = clonedVoice.voice_id;

    console.log('[POST /api/voice/generate-with-clone] Voz temporária criada:', tempVoiceId);

    // Passo 3: Gerar áudio com a voz clonada
    const generatedAudio = await synthesizeSpeech({
      voiceId: tempVoiceId,
      text: payload.text,
      modelId: payload.modelId,
      voiceSettings: payload.voiceSettings,
      responseFormat: payload.responseFormat,
    });

    console.log('[POST /api/voice/generate-with-clone] Áudio gerado com sucesso');

    const outputExtension = payload.responseFormat === 'pcm_16000' ? 'pcm' : 'mp3';

    // Calcular duração REAL e descontar créditos
    let realDuration = estimatedDurationSeconds;
    if (outputExtension === 'mp3') {
      realDuration = await getMP3Duration(generatedAudio);
      console.log('[POST /api/voice/generate-with-clone] 🎵 Duração real:', {
        estimativa: estimatedDurationSeconds,
        real: realDuration,
      });
    }

    const realCredits = calculateCreditsFromDuration(realDuration);
    creditsNeeded = realCredits;

    console.log('📊 Créditos a cobrar (duração real):', realCredits);

    // Passo 4: Deletar voz temporária (não aguarda, faz em background)
    void deleteElevenLabsVoice(tempVoiceId).catch((err) => {
      console.error('[POST /api/voice/generate-with-clone] Erro ao deletar voz temporária:', err);
    });

    const baseFileName = payload.filename?.trim().replace(/[^a-zA-Z0-9-_]/g, '_') || `voz-${Date.now()}`;

    // Passo 5: Salvar áudio gerado
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

      // Se der erro de coluna não encontrada, tenta sem o campo generated_by_voice_api
      if (insertError && (insertError.code === '42703' || insertError.code === 'PGRST204')) {
        console.warn('[POST /api/voice/generate-with-clone] Campo generated_by_voice_api não existe, tentando sem ele');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { generated_by_voice_api: _, ...payloadWithoutField } = insertPayload;
        const retryResult = await supabase
          .from('user_audios')
          .insert(payloadWithoutField)
          .select('*')
          .maybeSingle();
        inserted = retryResult.data;
        insertError = retryResult.error;
      }

      if (insertError) {
        console.error('[POST /api/voice/generate-with-clone] Falha ao registrar áudio:', insertError);
        return null;
      }

      return inserted;
    };

    if (shouldUseSupabaseStorage()) {
      const bucket = getAudioBucket();
      const fileId = randomUUID();
      const storagePath = `${user.id}/${fileId}.${outputExtension}`;
      const mimeType = outputExtension === 'pcm' ? 'audio/wave' : 'audio/mpeg';
      const buffer = Buffer.from(generatedAudio);

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType: mimeType,
        upsert: false,
      });

      if (uploadError) {
        console.error('[POST /api/voice/generate-with-clone] Falha no upload:', uploadError);
        return NextResponse.json(
          { error: 'Falha ao salvar áudio no armazenamento.', details: uploadError.message },
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
        original_filename: `${baseFileName}.${outputExtension}`,
        extension: outputExtension,
        generated_by_voice_api: true,
      });

      if (!inserted) {
        return NextResponse.json(
          { error: 'Áudio gerado, mas não foi possível registrar o arquivo.' },
          { status: 500 },
        );
      }

      // Descontar créditos APÓS salvar com sucesso
      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_atomic', {
        p_email: user.email,
        p_credits_to_deduct: realCredits,
      });

      if (deductError || !deductResult || deductResult.length === 0 || !deductResult[0].success) {
        console.error('[POST /api/voice/generate-with-clone] Erro ao descontar créditos:', deductError);
        return NextResponse.json({ error: 'Áudio salvo, mas erro ao processar cobrança.' }, { status: 500 });
      }

      const result = deductResult[0];

      console.log('✅ Créditos descontados (real):', {
        cobrado: realCredits,
        saldo_novo: result.total_remaining,
      });

      // Registrar geração para contagem diária
      await supabase
        .from('user_audio_generations')
        .insert({
          user_email: user.email,
          audio_id: inserted.id,
        })
        .then(({ error }) => {
          if (error) {
            console.warn('[POST /api/voice/generate-with-clone] Erro ao registrar geração:', error);
          } else {
            console.log('[POST /api/voice/generate-with-clone] ✅ Geração registrada (Storage)');
          }
        });

      return NextResponse.json(
        {
          audio: {
            id: inserted.id,
            url: inserted.audio_url,
            name: inserted.original_filename ?? `${baseFileName}.${outputExtension}`,
            extension: inserted.extension ?? outputExtension,
            type: 'generated' as const,
          },
          creditsDeducted: creditsNeeded,
          newBalance: {
            creditos: deductResult[0].new_creditos,
            creditos_extras: deductResult[0].new_creditos_extras,
            total: deductResult[0].total_remaining,
          },
        },
        { status: 201 },
      );
    }

    const saved = await saveAudioFile(generatedAudio, `${baseFileName}.${outputExtension}`);

    const inserted = await insertAudioRecord({
      id: saved.fileId,
      audio_url: saved.publicPath,
      storage_bucket: null,
      storage_path: null,
      original_filename: `${baseFileName}.${outputExtension}`,
      extension: resolveFileExtension(`${baseFileName}.${outputExtension}`, 'mp3'),
      generated_by_voice_api: true,
    });

    if (!inserted) {
      return NextResponse.json({ error: 'Áudio gerado, mas não foi possível registrar o arquivo.' }, { status: 500 });
    }

    // Descontar créditos APÓS salvar com sucesso (FS)
    const { data: deductResult2, error: deductError2 } = await supabase.rpc('deduct_credits_atomic', {
      p_email: user.email,
      p_credits_to_deduct: realCredits,
    });

    if (deductError2 || !deductResult2 || deductResult2.length === 0 || !deductResult2[0].success) {
      console.error('[POST /api/voice/generate-with-clone] Erro ao descontar créditos (FS):', deductError2);
      return NextResponse.json({ error: 'Áudio salvo, mas erro ao processar cobrança.' }, { status: 500 });
    }

    const result = deductResult2[0];

    console.log('✅ Créditos descontados (real - FS):', {
      cobrado: realCredits,
      saldo_novo: result.total_remaining,
    });

    // Registrar geração para contagem diária
    await supabase
      .from('user_audio_generations')
      .insert({
        user_email: user.email,
        audio_id: inserted.id,
      })
      .then(({ error }) => {
        if (error) {
          console.warn('[POST /api/voice/generate-with-clone] Erro ao registrar geração (FS):', error);
        } else {
          console.log('[POST /api/voice/generate-with-clone] ✅ Geração registrada (FS)');
        }
      });

    return NextResponse.json(
      {
        audio: {
          id: inserted.id,
          url: inserted.audio_url,
          name: inserted.original_filename ?? `${baseFileName}.${outputExtension}`,
          extension: inserted.extension ?? outputExtension,
          type: 'generated' as const,
        },
        creditsDeducted: creditsNeeded,
        newBalance: {
          creditos: result.new_creditos,
          creditos_extras: result.new_creditos_extras,
          total: result.total_remaining,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    // Tentar deletar voz temporária em caso de erro
    if (tempVoiceId) {
      void deleteElevenLabsVoice(tempVoiceId).catch(() => {
        console.warn('[POST /api/voice/generate-with-clone] Não foi possível deletar voz temporária após erro');
      });
    }

    if (error instanceof ElevenLabsApiError) {
      console.error('[POST /api/voice/generate-with-clone] ElevenLabs API error:', {
        status: error.status,
        details: error.details,
      });

      return NextResponse.json(
        {
          error: 'Falha ao gerar áudio com clone temporário.',
          status: error.status,
          details: error.details,
        },
        { status: error.status >= 400 ? error.status : 502 },
      );
    }

    console.error('[POST /api/voice/generate-with-clone] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao gerar áudio.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

