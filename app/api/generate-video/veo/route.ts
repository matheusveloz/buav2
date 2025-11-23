import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ==================== VERSÃO 2.0 - VEO 3.1 (GOOGLE) ====================
// Base URL: https://api.laozhang.ai/v1/chat/completions (OpenAI Compatible)
// Docs: https://docs.laozhang.ai/en/api-capabilities/veo/veo-31-overview
// 
// ⭐ VEO 3.1 FEATURES:
// - Text-to-Video e Image-to-Video
// - OpenAI Compatible API
// - Streaming Response (OBRIGATÓRIO!)
// - Suporta até 2 imagens (start + end frame)
// - Melhor qualidade que Sora 2
// 
// ⚠️ AUTO-SELEÇÃO DE MODELO:
// - Modelos com sufixo -fl são EXCLUSIVOS para Image-to-Video
// - Sistema converte automaticamente baseado na presença de imagem
// - Default: veo-3.1 (Text-to-Video sem imagem)
// - Com imagem: auto-converte para veo-3.1-fl
// 
// ⚠️ IMPORTANTE:
// - Erro 503 é comum (serviço em beta/sobrecarga)
// - Sistema tenta 3x com delay de 5s
// - Se falhar, reembolsa créditos automaticamente
// ==========================================================================

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
const LAOZHANG_VEO_BASE_URL = 'https://api.laozhang.ai/v1/chat/completions';

interface GenerateVideoVeoRequest {
  prompt: string;
  imageBase64?: string;
  model?: string;
}

// Modelos Veo 3.1
const VEO_MODELS: Record<string, { 
  model: string;
  price: number;
  credits: number;
  description: string;
  supportsImage: boolean;
}> = {
  'veo-3.1-landscape': {
    model: 'veo-3.1-landscape',
    price: 0.25,
    credits: 35,
    description: 'Veo 3.1 Landscape - Professional 16:9 format',
    supportsImage: false, // Landscape SEM -fl não suporta imagem!
  },
  'veo-3.1-landscape-fl': {
    model: 'veo-3.1-landscape-fl',
    price: 0.25,
    credits: 35,
    description: 'Veo 3.1 Landscape - Image-to-Video 16:9 format',
    supportsImage: true,
  },
  'veo-3.1': {
    model: 'veo-3.1',
    price: 0.25,
    credits: 35,
    description: 'Veo 3.1 Standard - Text-to-Video',
    
    supportsImage: false,
  },
  'veo-3.1-fl': {
    model: 'veo-3.1-fl',
    price: 0.25,
    credits: 35,
    description: 'Veo 3.1 Standard - Image-to-Video',
    supportsImage: true,
  },
  'veo-3.1-fast': {
    model: 'veo-3.1-fast',
    price: 0.15,
    credits: 21,
    description: 'Veo 3.1 Fast - Text-to-Video',
    supportsImage: false,
  },
  'veo-3.1-fast-fl': {
    model: 'veo-3.1-fast-fl',
    price: 0.15,
    credits: 21,
    description: 'Veo 3.1 Fast - Image-to-Video',
    supportsImage: true,
  },
  'veo-3.1-landscape-fast': {
    model: 'veo-3.1-landscape-fast',
    price: 0.15,
    credits: 21,
    description: 'Veo 3.1 Landscape Fast - Text-to-Video 16:9 format',
    supportsImage: false,
  },
  'veo-3.1-landscape-fast-fl': {
    model: 'veo-3.1-landscape-fast-fl',
    price: 0.15,
    credits: 21,
    description: 'Veo 3.1 Landscape Fast - Image-to-Video 16:9 format',
    supportsImage: true,
  },
};

