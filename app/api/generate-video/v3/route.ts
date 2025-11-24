import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimiter } from '@/lib/rate-limiter';
import { replaceSupabaseDomain } from '@/lib/custom-domain';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ==================== VERSÃO 3.0 - LAOZHANG API ====================
// Base URL: https://api.laozhang.ai/v1/chat/completions
// Docs: https://docs.laozhang.ai/en/api-capabilities/sora2/overview
// ====================================================================

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
const LAOZHANG_BASE_URL = 'https://api.laozhang.ai/v1/chat/completions';

interface GenerateVideoV3Request {
  prompt: string;
  imageUrl?: string;      // URL da imagem (novo!)
  imageBase64?: string;   // Base64 da imagem
  model?: string;         // sora_video2, sora_video2-landscape, sora_video2-15s, sora_video2-landscape-15s
}

// Mapear modelos para configurações
const MODEL_CONFIG: Record<string, { size: string; seconds: number; orientation: 'vertical' | 'horizontal'; credits: number }> = {
  'sora_video2': { size: '704x1280', seconds: 10, orientation: 'vertical', credits: 21 },
  'sora_video2-landscape': { size: '1280x704', seconds: 10, orientation: 'horizontal', credits: 21 },
  'sora_video2-15s': { size: '704x1280', seconds: 15, orientation: 'vertical', credits: 21 },
  'sora_video2-landscape-15s': { size: '1280x704', seconds: 15, orientation: 'horizontal', credits: 21 },
  'sora-2-pro-all': { size: '1024x1792', seconds: 15, orientation: 'vertical', credits: 56 }, // $0.40 (doc oficial) - API pode cobrar menos mas doc diz $0.40
};

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 [POST /api/generate-video/v3] Versão 3.0 - LaoZhang API');

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
    const body: GenerateVideoV3Request = await request.json();
    const { prompt, imageUrl, imageBase64, model = 'sora_video2' } = body;

    // 🔍 VERIFICAR CELEBRIDADES/CRIANÇAS NA IMAGEM USANDO GPT-4o (se houver imagem)
    if (imageBase64 || imageUrl) {
      try {
        console.log('🔍 Analisando imagem com GPT-4o Vision...');
        const { detectCelebrityWithGPT, shouldBlockGeneration, getBlockMessage } = await import('@/lib/celebrity-detection-gpt');
        
        // Usar imageBase64 se disponível, senão usar imageUrl
        const imageToCheck = imageBase64 || imageUrl || '';
        const detectionResult = await detectCelebrityWithGPT(imageToCheck);
        
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

    console.log('📋 Dados da requisição V3:', {
      userEmail: user.email,
      promptLength: prompt.length,
      model,
      hasImageUrl: !!imageUrl,
      hasImageBase64: !!imageBase64,
    });

    // Validações
    if (!prompt || prompt.length > 1000) {
      return NextResponse.json(
        { error: 'Prompt deve ter entre 1 e 1000 caracteres' },
        { status: 400 }
      );
    }

    // Validar modelo
    if (!MODEL_CONFIG[model]) {
      return NextResponse.json(
        { error: `Modelo inválido. Use: ${Object.keys(MODEL_CONFIG).join(', ')}` },
        { status: 400 }
      );
    }

    const config = MODEL_CONFIG[model];
    const creditsNeeded = config.credits; // Usar créditos da config

    console.log('💰 Cálculo de créditos V3:', {
      model,
      size: config.size,
      seconds: config.seconds,
      orientation: config.orientation,
      creditsNeeded,
      priceUSD: model === 'sora-2-pro-all' ? '$0.40' : '$0.15',
    });

    // ⚡ RATE LIMITING
    const limitCheck = await rateLimiter.checkLimit(model);
    
    if (!limitCheck.allowed) {
      const waitSeconds = Math.ceil(limitCheck.resetIn / 1000);
      console.warn(`⏸️ Rate limit atingido para ${model} (aguarde ${waitSeconds}s)`);
      
      return NextResponse.json({
        error: '⏳ Sistema em Alta Demanda\n\n' +
               `O limite de requisições foi atingido para o modelo ${model}.\n\n` +
               `⏰ Aguarde ${waitSeconds} segundos e tente novamente.`,
        rateLimitInfo: {
          model,
          resetIn: limitCheck.resetIn,
          waitSeconds,
        }
      }, { status: 429 });
    }

    rateLimiter.recordRequest(model);
    console.log(`✅ Rate limit OK para ${model} (${limitCheck.remaining} remaining)`);

    // Verificar créditos do usuário
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

    // ==================== PREPARAR REQUISIÇÃO LAOZHANG ====================
    
    // ⭐ Usar prompt ORIGINAL (usuário melhora manualmente se quiser)
    const finalPrompt = prompt.trim();
    
    console.log('📝 Prompt a ser usado:', finalPrompt);

    // Preparar mensagem no formato LaoZhang
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: finalPrompt,
      }
    ];

    // Se tiver imagem, adicionar ao content
    if (imageUrl) {
      console.log('🖼️ Adicionando imagem via URL:', imageUrl);
      content.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      });
    } else if (imageBase64) {
      console.log('🖼️ Adicionando imagem via Base64 (tamanho:', imageBase64.length, 'chars)');
      
      // Garantir formato data:image/jpeg;base64,
      const base64WithPrefix = imageBase64.startsWith('data:') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64.split(',').pop()}`;
      
      content.push({
        type: 'image_url',
        image_url: {
          url: base64WithPrefix,
        },
      });
    }

    // Criar registro no banco ANTES de chamar a API
    const { data: generatedVideo, error: insertError } = await supabase
      .from('generated_videos_sora')
      .insert({
        user_email: user.email,
        prompt: prompt.trim(),
        status: 'processing',
        model: model, // Armazena o modelo LaoZhang
        seconds: config.seconds,
        size: config.size,
        has_reference: !!(imageUrl || imageBase64),
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

    // ==================== CHAMAR LAOZHANG API ====================
    console.log('🚀 ============ CHAMANDO LAOZHANG API ============');
    console.log('🌐 URL:', LAOZHANG_BASE_URL);
    console.log('🔑 API Key:', LAOZHANG_API_KEY.substring(0, 15) + '...');
    console.log('📝 Model:', model);
    console.log('📝 Size:', config.size);
    console.log('📝 Seconds:', config.seconds);
    console.log('📝 Content items:', content.length);

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: content,
        }
      ],
      size: config.size,       // ⚡ ADICIONADO: Tamanho do vídeo (ex: 1024x1792)
      seconds: config.seconds, // ⚡ ADICIONADO: Duração do vídeo (ex: 15)
      stream: false, // Não usar streaming por enquanto (vamos implementar depois)
    };

    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));

    const laozhangResponse = await fetch(LAOZHANG_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LAOZHANG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📡 Status HTTP:', laozhangResponse.status);
    console.log('📡 Headers:', Object.fromEntries(laozhangResponse.headers.entries()));

    const responseText = await laozhangResponse.text();
    console.log('📥 Resposta (primeiros 500 chars):', responseText.substring(0, 500));

    let laozhangData;
    try {
      laozhangData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse da resposta:', parseError);
      console.error('📄 Resposta completa:', responseText);
      
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
        { error: 'Erro na resposta da API' },
        { status: 500 }
      );
    }

    console.log('📥 Resposta COMPLETA da LaoZhang:', JSON.stringify(laozhangData, null, 2));

    // Verificar se deu erro
    if (!laozhangResponse.ok) {
      console.error('❌ ============ ERRO NA LAOZHANG API ============');
      console.error('📊 Status:', laozhangResponse.status);
      console.error('📄 Dados:', JSON.stringify(laozhangData, null, 2));
      
      // Marcar como falhou
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

      // Mensagem de erro mais amigável
      let errorMessage = laozhangData.error?.message || 'Erro ao gerar vídeo';
      
      // Detectar tipo de erro
      const errorType = laozhangData.error?.type || '';
      
      if (errorType === 'upstream_error') {
        errorMessage = '⚠️ Serviço temporariamente indisponível. Seus créditos foram reembolsados. Tente novamente em alguns minutos ou use o modo Standard (sem HIGH).';
      } else if (errorMessage.includes('safety') || errorMessage.includes('policy')) {
        errorMessage = '🛡️ Conteúdo não permitido pelas políticas de segurança. Tente reformular o prompt evitando descrições muito realistas de pessoas. Créditos reembolsados.';
      } else if (!errorMessage || errorMessage === '') {
        errorMessage = 'Erro desconhecido na API. Créditos reembolsados. Tente novamente.';
      }
      
      console.log('📤 Retornando erro ao frontend:', errorMessage);
      
      return NextResponse.json(
        { error: errorMessage },
        { status: laozhangResponse.status }
      );
    }

    // Extrair URL do vídeo da resposta
    // Formato esperado: choices[0].message.content contém o link do vídeo
    const videoContent = laozhangData.choices?.[0]?.message?.content || '';
    
    console.log('📹 Conteúdo da resposta:', videoContent);

    // ==================== DETECTAR ERROS DA API LAOZHANG ====================
    // A API retorna erros em chinês no campo "content"
    const chineseErrors: Record<string, string> = {
      '当前不支持上传包含写实人物的图像': 'Imagem com pessoas reais não é suportada. Use ilustrações, desenhos ou imagens sem pessoas.',
      '任务发生错误': 'Erro na geração do vídeo',
      '图像不符合要求': 'Imagem não atende aos requisitos',
      '内容违规': 'Conteúdo violou as políticas de uso',
    };

    // Verificar se há erro em chinês na resposta
    let errorMessage = null;
    for (const [chineseText, portugueseText] of Object.entries(chineseErrors)) {
      if (videoContent.includes(chineseText)) {
        errorMessage = portugueseText;
        break;
      }
    }

    if (errorMessage || videoContent.includes('❌')) {
      console.error('❌ Erro detectado na resposta da LaoZhang');
      console.error('📄 Content:', videoContent);
      console.error('🇧🇷 Tradução:', errorMessage || 'Erro desconhecido');
      
      // Marcar como falhou
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

      return NextResponse.json(
        { error: errorMessage || 'Erro ao gerar vídeo. Verifique a imagem e tente novamente.' },
        { status: 400 }
      );
    }
    // ========================================================================

    // Extrair URL do vídeo (formato: https://...mp4)
    const urlMatch = videoContent.match(/https:\/\/[^\s\)]+\.mp4/);
    const videoUrl = urlMatch ? urlMatch[0] : null;

    if (!videoUrl) {
      console.error('❌ URL do vídeo não encontrada na resposta');
      console.error('📄 Content:', videoContent);
      
      // Marcar como falhou
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

      return NextResponse.json(
        { error: 'URL do vídeo não encontrada na resposta' },
        { status: 500 }
      );
    }

    console.log('✅ URL do vídeo extraída:', videoUrl);

    // ==================== FAZER UPLOAD PARA SUPABASE STORAGE ====================
    console.log('📤 Iniciando download e upload para Supabase Storage...');
    
    try {
      // 1. Fazer download do vídeo da LaoZhang
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Erro ao fazer download do vídeo');
      }

      const videoBlob = await videoResponse.blob();
      const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
      
      // 2. Gerar nome único para o arquivo
      const timestamp = Date.now();
      const fileName = `${user.email.split('@')[0]}_${timestamp}_${generatedVideo.id}.mp4`;
      const filePath = `videos/${fileName}`;

      console.log('📤 Fazendo upload:', filePath, 'Tamanho:', videoBuffer.length, 'bytes');

      // 3. Fazer upload para Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('generated-videos')
        .upload(filePath, videoBuffer, {
          contentType: 'video/mp4',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Erro ao fazer upload:', uploadError.message);
        throw uploadError;
      }

      console.log('✅ Upload concluído:', uploadData.path);

      // 4. Obter URL pública do vídeo com domínio customizado
      const { data: publicUrlData } = supabase
        .storage
        .from('generated-videos')
        .getPublicUrl(filePath);

      const finalVideoUrl = replaceSupabaseDomain(publicUrlData.publicUrl);
      console.log('✅ URL pública gerada:', finalVideoUrl);

      // 5. Atualizar banco com vídeo no nosso storage
      await supabase
        .from('generated_videos_sora')
        .update({ 
          status: 'completed',
          video_url: finalVideoUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('id', generatedVideo.id);

      console.log('✅ Vídeo salvo no nosso storage! ID:', generatedVideo.id);

      return NextResponse.json({
        success: true,
        videoUrl: finalVideoUrl,
        generationId: generatedVideo.id,
        newCredits,
        newExtraCredits,
        model,
        size: config.size,
        seconds: config.seconds,
        orientation: config.orientation,
      });

    } catch (uploadError) {
      console.error('❌ Erro no upload para storage:', uploadError);
      
      // Se falhar o upload, salvar a URL da LaoZhang mesmo assim
      await supabase
        .from('generated_videos_sora')
        .update({ 
          status: 'completed',
          video_url: videoUrl, // URL da LaoZhang como fallback
          completed_at: new Date().toISOString(),
        })
        .eq('id', generatedVideo.id);

      console.log('⚠️ Usando URL da LaoZhang como fallback');

      return NextResponse.json({
        success: true,
        videoUrl: videoUrl,
        generationId: generatedVideo.id,
        newCredits,
        newExtraCredits,
        model,
        size: config.size,
        seconds: config.seconds,
        orientation: config.orientation,
      });
    }
    // ============================================================================

  } catch (error) {
    console.error('❌ Erro geral V3:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

