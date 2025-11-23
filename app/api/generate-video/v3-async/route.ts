import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ==================== VERSÃO 3.1 - LAOZHANG ASYNC API ====================
// Base URL: https://api.laozhang.ai/v1/videos (ASYNC)
// Docs: https://docs.laozhang.ai/en/api-capabilities/sora2/async-api
// 
// ⭐ VANTAGENS DA API ASSÍNCRONA:
// - Sem cobrança em caso de falha (violação de conteúdo, timeout, etc)
// - Mais estável (baseado em fila de tarefas)
// - Suporte a tarefas de longa duração
// - Polling flexível para verificar progresso
// ==========================================================================

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
const LAOZHANG_ASYNC_BASE_URL = 'https://api.laozhang.ai/v1/videos';

interface GenerateVideoAsyncRequest {
  prompt: string;
  imageBase64?: string;
  model?: string; // Usado para determinar size/seconds
}

// Mapear modelos internos para configurações da API assíncrona
const MODEL_CONFIG: Record<string, { 
  size: '1280x720' | '720x1280' | '1024x1792'; 
  seconds: '10' | '15'; 
  orientation: 'vertical' | 'horizontal'; 
  credits: number;
}> = {
  'sora_video2-15s': { size: '720x1280', seconds: '15', orientation: 'vertical', credits: 21 },
  'sora_video2-landscape-15s': { size: '1280x720', seconds: '15', orientation: 'horizontal', credits: 21 },
  'sora-2-pro-all': { size: '1024x1792', seconds: '15', orientation: 'vertical', credits: 56 }, // $0.40 (doc oficial) - API pode cobrar menos ($0.15) mas doc diz $0.40
};

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 [POST /api/generate-video/v3-async] Versão 3.1 - LaoZhang Async API');

    // Validar API Key
    if (!LAOZHANG_API_KEY) {
      console.error('❌ LAOZHANG_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Serviço de geração de vídeos não configurado' },
        { status: 500 }
      );
    }

    // Obter usuário autenticado
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      console.error('❌ Usuário não autenticado:', userError?.message);
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Parse do body
    const body: GenerateVideoAsyncRequest = await request.json();
    const { prompt, imageBase64, model = 'sora_video2-15s' } = body;

    // 🔍 VERIFICAR CELEBRIDADES/CRIANÇAS NA IMAGEM USANDO GPT-4o (se houver imagem)
    if (imageBase64) {
      try {
        console.log('🔍 Analisando imagem com GPT-4o Vision...');
        const { detectCelebrityWithGPT, shouldBlockGeneration, getBlockMessage } = await import('@/lib/celebrity-detection-gpt');
        
        const detectionResult = await detectCelebrityWithGPT(imageBase64);
        
        if (shouldBlockGeneration(detectionResult)) {
          console.warn(`🚫 BLOQUEIO ATIVADO por GPT-4o:`, {
            isCelebrity: detectionResult.isCelebrity,
            isChild: detectionResult.isChild,
            name: detectionResult.name,
          });
          
          return NextResponse.json({
            error: detectionResult.isChild ? '🚫 Proteção Infantil' : '🚫 Celebridade Detectada',
            details: getBlockMessage(detectionResult),
            celebrity: detectionResult.name,
            isChild: detectionResult.isChild,
            prohibited: true,
          }, { status: 400 });
        }
        
        console.log(`✅ Imagem aprovada por GPT-4o`);
      } catch (error) {
        console.error('⚠️ Erro na detecção GPT-4o (continuando):', error);
      }
    }

    // 🛡️ MODERAR PROMPT (conteúdo explícito/impróprio) - ANTES DE TUDO!
    try {
      console.log('🛡️ Moderando conteúdo do prompt...');
      const { moderatePrompt, getModerationBlockMessage } = await import('@/lib/content-moderation');
      
      const moderationResult = await moderatePrompt(prompt);
      
      if (moderationResult.flagged) {
        console.warn(`🚫 CONTEÚDO IMPRÓPRIO DETECTADO no prompt:`, {
          categories: moderationResult.categories,
          reason: moderationResult.reason,
        });
        
        return NextResponse.json({
          error: '🚫 Conteúdo Impróprio',
          details: getModerationBlockMessage(moderationResult),
          moderationReason: moderationResult.reason,
          categories: moderationResult.categories,
          prohibited: true,
        }, { status: 400 });
      }
      
      console.log('✅ Prompt aprovado pela moderação');
    } catch (error) {
      console.error('⚠️ Erro na moderação do prompt (continuando):', error);
    }

    console.log('📋 Dados da requisição V3 Async:', {
      userEmail: user.email,
      promptLength: prompt.length,
      model,
      hasImageBase64: !!imageBase64,
    });

    // Validações
    if (!prompt || prompt.length > 1000) {
      return NextResponse.json(
        { error: 'Prompt inválido (1-1000 caracteres)' },
        { status: 400 }
      );
    }

    // Obter configuração do modelo
    const config = MODEL_CONFIG[model];
    if (!config) {
      return NextResponse.json(
        { error: 'Modelo não suportado' },
        { status: 400 }
      );
    }

    console.log('💰 Cálculo de créditos V3 Async:', {
      model,
      size: config.size,
      seconds: config.seconds,
      orientation: config.orientation,
      creditsNeeded: config.credits,
      priceUSD: `$${(config.credits * 0.00714).toFixed(2)}`,
    });

    // Rate Limiting
    const rateLimitResult = await rateLimiter.checkLimit(user.email);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: `Limite de requisições atingido. Tente novamente em ${rateLimitResult.resetIn}s` },
        { status: 429 }
      );
    }
    console.log(`✅ Rate limit OK (${rateLimitResult.remaining} remaining)`);

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('emails')
      .select('creditos, creditos_extras')
      .eq('email', user.email)
      .single();

    if (profileError || !profile) {
      console.error('❌ Erro ao buscar perfil:', profileError?.message);
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    console.log('👤 Perfil do usuário:', {
      email: user.email,
      credits: profile.creditos,
      extraCredits: profile.creditos_extras,
      totalCredits: profile.creditos + profile.creditos_extras,
    });

    const totalCredits = profile.creditos + profile.creditos_extras;
    if (totalCredits < config.credits) {
      return NextResponse.json(
        { error: `Créditos insuficientes. Necessário: ${config.credits}, Disponível: ${totalCredits}` },
        { status: 402 }
      );
    }

    // Deduzir créditos ANTES de chamar a API (reembolso automático se falhar)
    let newCredits = profile.creditos;
    let newExtraCredits = profile.creditos_extras;
    
    if (profile.creditos_extras >= config.credits) {
      newExtraCredits -= config.credits;
    } else {
      const remaining = config.credits - profile.creditos_extras;
      newExtraCredits = 0;
      newCredits -= remaining;
    }

    await supabase
      .from('emails')
      .update({
        creditos: newCredits,
        creditos_extras: newExtraCredits,
      })
      .eq('email', user.email);

    console.log('✅ Créditos deduzidos:', { creditsUsed: config.credits, newCredits, newExtraCredits });

    // ⭐ Usar prompt ORIGINAL (usuário melhora manualmente se quiser)
    const finalPrompt = prompt.trim();
    console.log('📝 Prompt a ser usado:', finalPrompt);

    // Criar registro no banco ANTES de chamar a API (status: processing)
    const { data: generatedVideo, error: insertError } = await supabase
      .from('generated_videos_sora')
      .insert({
        user_email: user.email,
        prompt: prompt.trim(),
        status: 'processing',
        model: model,
        seconds: parseInt(config.seconds),
        size: config.size,
        has_reference: !!imageBase64,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar no banco:', insertError.message);
      
      // Reembolsar créditos
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', user.email);
      
      return NextResponse.json({ error: 'Erro ao salvar geração' }, { status: 500 });
    }

    console.log('✅ Registro criado no banco:', { id: generatedVideo.id, status: 'processing' });

    // ==================== CHAMAR LAOZHANG ASYNC API ====================
    console.log('🚀 ============ CHAMANDO LAOZHANG ASYNC API ============');
    console.log('🌐 URL:', LAOZHANG_ASYNC_BASE_URL);
    
    // Determinar qual modelo usar baseado na config
    const apiModel = model === 'sora-2-pro-all' ? 'sora-2-pro-all' : 'sora-2';
    console.log('📝 Model:', apiModel);
    console.log('📝 Size:', config.size);
    console.log('📝 Seconds:', config.seconds);

    let laozhangResponse;

    // Se tiver imagem, usar multipart/form-data
    if (imageBase64) {
      console.log('📸 Modo: Image-to-Video (multipart/form-data)');
      
      // Converter Base64 para Buffer
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Criar FormData
      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('model', apiModel); // ⚡ Usa modelo correto
      formData.append('prompt', finalPrompt);
      formData.append('size', config.size);
      formData.append('seconds', config.seconds);
      formData.append('input_reference', blob, 'image.png');

      laozhangResponse = await fetch(LAOZHANG_ASYNC_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LAOZHANG_API_KEY}`,
        },
        body: formData,
      });
    } else {
      console.log('📝 Modo: Text-to-Video (JSON)');
      
      laozhangResponse = await fetch(LAOZHANG_ASYNC_BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LAOZHANG_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: apiModel, // ⚡ Usa modelo correto
          prompt: finalPrompt,
          size: config.size,
          seconds: config.seconds,
        }),
      });
    }

    if (!laozhangResponse.ok) {
      const errorText = await laozhangResponse.text();
      console.error('❌ Erro da LaoZhang Async API:', laozhangResponse.status, errorText);
      
      // Reembolsar créditos
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', user.email);
      
      // Marcar como falha no banco
      await supabase
        .from('generated_videos_sora')
        .update({ status: 'failed' })
        .eq('id', generatedVideo.id);
      
      return NextResponse.json(
        { error: 'Erro ao criar tarefa de vídeo' },
        { status: 500 }
      );
    }

    const taskData = await laozhangResponse.json();
    console.log('✅ Tarefa criada:', taskData);

    // Salvar task_id (job_id) no banco para polling
    await supabase
      .from('generated_videos_sora')
      .update({ 
        job_id: taskData.id, // ID da tarefa assíncrona
      })
      .eq('id', generatedVideo.id);

    console.log('✅ Task ID salvo no banco:', taskData.id);

    // Retornar sucesso imediatamente (polling será feito pelo frontend)
    return NextResponse.json({
      success: true,
      generationId: generatedVideo.id,
      taskId: taskData.id, // ID da tarefa na LaoZhang
      status: 'processing',
      newCredits,
      newExtraCredits,
      model,
      size: config.size,
      seconds: config.seconds,
      orientation: config.orientation,
      message: 'Vídeo em processamento. Verificando status automaticamente...',
    });

  } catch (error) {
    console.error('❌ Erro geral V3 Async:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

