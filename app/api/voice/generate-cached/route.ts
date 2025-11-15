import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
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

/**
 * Sistema de cache de vozes clonadas
 * 
 * ESTRATÉGIA INTELIGENTE:
 * 1. Gera hash SHA256 da URL do áudio de referência
 * 2. Verifica se já existe uma voz clonada com esse hash
 * 3. Se sim: REUTILIZA a voz existente (não cria nova)
 * 4. Se não: Clona e salva o voice_id com o hash
 * 5. Vozes cacheadas ficam na ElevenLabs (máx 30)
 * 6. Quando atingir 30, deleta as mais antigas (LRU - Least Recently Used)
 * 
 * BENEFÍCIOS:
 * - Mesmo áudio = mesma voz clonada (reutilização)
 * - 1000 usuários usando mesmo áudio = 1 clone (não 1000)
 * - Reduz custo drasticamente
 * - Não atinge rate limit facilmente
 */

function generateAudioHash(audioUrl: string): string {
  return createHash('sha256').update(audioUrl).digest('hex').substring(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const payload = (await request.json()) as {
      audioUrl?: string;
      voiceId?: string;
      text: string;
      modelId?: string;
      voiceSettings?: Record<string, unknown>;
      responseFormat?: 'mp3_44100_128' | 'mp3_44100_64' | 'pcm_16000';
      filename?: string;
    };

    if (!payload.text || payload.text.trim().length === 0) {
      return NextResponse.json({ error: 'Informe o texto.' }, { status: 400 });
    }

    if (payload.text.length > 5000) {
      return NextResponse.json({ error: 'Texto muito longo (máx 5000 caracteres).' }, { status: 400 });
    }

    // Estimar duração e calcular créditos (30 créditos/minuto = 0.5 créditos/segundo)
    const estimatedDurationSeconds = Math.ceil(payload.text.length / 16);
    let creditsNeeded = Math.max(1, Math.ceil(estimatedDurationSeconds * 0.5));

    console.log('[POST /api/voice/generate-cached] Cálculo de créditos:', {
      textLength: payload.text.length,
      estimatedDuration: estimatedDurationSeconds,
      creditsNeeded,
    });

    // Buscar créditos e plano do usuário
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

    // Verificar se tem créditos suficientes (estimativa - NÃO desconta ainda)
    if (totalCredits < creditsNeeded) {
      return NextResponse.json({
        error: 'Créditos insuficientes',
        details: `Você precisa de aproximadamente ${creditsNeeded} créditos, mas possui apenas ${totalCredits}.`,
      }, { status: 403 });
    }

    console.log('✅ Verificação de créditos OK (não descontado ainda):', {
      disponivel: totalCredits,
      estimativa: creditsNeeded,
    });

    let voiceIdToUse: string;

    // Modo 1: Voz virtual (audioUrl fornecido)
    if (payload.audioUrl) {
      const audioHash = generateAudioHash(payload.audioUrl);

      console.log('[CACHE] Verificando cache para áudio:', {
        audioUrl: payload.audioUrl,
        hash: audioHash,
      });

      // Verificar se já existe voz cacheada para este áudio
      // Nota: Esta tabela precisa ser criada (voice_cache_pool)
      const { data: cachedVoice } = await supabase
        .from('voice_cache_pool')
        .select('voice_id, use_count')
        .eq('audio_url_hash', audioHash)
        .maybeSingle();

      if (cachedVoice) {
        // CACHE HIT: Reutilizar voz existente
        console.log('[CACHE] ✅ HIT - Reutilizando voz:', cachedVoice.voice_id);
        
        voiceIdToUse = cachedVoice.voice_id;

        // Atualizar contador de uso e last_used_at
        await supabase
          .from('voice_cache_pool')
          .update({
            last_used_at: new Date().toISOString(),
            use_count: (cachedVoice.use_count ?? 0) + 1,
          })
          .eq('audio_url_hash', audioHash);
      } else {
        // CACHE MISS: Precisa clonar
        console.log('[CACHE] ❌ MISS - Clonando nova voz');

        // Verificar quantas vozes cacheadas existem
        const { count } = await supabase
          .from('voice_cache_pool')
          .select('*', { count: 'exact', head: true });

        // Se atingiu limite (ex: 25 de 30), deletar as menos usadas
        const MAX_CACHED_VOICES = 25;
        if (count && count >= MAX_CACHED_VOICES) {
          console.log('[CACHE] Limite atingido, removendo voz menos usada');
          
          const { data: oldestVoice } = await supabase
            .from('voice_cache_pool')
            .select('voice_id, audio_url_hash')
            .order('last_used_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (oldestVoice) {
            // Deletar da ElevenLabs
            try {
              const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
              if (apiKey) {
                await fetch(`https://api.elevenlabs.io/v1/voices/${oldestVoice.voice_id}`, {
                  method: 'DELETE',
                  headers: { 'xi-api-key': apiKey },
                });
              }
            } catch (err) {
              console.warn('[CACHE] Erro ao deletar voz antiga:', err);
            }

            // Deletar do cache
            await supabase
              .from('voice_cache_pool')
              .delete()
              .eq('audio_url_hash', oldestVoice.audio_url_hash);
          }
        }

        // Baixar áudio e clonar
        const audioResponse = await fetch(payload.audioUrl);
        if (!audioResponse.ok) {
          return NextResponse.json(
            { error: 'Falha ao baixar áudio de referência.' },
            { status: 400 }
          );
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        const contentType = audioResponse.headers.get('content-type') ?? 'audio/mpeg';
        const ext = contentType.includes('wav') ? 'wav' : contentType.includes('m4a') ? 'm4a' : 'mp3';

        const clonedVoice = await cloneElevenLabsVoice({
          name: `cache-${audioHash}`,
          description: 'Voz cacheada (reutilizável)',
          files: [{
            buffer: audioBuffer,
            fileName: `sample.${ext}`,
            mimeType: contentType,
          }],
          makePublic: false,
          removeBackgroundNoise: true, // Remove ruído de fundo automaticamente ✨
        });

        voiceIdToUse = clonedVoice.voice_id;

        // Salvar no cache
        await supabase
          .from('voice_cache_pool')
          .insert({
            voice_id: clonedVoice.voice_id,
            audio_url_hash: audioHash,
            audio_url: payload.audioUrl,
            voice_name: `cache-${audioHash}`,
            created_at: new Date().toISOString(),
            last_used_at: new Date().toISOString(),
            use_count: 1,
          });

        console.log('[CACHE] Nova voz clonada e cacheada:', voiceIdToUse);
      }
    } else if (payload.voiceId) {
      // Modo 2: Voz padrão ou permanente
      voiceIdToUse = payload.voiceId;
    } else {
      return NextResponse.json({ error: 'Informe audioUrl ou voiceId.' }, { status: 400 });
    }

    // Gerar áudio
    const audioBuffer = await synthesizeSpeech({
      voiceId: voiceIdToUse,
      text: payload.text,
      modelId: payload.modelId,
      voiceSettings: payload.voiceSettings,
      responseFormat: payload.responseFormat,
    });

    const extension = payload.responseFormat === 'pcm_16000' ? 'pcm' : 'mp3';
    const baseFileName = payload.filename?.trim().replace(/[^a-zA-Z0-9-_]/g, '_') || `voz-${Date.now()}`;

    // Calcular duração REAL e descontar créditos corretos
    let realDuration = estimatedDurationSeconds;
    if (extension === 'mp3') {
      realDuration = await getMP3Duration(audioBuffer);
      console.log('[POST /api/voice/generate-cached] 🎵 Duração real:', {
        estimativa: estimatedDurationSeconds,
        real: realDuration,
      });
    }

    const realCredits = calculateCreditsFromDuration(realDuration);
    creditsNeeded = realCredits;

    console.log('📊 Créditos a cobrar (duração real):', {
      duracao: realDuration,
      creditos: realCredits,
    });

    // Salvar áudio gerado (desconta créditos DEPOIS de salvar)
    const insertAudioRecord = async (data: {
      id: string;
      audio_url: string;
      storage_bucket: string | null;
      storage_path: string | null;
      original_filename: string;
      extension: string;
    }) => {
      const insertPayload: Record<string, unknown> = {
        ...data,
        user_email: user.email,
        generated_by_voice_api: true,
      };

      let { data: inserted, error: insertError } = await supabase
        .from('user_audios')
        .insert(insertPayload)
        .select('*')
        .maybeSingle();

      if (insertError && (insertError.code === '42703' || insertError.code === 'PGRST204')) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { generated_by_voice_api: _, ...withoutField } = insertPayload;
        const retry = await supabase
          .from('user_audios')
          .insert(withoutField)
          .select('*')
          .maybeSingle();
        inserted = retry.data;
        insertError = retry.error;
      }

      return { inserted, insertError };
    };

    if (shouldUseSupabaseStorage()) {
      const bucket = getAudioBucket();
      const fileId = randomUUID();
      const storagePath = `${user.id}/${fileId}.${extension}`;
      const buffer = Buffer.from(audioBuffer);

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType: extension === 'pcm' ? 'audio/wave' : 'audio/mpeg',
        upsert: false,
      });

      if (uploadError) {
        return NextResponse.json({ error: 'Falha ao salvar áudio.', details: uploadError.message }, { status: 500 });
      }

      const { data: publicUrlResult } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      const { inserted } = await insertAudioRecord({
        id: fileId,
        audio_url: publicUrlResult.publicUrl,
        storage_bucket: bucket,
        storage_path: storagePath,
        original_filename: `${baseFileName}.${extension}`,
        extension,
      });

      if (!inserted) {
        return NextResponse.json({ error: 'Falha ao registrar áudio.' }, { status: 500 });
      }

      // Descontar créditos APÓS salvar com sucesso
      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_atomic', {
        p_email: user.email,
        p_credits_to_deduct: realCredits,
      });

      if (deductError || !deductResult || deductResult.length === 0 || !deductResult[0].success) {
        console.error('[POST /api/voice/generate-cached] Erro ao descontar créditos:', deductError);
        return NextResponse.json({ error: 'Áudio salvo, mas erro ao processar cobrança.' }, { status: 500 });
      }

      const result = deductResult[0];

      console.log('✅ Créditos descontados (real):', {
        cobrado: realCredits,
        saldo_novo: result.total_remaining,
      });

      // Registrar geração para contagem diária
      console.log('[POST /api/voice/generate-cached] 📝 Registrando geração:', {
        user_email: user.email,
        audio_id: inserted.id,
      });

      const { error: genError } = await supabase
        .from('user_audio_generations')
        .insert({
          user_email: user.email,
          audio_id: inserted.id,
        });

      if (genError) {
        console.error('[POST /api/voice/generate-cached] ⚠️ Erro ao registrar geração:', genError);
      } else {
        console.log('[POST /api/voice/generate-cached] ✅ Geração registrada');
      }

      return NextResponse.json({ 
        audio: {
          id: inserted.id,
          url: inserted.audio_url,
          name: inserted.original_filename ?? `${baseFileName}.${extension}`,
          extension: inserted.extension ?? extension,
        },
        creditsDeducted: creditsNeeded,
        newBalance: {
          creditos: deductResult[0].new_creditos,
          creditos_extras: deductResult[0].new_creditos_extras,
          total: deductResult[0].total_remaining,
        },
      }, { status: 201 });
    }

    const saved = await saveAudioFile(audioBuffer, `${baseFileName}.${extension}`);

    const { inserted } = await insertAudioRecord({
      id: saved.fileId,
      audio_url: saved.publicPath,
      storage_bucket: null,
      storage_path: null,
      original_filename: `${baseFileName}.${extension}`,
      extension: resolveFileExtension(`${baseFileName}.${extension}`, 'mp3'),
    });

    if (!inserted) {
      return NextResponse.json({ error: 'Falha ao registrar áudio.' }, { status: 500 });
    }

    // Descontar créditos APÓS salvar com sucesso (FS)
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_atomic', {
      p_email: user.email,
      p_credits_to_deduct: realCredits,
    });

    if (deductError || !deductResult || deductResult.length === 0 || !deductResult[0].success) {
      console.error('[POST /api/voice/generate-cached] Erro ao descontar créditos (FS):', deductError);
      return NextResponse.json({ error: 'Áudio salvo, mas erro ao processar cobrança.' }, { status: 500 });
    }

    const result = deductResult[0];

    console.log('✅ Créditos descontados (real - FS):', {
      cobrado: realCredits,
      saldo_novo: result.total_remaining,
    });

    // Registrar geração para contagem diária
    console.log('[POST /api/voice/generate-cached] 📝 Registrando geração (FS):', {
      user_email: user.email,
      audio_id: inserted.id,
    });

    const { error: genError } = await supabase
      .from('user_audio_generations')
      .insert({
        user_email: user.email,
        audio_id: inserted.id,
      });

    if (genError) {
      console.error('[POST /api/voice/generate-cached] ⚠️ Erro ao registrar geração:', genError);
    } else {
      console.log('[POST /api/voice/generate-cached] ✅ Geração registrada (FS)');
    }

    return NextResponse.json({ 
      audio: {
        id: inserted.id,
        url: inserted.audio_url,
        name: inserted.original_filename ?? `${baseFileName}.${extension}`,
        extension: inserted.extension ?? extension,
      },
      creditsDeducted: creditsNeeded,
      newBalance: {
        creditos: deductResult[0].new_creditos,
        creditos_extras: deductResult[0].new_creditos_extras,
        total: deductResult[0].total_remaining,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ElevenLabsApiError) {
      return NextResponse.json({
        error: 'Falha ao gerar áudio.',
        status: error.status,
        details: error.details,
      }, { status: error.status >= 400 ? error.status : 502 });
    }

    return NextResponse.json({
      error: 'Erro interno.',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

