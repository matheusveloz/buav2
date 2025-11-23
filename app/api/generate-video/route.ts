import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Sistema de créditos por modelo e tamanho (POR SEGUNDO)
// Baseado em: Dólar = R$ 5,40 | Crédito = R$ 0,04
//
// sora-2 (720x1280 / 1280x720): $0.10 = R$ 0,54 = 14 créditos/segundo
// sora-2-pro (720x1280 / 1280x720): $0.30 = R$ 1,62 = 41 créditos/segundo  
// sora-2-pro (1024x1792 / 1792x1024): $0.50 = R$ 2,70 = 68 créditos/segundo
const CREDITS_PER_SECOND: Record<string, number> = {
  'sora-2-720x1280': 14,
  'sora-2-1280x720': 14,
  'sora-2-pro-720x1280': 41,
  'sora-2-pro-1280x720': 41,
  'sora-2-pro-1024x1792': 68,
  'sora-2-pro-1792x1024': 68,
};

function getCreditsForConfig(model: string, size: string, seconds: number): number {
  const key = `${model}-${size}`;
  const creditsPerSecond = CREDITS_PER_SECOND[key] || 14;
  return creditsPerSecond * seconds;
}

interface GenerateVideoRequest {
  prompt: string;
  imageBase64?: string;
  videoBase64?: string;
  model?: string;
  seconds?: number;
  size?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 [POST /api/generate-video] Iniciando geração de vídeo com Sora 2...');