export async function POST(request: NextRequest) {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;
  let user: { email: string } | null = null;
  let profile: { creditos: number; creditos_extras: number } | null = null;
  let modelConfig: typeof VEO_MODELS[keyof typeof VEO_MODELS] | null = null;
  let generatedVideo: { id: string } | null = null;
  let creditsDeducted = false;
  
  try {
    console.log('🎬 [POST /api/generate-video/veo] Versão 2.0 - Veo 3.1 (Google)');

    // Validar API Key
    if (!LAOZHANG_API_KEY) {
      console.error('❌ LAOZHANG_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Serviço de geração de vídeos não configurado' },
        { status: 500 }
      );
    }

    // Obter usuário autenticado
    supabase = await createSupabaseServerClient();
    const userResponse = await supabase.auth.getUser();
    const tempUser = userResponse.data.user;
    const userError = userResponse.error;

    if (userError || !tempUser?.email) {
      console.error('❌ Usuário não autenticado:', userError?.message);
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    
    user = { email: tempUser.email };

    // Parse do body
    const body: GenerateVideoVeoRequest = await request.json();
    const { prompt, imageBase64 } = body;
    let model = body.model || 'veo-3.1'; // ⚡ Default para veo-3.1 (Text-to-Video)

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

    // 🛡️ MODERAR PROMPT (conteúdo explícito/impróprio)
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

    console.log('📋 Dados da requisição Veo (antes da conversão):', {
      userEmail: user.email,
      promptLength: prompt.length,
      model,
      hasImageBase64: !!imageBase64,
    });

    // ⭐ AUTO-SELEÇÃO DE MODELO: Converter baseado na presença de imagem
    if (imageBase64 && !model.includes('-fl')) {
      // Se tem imagem mas modelo não suporta, converter para -fl
      const flMapping: Record<string, string> = {
        'veo-3.1': 'veo-3.1-fl',
        'veo-3.1-fast': 'veo-3.1-fast-fl',
        'veo-3.1-landscape': 'veo-3.1-landscape-fl',
        'veo-3.1-landscape-fast': 'veo-3.1-landscape-fast-fl',
      };
      
      if (flMapping[model]) {
        const oldModel = model;
        model = flMapping[model];
        console.log(`🔄 Imagem detectada: convertido de ${oldModel} para ${model}`);
      }
    } else if (!imageBase64 && model.includes('-fl')) {
      // Se NÃO tem imagem mas modelo requer, converter para versão sem -fl
      const oldModel = model;
      model = model.replace('-fl', '');
      console.log(`🔄 Sem imagem detectada: convertido de ${oldModel} para ${model}`);
    }

    console.log('📋 Dados da requisição Veo (após conversão):', {
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
    modelConfig = VEO_MODELS[model];
    if (!modelConfig) {
      return NextResponse.json(
        { error: 'Modelo não suportado' },
        { status: 400 }
      );
    }

    console.log('💰 Configuração do modelo:', {
      model: modelConfig.model,
      price: `$${modelConfig.price}`,
      credits: modelConfig.credits,
      description: modelConfig.description,
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
    const profileResponse = await supabase
      .from('emails')
      .select('creditos, creditos_extras, plano')
      .eq('email', user.email)
      .single();
    
    profile = profileResponse.data;
    const profileError = profileResponse.error;

    if (profileError || !profile) {
      console.error('❌ Erro ao buscar perfil:', profileError?.message);
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });
    }

    console.log('👤 Perfil do usuário:', {
      email: user.email,
      credits: profile.creditos,
      extraCredits: profile.creditos_extras,
      totalCredits: profile.creditos + profile.creditos_extras,
      plan: (profile as any).plano,
    });

    // ⚡ LIMITE DIÁRIO PARA PLANO FREE
    if ((profile as any).plano?.toLowerCase() === 'free') {
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

    const totalCredits = profile.creditos + profile.creditos_extras;
    if (totalCredits < modelConfig.credits) {
      return NextResponse.json(
        { error: `Créditos insuficientes. Necessário: ${modelConfig.credits}, Disponível: ${totalCredits}` },
        { status: 402 }
      );
    }

    // Deduzir créditos ANTES de chamar a API
    let newCredits = profile.creditos;
    let newExtraCredits = profile.creditos_extras;
    
    if (profile.creditos_extras >= modelConfig.credits) {
      newExtraCredits -= modelConfig.credits;
    } else {
      const remaining = modelConfig.credits - profile.creditos_extras;
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

    creditsDeducted = true; // ⚡ Marcar que créditos foram deduzidos
    console.log('✅ Créditos deduzidos:', { creditsUsed: modelConfig.credits, newCredits, newExtraCredits });

    // Criar registro no banco
    // Determinar tamanho baseado no modelo
    let videoSize = '1280x720'; // Padrão landscape (16:9)
    if (model === 'veo-3.1-fl' || model === 'veo-3.1-fast-fl' || model === 'veo-3.1' || model === 'veo-3.1-fast') {
      videoSize = '720x1280'; // Retrato (9:16)
    }
    
    console.log('💾 Salvando no banco:', {
      model,
      videoSize,
      hasReference: !!imageBase64,
    });
    
    const videoInsert = await supabase
      .from('generated_videos_sora')
      .insert({
        user_email: user.email,
        prompt: prompt.trim(),
        status: 'processing',
        model: model, // ⚡ Usar modelo direto (já tem prefixo veo-)
        seconds: 8, // Veo 3.1 máximo 8s
        size: videoSize,
        has_reference: !!imageBase64,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    generatedVideo = videoInsert.data;
    const insertError = videoInsert.error;

    if (insertError || !generatedVideo) {
      console.error('❌ Erro ao salvar no banco:', insertError?.message);
      
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

    // ⚡ A partir daqui, generatedVideo é garantido como não-null
    const videoId = generatedVideo.id;
    console.log('✅ Registro criado no banco:', { id: videoId, status: 'processing' });

    // ==================== PREPARAR REQUISIÇÃO VEO ====================
    console.log('🚀 Chamando Veo 3.1 API...');

    // Preparar content array
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: prompt.trim(),
      }
    ];

    // Se tiver imagem, adicionar ao content
    if (imageBase64) {
      console.log('🖼️ Adicionando imagem de referência');
      
      // Validar tamanho do Base64 (máximo ~8MB após encoding)
      const maxBase64Size = 8 * 1024 * 1024; // 8MB
      if (imageBase64.length > maxBase64Size) {
        console.error('❌ Imagem muito grande:', {
          receivedSize: `${(imageBase64.length / 1024 / 1024).toFixed(2)} MB`,
          maxSize: '8 MB',
        });
        
        // Reembolsar créditos antes de retornar erro
        await supabase
          .from('emails')
          .update({
            creditos: profile.creditos,
            creditos_extras: profile.creditos_extras,
          })
          .eq('email', user.email);
        
        // Marcar vídeo como failed
        await supabase
          .from('generated_videos_sora')
          .update({ status: 'failed' })
          .eq('id', videoId);
        
        console.log('💰 Créditos reembolsados (imagem muito grande)');
        
        return NextResponse.json(
          { error: 'Imagem muito grande. Máximo: 8MB (após encoding). Por favor, use uma imagem menor ou comprima-a.' },
          { status: 400 }
        );
      }
      
      // Garantir formato data:image/...;base64,
      let base64WithPrefix = imageBase64;
      
      // Se não tem prefixo, adicionar
      if (!imageBase64.startsWith('data:')) {
        base64WithPrefix = `data:image/jpeg;base64,${imageBase64}`;
      }
      
      // Validar formato
      if (!base64WithPrefix.match(/^data:image\/(jpeg|jpg|png|webp);base64,/)) {
        console.error('❌ Formato de imagem inválido:', base64WithPrefix.substring(0, 50));
        
        // Reembolsar créditos antes de retornar erro
        await supabase
          .from('emails')
          .update({
            creditos: profile.creditos,
            creditos_extras: profile.creditos_extras,
          })
          .eq('email', user.email);
        
        // Marcar vídeo como failed
        await supabase
          .from('generated_videos_sora')
          .update({ status: 'failed' })
          .eq('id', videoId);
        
        console.log('💰 Créditos reembolsados (formato inválido)');
        
        return NextResponse.json(
          { error: 'Formato de imagem inválido. Use JPEG, PNG ou WebP.' },
          { status: 400 }
        );
      }
      
      // ⭐ LOGS para debug
      console.log('📊 Informações da imagem:', {
        format: base64WithPrefix.substring(0, 30),
        totalLength: base64WithPrefix.length,
        base64DataLength: base64WithPrefix.split(',')[1]?.length || 0,
        estimatedSizeMB: (base64WithPrefix.length / 1024 / 1024).toFixed(2),
        estimatedOriginalSizeKB: ((base64WithPrefix.split(',')[1]?.length || 0) * 0.75 / 1024).toFixed(2),
      });
      
      content.push({
        type: 'image_url',
        image_url: {
          url: base64WithPrefix,
        },
      });
    }

    // Chamar Veo 3.1 API com STREAMING (1 tentativa apenas - falha rápido se 503)
    let retryCount = 0;
    const maxRetries = 1; // ⚡ Apenas 1 tentativa (falha rápido ao invés de ficar tentando)
    let retryDelay = 5000;
    let videoUrl: string | null = null;

    console.log('⚠️  ATENÇÃO: Veo 3.1 está em BETA e pode estar instável (erro 503 comum)');
    console.log('🔄 Sistema falhará rápido se serviço estiver offline');

    while (retryCount < maxRetries && !videoUrl) {
      try {
        console.log(`🚀 Tentativa ${retryCount + 1}/${maxRetries} - Chamando Veo 3.1 API (STREAMING)...`);
        
        const requestBody = {
          model: modelConfig.model,
          messages: [
            {
              role: 'user',
              content: content,
            }
          ],
          stream: true,
          n: 1,
        };
        
        console.log('📦 Request Body:', JSON.stringify(requestBody, null, 2));
        
        const veoResponse = await fetch(LAOZHANG_VEO_BASE_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LAOZHANG_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log(`📡 Status da Veo API (tentativa ${retryCount + 1}):`, veoResponse.status);
        
        // Log headers para debug
        console.log('📡 Response Headers:', Object.fromEntries(veoResponse.headers.entries()));

        if (!veoResponse.ok) {
          // Ler resposta de erro ANTES de decidir retry
          const errorText = await veoResponse.text();
          console.error('❌ Resposta de erro completa:', errorText);
          
          if (veoResponse.status === 503 && retryCount < maxRetries - 1) {
            console.log(`⏳ Veo API retornou 503. Aguardando ${retryDelay}ms antes de retry... (EXPONENTIAL BACKOFF)`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // ⭐ Exponential backoff (5s → 10s → 20s)
            retryCount++;
            continue;
          }
          
          console.error('❌ Erro da Veo API:', veoResponse.status, errorText);
          throw new Error(`Veo API error: ${veoResponse.status}`);
        }

        // Processar STREAMING response (conforme documentação)
        const reader = veoResponse.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        if (!reader) {
          throw new Error('No response body reader');
        }

        console.log('📥 Processando streaming response...');

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('✅ Streaming concluído');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                console.log('🏁 Recebido [DONE]');
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const deltaContent = parsed.choices?.[0]?.delta?.content || '';
                
                if (deltaContent) {
                  fullContent += deltaContent;
                  console.log('📦 Chunk recebido:', deltaContent.substring(0, 100));
                }
              } catch {
                // Ignorar erros de parse de chunks incompletos
              }
            }
          }
        }

        console.log('📄 Conteúdo completo recebido:', fullContent);

        // Extrair URL do vídeo (formato markdown: ![video](URL) ou texto plano)
        const urlMatch = fullContent.match(/https:\/\/[^\s\)]+/);
        videoUrl = urlMatch ? urlMatch[0] : null;

        if (!videoUrl) {
          console.error('❌ URL do vídeo não encontrada no conteúdo:', fullContent);
          
          if (retryCount < maxRetries - 1) {
            console.log(`⏳ Tentando novamente em ${retryDelay}ms... (EXPONENTIAL BACKOFF)`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryDelay *= 2; // ⭐ Exponential backoff
            retryCount++;
            continue;
          }
          
          throw new Error('URL do vídeo não encontrada na resposta');
        }

        console.log('✅ URL do vídeo extraída:', videoUrl);
        break; // Sucesso!

      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        console.error(`❌ Erro na tentativa ${retryCount + 1}:`, errorMessage);
        
        if (retryCount < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          retryDelay *= 2; // ⭐ Exponential backoff
          retryCount++;
        } else {
          throw fetchError;
        }
      }
    }

    // Se falhou após todas as tentativas
    if (!videoUrl) {
      const userMessage = 'Serviço Veo 3.1 temporariamente indisponível. Tente novamente em alguns minutos ou use a versão 1.0.';
      
      // Reembolsar créditos
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', user.email);
      
      await supabase
        .from('generated_videos_sora')
        .update({ status: 'failed' })
        .eq('id', videoId);
      
      console.log('💰 Créditos reembolsados:', { creditos: profile.creditos, creditos_extras: profile.creditos_extras });
      
      return NextResponse.json(
        { error: userMessage },
        { status: 503 }
      );
    }

    // ==================== DOWNLOAD E UPLOAD PARA SUPABASE ====================
    console.log('⬇️ Baixando vídeo da Veo...');
    
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Erro ao baixar vídeo: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.blob();
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
    
    console.log(`📦 Vídeo baixado (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Upload para Supabase Storage
    console.log('📤 Fazendo upload para Supabase Storage...');
    const timestamp = Date.now();
    const fileName = `${user.email.split('@')[0]}_${timestamp}_${videoId}_veo.mp4`;
    const filePath = `videos/${fileName}`;

    const { error: uploadError } = await supabase
      .storage
      .from('generated-videos')
      .upload(filePath, videoBuffer, {
        contentType: 'video/mp4',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      // Salvar URL original da Veo como fallback
      await supabase
        .from('generated_videos_sora')
        .update({
          status: 'completed',
          video_url: videoUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('id', videoId);

      return NextResponse.json({
        success: true,
        videoUrl: videoUrl,
        generationId: videoId,
        newCredits,
        newExtraCredits,
        model: modelConfig.model,
        warning: 'Vídeo salvo com URL temporária',
      });
    }

    // Obter URL pública do Supabase
    const { data: publicUrlData } = supabase
      .storage
      .from('generated-videos')
      .getPublicUrl(filePath);

    const finalVideoUrl = publicUrlData.publicUrl;

    // Atualizar banco com status completo
    await supabase
      .from('generated_videos_sora')
      .update({
        status: 'completed',
        video_url: finalVideoUrl,
        completed_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    console.log('✅ Vídeo salvo no Supabase Storage:', finalVideoUrl);

    return NextResponse.json({
      success: true,
      videoUrl: finalVideoUrl,
      generationId: videoId,
      newCredits,
      newExtraCredits,
      model: modelConfig.model,
      price: modelConfig.price,
      credits: modelConfig.credits,
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // 🔍 DEBUG: Verificar estado das variáveis
    console.log('🔍 DEBUG - Estado das variáveis:', {
      creditsDeducted,
      hasSupabase: !!supabase,
      hasUser: !!user,
      hasProfile: !!profile,
      hasModelConfig: !!modelConfig,
      hasGeneratedVideo: !!generatedVideo,
    });
    
    // ⚡ REEMBOLSAR CRÉDITOS SE FORAM DEDUZIDOS
    if (creditsDeducted && supabase && user && profile && modelConfig && generatedVideo) {
      try {
        console.log('💰 Reembolsando créditos devido a erro...');
        
        // Reembolsar créditos
        await supabase
          .from('emails')
          .update({
            creditos: profile.creditos,
            creditos_extras: profile.creditos_extras,
          })
          .eq('email', user.email);
        
        // Marcar vídeo como failed
        await supabase
          .from('generated_videos_sora')
          .update({ 
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', generatedVideo.id);
        
        console.log(`✅ Créditos reembolsados: ${modelConfig.credits}`);
        console.log('❌ Vídeo marcado como "failed"');
      } catch (refundError) {
        console.error('⚠️ Erro ao reembolsar créditos:', refundError);
      }
    } else {
      console.error('⚠️ NÃO foi possível reembolsar: alguma variável está null/undefined');
    }
    
    return NextResponse.json(
      { error: 'Erro ao gerar vídeo. Serviço temporariamente indisponível. Seus créditos foram reembolsados.', details: errorMessage },
      { status: 500 }
    );
  }
}

