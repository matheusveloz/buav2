import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { synthesizeSpeech, ElevenLabsApiError } from '@/lib/elevenlabs';
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

type GenerateVoicePayload = {
  voiceId: string;
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

    let payload: GenerateVoicePayload;

    try {
      payload = (await request.json()) as GenerateVoicePayload;
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    if (!payload?.voiceId || typeof payload.voiceId !== 'string') {
      return NextResponse.json({ error: 'Informe o voiceId da ElevenLabs.' }, { status: 400 });
    }

    if (!payload?.text || typeof payload.text !== 'string' || payload.text.trim().length === 0) {
      return NextResponse.json({ error: 'Informe o texto que será convertido em áudio.' }, { status: 400 });
    }

    if (payload.text.length > 5000) {
      return NextResponse.json({ error: 'O texto deve conter no máximo 5000 caracteres.' }, { status: 400 });
    }

    // Estimar duração do áudio baseado no texto
    // Aproximação: 16 caracteres = 1 segundo de áudio
    const estimatedDurationSeconds = Math.ceil(payload.text.length / 16);
    
    // Calcular créditos necessários (inicial - pode ser ajustado depois)
    // Fórmula: 30 créditos/minuto = 0.5 créditos/segundo
    let creditsNeeded = Math.max(1, Math.ceil(estimatedDurationSeconds * 0.5));

    console.log('[POST /api/voice/generate] Cálculo de créditos:', {
      textLength: payload.text.length,
      estimatedDuration: estimatedDurationSeconds,
      formula: `${estimatedDurationSeconds}s × 0.5 = ${estimatedDurationSeconds * 0.5}`,
      creditsNeeded,
    });

    // Buscar créditos e plano do usuário
    const { data: profile, error: profileError } = await supabase
      .from('emails')
      .select('creditos, creditos_extras, plano')
      .eq('email', user.email)
      .maybeSingle();

    if (profileError) {
      console.error('[POST /api/voice/generate] Erro ao buscar perfil:', profileError);
      return NextResponse.json({ error: 'Erro ao verificar créditos.' }, { status: 500 });
    }

    const totalCredits = (profile?.creditos ?? 0) + (profile?.creditos_extras ?? 0);
    const userPlan = profile?.plano ?? 'free';

    // Verificar limite diário para plano FREE
    if (userPlan === 'free') {
      const { data: dailyCount, error: countError } = await supabase.rpc('count_daily_audio_generations', {
        p_email: user.email,
      });

      if (countError) {
        console.error('[POST /api/voice/generate] Erro ao verificar limite diário:', countError);
        
        // Se a função não existir, permitir (não bloquear por erro de configuração)
        if (countError.code === '42883' || countError.message?.includes('function') || countError.message?.includes('does not exist')) {
          console.warn('[POST /api/voice/generate] Função count_daily_audio_generations não existe, pulando verificação de limite');
        }
      } else {
        const todayGenerations = dailyCount || 0;
        const DAILY_LIMIT_FREE = 3;

        console.log('[POST /api/voice/generate] Verificação de limite (FREE):', {
          email: user.email,
          geracoes_hoje: todayGenerations,
          limite: DAILY_LIMIT_FREE,
        });

        if (todayGenerations >= DAILY_LIMIT_FREE) {
          return NextResponse.json({
            error: 'Limite diário atingido',
            details: `Usuários do plano Free podem gerar até ${DAILY_LIMIT_FREE} áudios por dia. Você já gerou ${todayGenerations} áudios hoje. Faça upgrade para gerar ilimitados!`,
            dailyLimit: DAILY_LIMIT_FREE,
            todayGenerations,
          }, { status: 403 });
        }
      }
    }

    // Verificar se tem créditos suficientes (estimativa) mas NÃO desconta ainda
    if (totalCredits < creditsNeeded) {
      console.log('[POST /api/voice/generate] Créditos insuficientes (estimativa):', {
        email: user.email,
        disponivel: totalCredits,
        estimativa: creditsNeeded,
      });
      return NextResponse.json({
        error: 'Créditos insuficientes',
        details: `Você precisa de aproximadamente ${creditsNeeded} créditos para este áudio, mas possui apenas ${totalCredits}.`,
      }, { status: 403 });
    }

    console.log('✅ Verificação de créditos OK (não descontado ainda):', {
      email: user.email,
      disponivel: totalCredits,
      estimativa: creditsNeeded,
    });

    const baseFileName = payload.filename?.trim().replace(/[^a-zA-Z0-9-_]/g, '_') || `voz-${Date.now()}`;

    // Verificar se é uma voz virtual (começa com 'virtual-')
    const isVirtualVoice = payload.voiceId.startsWith('virtual-');
    let audioBuffer: ArrayBuffer;
    let tempVoiceId: string | null = null;

    if (isVirtualVoice) {
      // Buscar a voz virtual no banco para pegar a URL do áudio
      const { data: virtualVoice, error: fetchError } = await supabase
        .from('user_voice_clones')
        .select('sample_url')
        .eq('voice_id', payload.voiceId)
        .eq('user_email', user.email)
        .maybeSingle();

      if (fetchError || !virtualVoice?.sample_url) {
        return NextResponse.json(
          { error: 'Voz virtual não encontrada ou sem áudio de referência.' },
          { status: 404 }
        );
      }

      console.log('[POST /api/voice/generate] Gerando com voz virtual (clone temporário):', {
        virtualVoiceId: payload.voiceId,
        audioUrl: virtualVoice.sample_url,
      });

      // Usar endpoint de CACHE (reutiliza vozes para mesmo áudio)
      const cloneResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/voice/generate-cached`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': request.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({
          audioUrl: virtualVoice.sample_url,
          text: payload.text,
          modelId: payload.modelId,
          voiceSettings: payload.voiceSettings,
          responseFormat: payload.responseFormat,
          filename: payload.filename,
        }),
      });

      if (!cloneResponse.ok) {
        const error = await cloneResponse.json().catch(() => ({ error: 'Erro ao gerar com voz virtual' }));
        throw new Error(error?.error ?? error?.details ?? 'Falha ao gerar áudio com voz virtual.');
      }

      // Retornar a resposta diretamente
      return cloneResponse;
    }

    // Modo normal: voz padrão ou clonada permanente da ElevenLabs
    audioBuffer = await synthesizeSpeech({
      voiceId: payload.voiceId,
      text: payload.text,
      modelId: payload.modelId,
      voiceSettings: payload.voiceSettings,
      responseFormat: payload.responseFormat,
    });

    const extension = payload.responseFormat === 'pcm_16000' ? 'pcm' : 'mp3';

    // Calcular duração REAL do áudio gerado (mas NÃO desconta ainda)
    let realDuration = estimatedDurationSeconds;
    if (extension === 'mp3') {
      realDuration = await getMP3Duration(audioBuffer);
      console.log('[POST /api/voice/generate] 🎵 Duração real do áudio:', {
        estimatedDuration: estimatedDurationSeconds,
        realDuration,
      });
    }

    const realCredits = calculateCreditsFromDuration(realDuration);
    creditsNeeded = realCredits;

    console.log('📊 Créditos a cobrar (baseado em duração real):', {
      duracao_real: realDuration,
      creditos_reais: realCredits,
    });

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
      // PGRST204 = PostgREST: coluna não encontrada no schema cache
      // 42703 = PostgreSQL: coluna não existe
      if (insertError && (insertError.code === '42703' || insertError.code === 'PGRST204')) {
        console.warn('[POST /api/voice/generate] Campo generated_by_voice_api não existe, tentando sem ele');
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
        console.error('[POST /api/voice/generate] Falha ao registrar áudio no banco:', {
          error: insertError,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        });
        return null;
      }

      if (!inserted) {
        console.error('[POST /api/voice/generate] Insert retornou null sem erro');
        return null;
      }

      return inserted;
    };

    if (shouldUseSupabaseStorage()) {
      const bucket = getAudioBucket();
      const fileId = randomUUID();
      const storagePath = `${user.id}/${fileId}.${extension}`;
      const mimeType =
        extension === 'pcm' ? 'audio/wave' : payload.responseFormat === 'mp3_44100_64' ? 'audio/mpeg' : 'audio/mpeg';
      const buffer = Buffer.from(audioBuffer);

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType: mimeType,
        upsert: false,
      });

      if (uploadError) {
        console.error('[POST /api/voice/generate] Falha ao enviar áudio para Supabase Storage:', uploadError);
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
        original_filename: `${baseFileName}.${extension}`,
        extension,
        generated_by_voice_api: true,
      });

      if (!inserted) {
        return NextResponse.json(
          {
            error: 'Áudio gerado, mas não foi possível registrar o arquivo.',
            details: 'Verifique os logs do servidor para mais informações.',
          },
          { status: 500 },
        );
      }

      // AGORA SIM descontar créditos (áudio foi salvo com sucesso)
      console.log('💰 Descontando créditos após salvar áudio:', {
        duracao_real: realDuration,
        creditos: realCredits,
      });

      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_atomic', {
        p_email: user.email,
        p_credits_to_deduct: realCredits,
      });

      if (deductError || !deductResult || deductResult.length === 0) {
        console.error('❌ Erro ao descontar créditos:', deductError);
        return NextResponse.json(
          { error: 'Áudio salvo, mas erro ao processar cobrança. Entre em contato com suporte.' },
          { status: 500 }
        );
      }

      const result = deductResult[0];

      if (!result.success) {
        console.error('❌ Falha ao descontar créditos:', result.error_message);
        return NextResponse.json(
          { error: 'Áudio salvo, mas erro ao processar cobrança. Entre em contato com suporte.' },
          { status: 500 }
        );
      }

      console.log('✅ Créditos descontados (duração real):', {
        cobrado: realCredits,
        saldo_novo: result.total_remaining,
      });

      // Registrar geração para contagem diária
      console.log('[POST /api/voice/generate] 📝 Tentando registrar geração:', {
        user_email: user.email,
        audio_id: inserted.id,
      });

      const { data: genData, error: genError } = await supabase
        .from('user_audio_generations')
        .insert({
          user_email: user.email,
          audio_id: inserted.id,
        })
        .select();

      if (genError) {
        console.error('[POST /api/voice/generate] ⚠️ ERRO ao registrar geração diária:', {
          error: genError,
          code: genError.code,
          message: genError.message,
          details: genError.details,
          hint: genError.hint,
        });
        
        // Tentar sem audio_id (nullable) se FK falhar
        if (genError.code === '23503' || genError.message?.includes('foreign key')) {
          console.warn('[POST /api/voice/generate] FK constraint falhou, tentando sem audio_id');
          const { error: retryError } = await supabase
            .from('user_audio_generations')
            .insert({
              user_email: user.email,
              audio_id: null,
            });
          
          if (retryError) {
            console.error('[POST /api/voice/generate] ⚠️ Retry também falhou:', retryError);
          } else {
            console.log('[POST /api/voice/generate] ✅ Geração registrada SEM audio_id');
          }
        } else if (genError.code === '42P01' || genError.message?.includes('does not exist')) {
          console.warn('[POST /api/voice/generate] ⚠️ Tabela user_audio_generations não existe. Execute: supabase/APPLY_DAILY_AUDIO_LIMIT.sql');
        }
      } else {
        console.log('[POST /api/voice/generate] ✅ Geração registrada para contagem diária:', genData);
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
          creditsDeducted: creditsNeeded,
          newBalance: {
            creditos: result.new_creditos,
            creditos_extras: result.new_creditos_extras,
            total: result.total_remaining,
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
      return NextResponse.json({ error: 'Áudio gerado, mas não foi possível registrar o arquivo.' }, { status: 500 });
    }

    // AGORA SIM descontar créditos (áudio foi salvo com sucesso)
    console.log('💰 Descontando créditos após salvar áudio (FS):', {
      duracao_real: realDuration,
      creditos: realCredits,
    });

    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_atomic', {
      p_email: user.email,
      p_credits_to_deduct: realCredits,
    });

    if (deductError || !deductResult || deductResult.length === 0) {
      console.error('❌ Erro ao descontar créditos:', deductError);
      return NextResponse.json(
        { error: 'Áudio salvo, mas erro ao processar cobrança. Entre em contato com suporte.' },
        { status: 500 }
      );
    }

    const result = deductResult[0];

    if (!result.success) {
      console.error('❌ Falha ao descontar créditos:', result.error_message);
      return NextResponse.json(
        { error: 'Áudio salvo, mas erro ao processar cobrança. Entre em contato com suporte.' },
        { status: 500 }
      );
    }

    console.log('✅ Créditos descontados (duração real - FS):', {
      cobrado: realCredits,
      saldo_novo: result.total_remaining,
    });

    // Registrar geração para contagem diária
    console.log('[POST /api/voice/generate] 📝 Tentando registrar geração:', {
      user_email: user.email,
      audio_id: inserted.id,
    });

    const { data: genData, error: genError } = await supabase
      .from('user_audio_generations')
      .insert({
        user_email: user.email,
        audio_id: inserted.id,
      })
      .select();

    if (genError) {
      console.error('[POST /api/voice/generate] ⚠️ ERRO ao registrar geração diária:', {
        error: genError,
        code: genError.code,
        message: genError.message,
        details: genError.details,
        hint: genError.hint,
      });
      
      // Tentar sem audio_id se FK falhar
      if (genError.code === '23503' || genError.message?.includes('foreign key')) {
        console.warn('[POST /api/voice/generate] FK constraint falhou, tentando sem audio_id');
        const { error: retryError } = await supabase
          .from('user_audio_generations')
          .insert({
            user_email: user.email,
            audio_id: null,
          });
        
        if (retryError) {
          console.error('[POST /api/voice/generate] ⚠️ Retry também falhou:', retryError);
        } else {
          console.log('[POST /api/voice/generate] ✅ Geração registrada SEM audio_id');
        }
      } else if (genError.code === '42P01' || genError.message?.includes('does not exist')) {
        console.warn('[POST /api/voice/generate] ⚠️ Tabela user_audio_generations não existe. Execute: supabase/APPLY_DAILY_AUDIO_LIMIT.sql');
      }
    } else {
      console.log('[POST /api/voice/generate] ✅ Geração registrada para contagem diária:', genData);
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
    if (error instanceof ElevenLabsApiError) {
      console.error('[POST /api/voice/generate] ElevenLabs API error:', {
        status: error.status,
        details: error.details,
      });

      return NextResponse.json(
        {
          error: 'Falha ao gerar áudio na ElevenLabs.',
          status: error.status,
          details: error.details,
        },
        { status: error.status >= 400 ? error.status : 502 },
      );
    }

    console.error('[POST /api/voice/generate] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao gerar áudio.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}