    // Validar API Key
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada');
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
    const body: GenerateVideoRequest = await request.json();
    const { prompt, imageBase64, videoBase64, model = 'sora-2', seconds = 4, size = '720x1280' } = body;

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
            estimatedAge: detectionResult.estimatedAge,
            confidence: detectionResult.confidence,
          });
          
          return NextResponse.json({
            error: detectionResult.isChild ? '🚫 Proteção Infantil' : '🚫 Celebridade Detectada',
            details: getBlockMessage(detectionResult),
            celebrity: detectionResult.name,
            isChild: detectionResult.isChild,
            estimatedAge: detectionResult.estimatedAge,
            confidence: detectionResult.confidence,
            reason: detectionResult.reason,
            prohibited: true,
          }, { status: 400 });
        }
        
        console.log(`✅ Imagem aprovada por GPT-4o`);
      } catch (error) {
        // Se a detecção falhar, continuar (não bloquear por erro técnico)
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

    console.log('📋 Dados da requisição:', {
      userEmail: user.email,
      promptLength: prompt.length,
      model,
      seconds,
      size,
      hasImage: !!imageBase64,
      hasVideo: !!videoBase64,
    });

    // Validações
    if (!prompt || prompt.length > 1000) {
      return NextResponse.json(
        { error: 'Prompt deve ter entre 1 e 1000 caracteres' },
        { status: 400 }
      );
    }

    // Validações de modelo e tamanho
    const validModels = ['sora-2', 'sora-2-pro'];
    if (!validModels.includes(model)) {
      return NextResponse.json(
        { error: 'Modelo inválido' },
        { status: 400 }
      );
    }

    // Validar tamanhos por modelo
    const validSizes: Record<string, string[]> = {
      'sora-2': ['720x1280', '1280x720'],
      'sora-2-pro': ['720x1280', '1280x720', '1024x1792', '1792x1024'],
    };

    if (!validSizes[model].includes(size)) {
      return NextResponse.json(
        { error: `Tamanho ${size} não suportado para ${model}` },
        { status: 400 }
      );
    }

    // Calcular créditos necessários
    const creditsNeeded = getCreditsForConfig(model, size, seconds);

    console.log('💰 Cálculo de créditos:', {
      model,
      size,
      seconds,
      creditsPerSecond: creditsNeeded / seconds,
      creditsNeeded,
    });

    // ⚡ RATE LIMITING: Verificar se pode processar agora
    const limitCheck = await rateLimiter.checkLimit(model);
    
    if (!limitCheck.allowed) {
      console.warn(`⏸️ Rate limit atingido para ${model}`);
      console.warn(`📊 Remaining: ${limitCheck.remaining}, Reset in: ${Math.ceil(limitCheck.resetIn / 1000)}s`);
      
      const waitSeconds = Math.ceil(limitCheck.resetIn / 1000);
      
      return NextResponse.json({
        error: '⏳ Sistema em Alta Demanda\n\n' +
               `O limite de requisições por minuto foi atingido para o modelo ${model === 'sora-2' ? 'V1 Fast' : 'V2 Pro'}.\n\n` +
               `⏰ Aguarde ${waitSeconds} segundos e tente novamente.\n\n` +
               `💡 Dica: Tente usar o outro modelo se disponível!`,
        rateLimitInfo: {
          model,
          resetIn: limitCheck.resetIn,
          waitSeconds,
        }
      }, { status: 429 }); // 429 = Too Many Requests
    }

    // Registrar esta requisição no rate limiter
    rateLimiter.recordRequest(model);
    
    console.log(`✅ Rate limit OK para ${model} (${limitCheck.remaining} remaining)`);


    // Verificar créditos e plano do usuário
    const { data: profile, error: profileError } = await supabase
      .from('emails')
      .select('*')
      .eq('email', user.email)
      .single();

    if (profileError || !profile) {
      console.error('❌ Erro ao buscar perfil:', profileError?.message);
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const totalCredits = profile.creditos + profile.creditos_extras;

    console.log('👤 Perfil do usuário:', {
      email: user.email,
      credits: profile.creditos,
      extraCredits: profile.creditos_extras,
      totalCredits,
      plan: profile.plano,
    });

    // ⚡ LIMITE DIÁRIO PARA PLANO FREE
    if (profile.plano?.toLowerCase() === 'free') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: todayVideos, error: countError } = await supabase
        .from('generated_videos_sora')
        .select('id', { count: 'exact' })
        .eq('user_email', user.email)
        .gte('created_at', today.toISOString());
      
      const videosToday = todayVideos?.length || 0;
      const DAILY_LIMIT_FREE = 2;
      
      console.log('📊 Limite diário FREE:', {
        videosToday,
        limit: DAILY_LIMIT_FREE,
        allowed: videosToday < DAILY_LIMIT_FREE
      });
      
      if (videosToday >= DAILY_LIMIT_FREE) {
        return NextResponse.json(
          { 
            error: `Limite diário atingido`,
            message: `Plano FREE: ${DAILY_LIMIT_FREE} vídeos por dia. Você já gerou ${videosToday} hoje.`,
            limit: DAILY_LIMIT_FREE,
            used: videosToday,
          },
          { status: 429 }
        );
      }
    }

    if (totalCredits < creditsNeeded) {
      console.warn('⚠️ Créditos insuficientes');
      return NextResponse.json(
        {
          error: 'Créditos insuficientes',
          needed: creditsNeeded,
          available: totalCredits,
        },
        { status: 402 }
      );
    }

    // Deduzir créditos (creditos_extras primeiro, depois creditos)
    let newCredits = profile.creditos;
    let newExtraCredits = profile.creditos_extras;

    if (newExtraCredits >= creditsNeeded) {
      newExtraCredits -= creditsNeeded;
    } else {
      const remaining = creditsNeeded - newExtraCredits;
      newExtraCredits = 0;
      newCredits -= remaining;
    }

    const { error: creditsError } = await supabase
      .from('emails')
      .update({
        creditos: newCredits,
        creditos_extras: newExtraCredits,
      })
      .eq('email', user.email);

    if (creditsError) {
      console.error('❌ Erro ao deduzir créditos:', creditsError.message);
      return NextResponse.json({ error: 'Erro ao processar créditos' }, { status: 500 });
    }

    console.log('✅ Créditos deduzidos:', {
      creditsUsed: creditsNeeded,
      newCredits,
      newExtraCredits,
    });

    // ==================== DEBUG MODE ====================
    console.log('🔍 ============ INÍCIO DEBUG MODERAÇÃO ============');
    console.log('📊 Dados recebidos do cliente:', {
      promptOriginal: prompt,
      promptLength: prompt.length,
      model,
      seconds,
      size,
      hasImage: !!imageBase64,
      imageSize: imageBase64 ? imageBase64.length : 0,
    });

    // Testar prompt com API de Moderação ANTES de enviar para Sora
    console.log('🔍 Testando prompt com OpenAI Moderation API...');
    try {
      const moderationResponse = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: prompt,
        }),
      });

      const moderationData = await moderationResponse.json();
      console.log('🔍 Resultado Moderation API:', JSON.stringify(moderationData, null, 2));
      
      if (moderationData.results?.[0]?.flagged) {
        console.warn('⚠️ AVISO: Prompt foi flagged pela Moderation API!');
        console.warn('📋 Categorias flagged:', moderationData.results[0].categories);
        console.warn('📊 Scores:', moderationData.results[0].category_scores);
      } else {
        console.log('✅ Prompt passou na Moderation API');
      }
    } catch (moderationError) {
      console.error('❌ Erro ao chamar Moderation API:', moderationError);
    }

    // Preparar FormData para enviar para OpenAI
    const formData = new FormData();
    formData.append('model', model);
    
    // Melhorar o prompt para evitar bloqueios de moderação
    let enhancedPrompt = prompt.trim();
    
    // Se for animação de imagem, melhorar o prompt
    if (imageBase64) {
      console.log('🔄 Iniciando melhoria de prompt para animação de imagem...');
      
      // 1. Remover referências redundantes à imagem
      enhancedPrompt = enhancedPrompt
        .replace(/^anime\s+(a|essa|esta|this|the)\s+imagem[,:]?\s*/gi, '')
        .replace(/^animar\s+(a|essa|esta|this|the)\s+imagem[,:]?\s*/gi, '')
        .replace(/^animate\s+(a|essa|esta|this|the)\s+(imagem|image)[,:]?\s*/gi, '');
      
      // 2. Traduzir termos comuns português → inglês
      const translations: Record<string, string> = {
        'falando': 'speaking',
        'gesticulando': 'gesturing',
        'sorrindo': 'smiling',
        'acenando': 'waving',
        'olhando': 'looking',
        'cozinhando': 'cooking',
        'trabalhando': 'working',
        'explicando': 'explaining',
        'apresentando': 'presenting',
        'mostrando': 'showing',
        'pessoa': 'person',
        'homem': 'man',
        'mulher': 'woman',
        'cozinha': 'kitchen',
        'escritório': 'office',
        'e': 'and',
        'com': 'with',
        'sobre': 'about',
      };
      
      // Aplicar traduções
      for (const [pt, en] of Object.entries(translations)) {
        const regex = new RegExp(`\\b${pt}\\b`, 'gi');
        enhancedPrompt = enhancedPrompt.replace(regex, en);
      }
      
      // 3. Limpar espaços extras
      enhancedPrompt = enhancedPrompt.trim();
      
      // 4. Se ficou muito curto ou vazio, usar prompt genérico
      if (enhancedPrompt.length < 3) {
        enhancedPrompt = 'person with natural subtle movements';
        console.log('⚠️ Prompt muito curto após limpeza, usando genérico');
      }
      
      // 5. Garantir que começa com letra maiúscula
      enhancedPrompt = enhancedPrompt.charAt(0).toUpperCase() + enhancedPrompt.slice(1);
      
      console.log('🔄 Prompt melhorado:', {
        original: prompt.trim(),
        enhanced: enhancedPrompt,
        changes: prompt.trim() !== enhancedPrompt,
        length: {
          original: prompt.trim().length,
          enhanced: enhancedPrompt.length,
        },
      });
    }
    
    // Testar prompt melhorado com API de Moderação
    if (enhancedPrompt !== prompt.trim()) {
      console.log('🔍 Testando prompt MELHORADO com Moderation API...');
      try {
        const moderationResponse2 = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: enhancedPrompt,
          }),
        });

        const moderationData2 = await moderationResponse2.json();
        console.log('🔍 Resultado Moderation API (melhorado):', JSON.stringify(moderationData2, null, 2));
        
        if (moderationData2.results?.[0]?.flagged) {
          console.warn('⚠️ AVISO: Prompt MELHORADO também foi flagged!');
          console.warn('📋 Categorias flagged:', moderationData2.results[0].categories);
          console.warn('📊 Scores:', moderationData2.results[0].category_scores);
        } else {
          console.log('✅ Prompt melhorado passou na Moderation API');
        }
      } catch (moderationError2) {
        console.error('❌ Erro ao chamar Moderation API (melhorado):', moderationError2);
      }
    }
    
    formData.append('prompt', enhancedPrompt);
    formData.append('seconds', seconds.toString());
    formData.append('size', size);

    console.log('📦 FormData preparado para envio:', {
      model,
      prompt: enhancedPrompt,
      seconds,
      size,
      hasInputReference: !!imageBase64,
    });

    // NOTA: Upload de vídeo DESABILITADO (Video Inpaint não disponível)
    // Apenas imagem está habilitada
    if (videoBase64) {
      console.warn('⚠️ Upload de vídeo detectado mas está DESABILITADO');
      console.warn('📝 Motivo: Video Inpaint não disponível para esta organização');
      
      // Reembolsar créditos
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', user.email);
      
      return NextResponse.json({
        error: '⚠️ Upload de Vídeo Desabilitado\n\n' +
               'Esta funcionalidade requer Video Inpaint, que não está disponível para sua conta.\n\n' +
               'Use apenas imagens ou descrições de texto.',
      }, { status: 400 });
    }

    // Se tiver imagem de referência, redimensionar para o tamanho correto
    if (imageBase64) {
      console.log('🖼️ ============ PROCESSANDO IMAGEM ============');
      console.log('📊 Tamanho base64 recebido:', imageBase64.length);
      
      const base64Data = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;
      
      console.log('📊 Tamanho base64 limpo:', base64Data.length);
      
      // Parsear dimensões do size (ex: "720x1280" -> width: 720, height: 1280)
      const [targetWidth, targetHeight] = size.split('x').map(Number);
      console.log('🎯 Tamanho alvo:', `${targetWidth}x${targetHeight}`);
      
      try {
        // Usar sharp para redimensionar a imagem
        const sharp = (await import('sharp')).default;
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        console.log('📊 Buffer original:', {
          length: imageBuffer.length,
          type: typeof imageBuffer,
        });
        
        const resizedImageBuffer = await sharp(imageBuffer)
          .resize(targetWidth, targetHeight, {
            fit: 'cover',
            position: 'center',
          })
          .jpeg({ quality: 90 })
          .toBuffer();
        
        console.log('✅ Imagem redimensionada:', {
          targetSize: `${targetWidth}x${targetHeight}`,
          originalSize: imageBuffer.length,
          resizedSize: resizedImageBuffer.length,
          reduction: `${((1 - resizedImageBuffer.length / imageBuffer.length) * 100).toFixed(1)}%`,
        });
        
        const file = new File([new Uint8Array(resizedImageBuffer)], 'reference.jpg', { 
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        
        formData.append('input_reference', file);
        
        console.log('📦 Imagem adicionada ao FormData como File:', {
          name: 'reference.jpg',
          type: 'image/jpeg',
          size: file.size,
        });
        
      } catch (resizeError) {
        console.error('❌ Erro ao redimensionar imagem:', resizeError);
        
        // Fallback: enviar imagem sem redimensionar
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const file = new File([new Uint8Array(imageBuffer)], 'reference.jpg', { 
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        formData.append('input_reference', file);
        
        console.log('⚠️ Imagem enviada sem redimensionamento (fallback)');
      }
      
      console.log('✅ Imagem processada e adicionada ao FormData');
      console.log('============================================');
    }

    // Criar registro no banco ANTES de chamar a API (status: processing)
    const { data: generatedVideo, error: insertError } = await supabase
      .from('generated_videos_sora')
      .insert({
        user_email: user.email,
        prompt: prompt.trim(),
        status: 'processing',
        model,
        seconds,
        size,
        has_reference: !!imageBase64, // Apenas imagem habilitada
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

    // Chamar OpenAI Sora 2
    console.log('🚀 ============ ENVIANDO PARA SORA API ============');
    console.log('🌐 Endpoint: https://api.openai.com/v1/videos');
    console.log('🔑 Usando API Key:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 10)}...` : 'NÃO DEFINIDA');
    console.log('📝 Dados sendo enviados:');
    console.log('   - Model:', model);
    console.log('   - Prompt:', enhancedPrompt);
    console.log('   - Seconds:', seconds);
    console.log('   - Size:', size);
    console.log('   - Has Image Reference:', !!imageBase64);
    console.log('   - Has Video Reference: false (desabilitado)');

    const openaiResponse = await fetch('https://api.openai.com/v1/videos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    console.log('📡 Headers da resposta:', Object.fromEntries(openaiResponse.headers.entries()));

    const responseText = await openaiResponse.text();
    console.log('📥 ============ RESPOSTA DA SORA API ============');
    console.log('📊 Status HTTP:', openaiResponse.status);
    console.log('✅ OK?:', openaiResponse.ok);
    console.log('📏 Tamanho da resposta:', responseText.length, 'bytes');
    console.log('📄 Resposta completa (raw):', responseText);
    console.log('📄 Resposta completa (preview):', responseText.substring(0, 500));

    let openaiData;
    try {
      openaiData = JSON.parse(responseText);
    } catch {
      console.error('❌ Erro ao fazer parse da resposta:', responseText);
      
      // Marcar como falhou e reembolsar
      await supabase
        .from('generated_videos_sora')
        .update({ status: 'failed' })
        .eq('id', generatedVideo.id);

      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', user.email);

      return NextResponse.json(
        { error: 'Erro na resposta da API de vídeo' },
        { status: 500 }
      );
    }

    console.log('📥 Resposta COMPLETA da OpenAI:', JSON.stringify(openaiData, null, 2));
    
    console.log('📥 Resposta da OpenAI (parsed):', {
      id: openaiData.id,
      status: openaiData.status,
      object: openaiData.object,
      model: openaiData.model,
    });

    if (!openaiResponse.ok) {
      console.error('❌ ============ ERRO NA SORA API ============');
      console.error('📊 Status HTTP:', openaiResponse.status);
      console.error('📄 Dados do erro:', JSON.stringify(openaiData, null, 2));
      
      // Log específico para erro de moderação
      if (openaiData.error) {
        console.error('🔴 DETALHES DO ERRO:');
        console.error('   - Code:', openaiData.error.code);
        console.error('   - Message:', openaiData.error.message);
        console.error('   - Type:', openaiData.error.type);
        console.error('   - Param:', openaiData.error.param);
        
        // Erro de permissão de inpaint
        if (openaiData.error.message?.includes('inpaint') || 
            openaiData.error.message?.includes('not available for your organization')) {
          console.error('🚨 ============ ERRO DE PERMISSÃO ============');
          console.error('📝 Sua organização não tem acesso a video inpaint');
          console.error('💡 SOLUÇÕES:');
          console.error('   1. Entre em contato com OpenAI para upgrade');
          console.error('   2. Use apenas geração do zero (sem referências)');
          console.error('   3. Verifique tier da conta: platform.openai.com/account/limits');
          console.error('============================================');
        }
        
        if (openaiData.error.code === 'moderation_blocked') {
          console.error('🚨 ============ BLOQUEIO DE MODERAÇÃO ============');
          console.error('📝 Prompt original:', prompt);
          console.error('📝 Prompt enviado (enhanced):', enhancedPrompt);
          console.error('🖼️ Tinha imagem?:', !!imageBase64);
          console.error('📊 Model:', model);
          console.error('📊 Size:', size);
          console.error('📊 Seconds:', seconds);
          console.error('');
          console.error('💡 POSSÍVEIS CAUSAS:');
          console.error('   1. Prompt pode conter termos ambíguos');
          console.error('   2. Imagem de referência pode ter conteúdo sensível');
          console.error('   3. Combinação de prompt + imagem pode violar políticas');
          console.error('   4. Sistema de moderação pode ter falsos positivos');
          console.error('');
          console.error('🔍 SUGESTÕES:');
          console.error('   1. Tente usar prompt em INGLÊS puro');
          console.error('   2. Simplifique a descrição ao máximo');
          console.error('   3. Verifique se a imagem tem conteúdo adequado');
          console.error('   4. Teste sem imagem de referência primeiro');
          console.error('============================================');
        }
      }

      // Marcar como falhou no banco
      await supabase
        .from('generated_videos_sora')
        .update({ status: 'failed' })
        .eq('id', generatedVideo.id);

      // Reembolsar créditos
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', user.email);

      // Mensagem user-friendly para safety system
      const errorCode = openaiData.error?.code || '';
      const errorMessage = openaiData.error?.message || '';
      
      // Erro de permissão de inpaint
      if (errorMessage.includes('inpaint') || errorMessage.includes('not available for your organization')) {
        return NextResponse.json(
          { 
            error: '⚠️ Animação de Imagens/Vídeos Não Disponível\n\n' +
                   'Sua conta OpenAI não tem acesso à funcionalidade Video Inpaint.\n\n' +
                   '✅ O que funciona:\n' +
                   '• Gerar vídeos do zero (apenas texto)\n' +
                   '• Descrições detalhadas sem referências\n\n' +
                   '❌ O que NÃO funciona:\n' +
                   '• Animar imagens (input_reference)\n' +
                   '• Vídeos locais como referência\n\n' +
                   '💡 Como resolver:\n' +
                   '1. Gere vídeos apenas com texto (funciona!)\n' +
                   '2. Entre em contato com OpenAI para upgrade\n' +
                   '3. Verifique tier: platform.openai.com/account/limits\n\n' +
                   '📚 Nota: Video Remix (endpoint diferente) também requer tier superior',
            errorCode: 'permission_denied'
          },
          { status: 403 }
        );
      }
      
      const isModerationError = errorCode === 'moderation_blocked' || 
                                errorMessage.includes('moderation') ||
                                errorMessage.includes('safety') || 
                                errorMessage.includes('rejected') ||
                                errorMessage.includes('policy');

      let userMessage = openaiData.error?.message || 'Erro ao gerar vídeo';
      
      if (isModerationError) {
        userMessage = '❌ Conteúdo Não Permitido\n\nEsta imagem ou texto não pode ser processado.';
      }

      return NextResponse.json(
        { 
          error: userMessage,
          errorCode: errorCode
        },
        { status: 500 }
      );
    }

    // Sora retorna um job ID que precisa ser consultado
    const jobId = openaiData.id;

    // Atualizar banco com jobId
    await supabase
      .from('generated_videos_sora')
      .update({ job_id: jobId })
      .eq('id', generatedVideo.id);

    console.log('✅ Vídeo em processamento. JobID:', jobId);

    return NextResponse.json({
      jobId,
      generationId: generatedVideo.id,
      newCredits,
      newExtraCredits,
    });
  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
