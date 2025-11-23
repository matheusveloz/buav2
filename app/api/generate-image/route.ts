import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { rateLimiter } from '@/lib/rate-limiter';
import {
  buildText2ImageRequest,
  buildImageEditRequest,
  extractBase64Image,
  generateTaskId,
  isValidNanoBananaResponse,
} from '@/lib/nano-banana-helper';
import { uploadBase64ToStorage } from '@/lib/upload-base64-to-storage';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
// ⚠️ CRÍTICO: maxDuration DEVE ser maior que todos os timeouts de fetch!
// Vercel Pro suporta até 300s (5 minutos)
// Com timeout de fetch = 240s (4min), deixamos margem de 60s
export const maxDuration = 300; // ✅ 5 minutos (Vercel Pro)

// Configuração de limite de body para o App Router
export const runtime = 'nodejs';
// Next.js App Router não tem bodyParser configurável como Pages Router
// O limite é controlado pela plataforma de deploy (Vercel = 4.5MB)
// Solução: reduzir tamanho das imagens no frontend

const NEWPORT_API_KEY = process.env.NEXT_PUBLIC_NEWPORT_API_KEY;
const NEWPORT_BASE_URL = 'https://api.newportai.com/api/async';

// Nano Banana (Gemini) API Configuration
const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;

// Custo em créditos por tipo de geração
const CREDITS_PER_IMAGE = 2;

type GenerationType = 'text2image' | 'image2image';

interface GenerateImageRequest {
  prompt: string;
  width?: number;
  height?: number;
  num?: number;
  seed?: number;
  referenceImageUrl?: string; // Para image2image (v1-fast)
  referenceImages?: string[]; // Para image2image (v2-quality e v3-high-quality - Nano Banana)
  generationType: GenerationType;
  model?: string; // 'v1-fast', 'v2-quality', ou 'v3-high-quality'
  aspectRatio?: string; // Para v3-high-quality (Gemini Native Format): '16:9', '1:1', etc.
  resolution?: '1K' | '2K' | '4K'; // Para v3-high-quality
  useGoogleSearch?: boolean; // Para v3-high-quality (Google Search Grounding)
}

// Função auxiliar para geração v2 assíncrona (Nano Banana)
async function generateV2ImageAsync(
  prompt: string,
  referenceImages: string[],
  userEmail: string,
  taskId: string,
  num: number,
  supabaseClient: SupabaseClient
) {
  const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
  const LAOZHANG_BASE_URL = 'https://api.laozhang.ai/v1/chat/completions';

  try {
    console.log(`🔄 [ASYNC V2] ===== INÍCIO DA FUNÇÃO =====`);
    console.log(`🔄 [ASYNC V2] TaskId: ${taskId}`);
    console.log(`🔄 [ASYNC V2] Num imagens: ${num}`);
    console.log(`🔄 [ASYNC V2] User: ${userEmail}`);
    console.log(`🔄 [ASYNC V2] API Key configurada: ${!!LAOZHANG_API_KEY}`);
    console.log(`🔄 [ASYNC V2] Supabase client: ${!!supabaseClient}`);

    // Verificar se é image edit ou text2image
    const hasReferenceImages = referenceImages && referenceImages.length > 0;
    const isImageEdit = hasReferenceImages;

    let nanoRequestBody: ReturnType<typeof buildText2ImageRequest> | ReturnType<typeof buildImageEditRequest>;
    
    if (isImageEdit) {
      console.log(`🎨 [ASYNC V2] Image Edit com ${referenceImages.length} imagens de referência`);
      nanoRequestBody = buildImageEditRequest(prompt, referenceImages);
    } else {
      console.log(`🎨 [ASYNC V2] Text-to-Image`);
      nanoRequestBody = buildText2ImageRequest(prompt);
    }
    
    console.log(`📦 [ASYNC V2] Request body preparado, modelo: ${nanoRequestBody.model}`);

    // Gerar múltiplas imagens em paralelo
    const generationPromises = Array.from({ length: num }, async (_, i) => {
      const imageStartTime = Date.now();
      console.log(`🔄 [ASYNC V2] ===== INICIANDO IMAGEM ${i + 1}/${num} =====`);
      
      try {
        console.log(`📤 [ASYNC V2] Enviando fetch para imagem ${i + 1}...`);
        
        // ✅ TIMEOUT: 240s (4 minutos)
        // maxDuration = 300s, então 240s deixa margem de 60s
        // Com retry (2 tentativas), pode usar até 4min + 4min = 8min teórico
        // Mas maxDuration limita em 5min total
        const timeoutMs = 240000; // 240 segundos = 4 minutos
        
        const nanoResponse = await fetch(LAOZHANG_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LAOZHANG_API_KEY}`,
          },
          body: JSON.stringify(nanoRequestBody),
          signal: AbortSignal.timeout(timeoutMs), // ✅ CRÍTICO: Timeout!
        });
        
        const fetchElapsed = Math.round((Date.now() - imageStartTime) / 1000);
        console.log(`📥 [ASYNC V2] Resposta recebida em ${fetchElapsed}s (imagem ${i + 1}), status: ${nanoResponse.status}`);

        if (!nanoResponse.ok) {
          const errorText = await nanoResponse.text();
          console.error(`❌ [ASYNC V2] Erro HTTP ${nanoResponse.status} (imagem ${i + 1}):`, errorText.substring(0, 300));
          return null;
        }

        const nanoResult = await nanoResponse.json();
        console.log(`📋 [ASYNC V2] JSON parseado (imagem ${i + 1})`);

        // Validar resposta
        if (!isValidNanoBananaResponse(nanoResult)) {
          console.error(`❌ [ASYNC V2] Resposta inválida (imagem ${i + 1})`);
          console.error(`❌ [ASYNC V2] Resposta:`, JSON.stringify(nanoResult).substring(0, 200));
          return null;
        }

        // Extrair base64 da resposta
        const content = nanoResult.choices[0].message.content;
        console.log(`🔍 [ASYNC V2] Extraindo base64 da resposta (imagem ${i + 1})...`);
        const extractedImage = extractBase64Image(content);

        if (!extractedImage) {
          console.error(`❌ [ASYNC V2] Erro ao extrair imagem base64 (imagem ${i + 1})`);
          console.error(`❌ [ASYNC V2] Content preview:`, content.substring(0, 200));
          return null;
        }
        
        console.log(`✅ [ASYNC V2] Base64 extraído (imagem ${i + 1}), formato: ${extractedImage.format}`);

        // Upload para Storage
        try {
          console.log(`📤 [ASYNC V2] Fazendo upload para Storage (imagem ${i + 1})...`);
          const adminClient = createSupabaseAdminClient();
          const uploadedImage = await uploadBase64ToStorage(
            adminClient,
            extractedImage.dataUrl,
            userEmail,
            taskId,
            i
          );
          
          console.log(`✅ [ASYNC V2] Imagem ${i + 1}/${num} salva no Storage`);
          return uploadedImage;
        } catch (uploadError) {
          console.error(`❌ [ASYNC V2] Erro ao fazer upload (imagem ${i + 1}):`, uploadError);
          // Fallback para base64
          return {
            imageUrl: extractedImage.dataUrl,
            imageType: extractedImage.format,
          };
        }
      } catch (error) {
        console.error(`❌ [ASYNC V2] Erro ao gerar imagem ${i + 1}:`, error);
        return null;
      }
    });

    // Aguardar todas as gerações
    console.log(`⏳ [ASYNC V2] Aguardando Promise.all de ${num} imagens...`);
    const results = await Promise.all(generationPromises);
    console.log(`📊 [ASYNC V2] Promise.all concluído, processando resultados...`);
    
    const successfulImages = results.filter((img): img is { imageUrl: string; imageType: string } => img !== null);
    console.log(`📊 [ASYNC V2] Resultados: ${successfulImages.length} sucessos, ${results.length - successfulImages.length} falhas`);

    if (successfulImages.length === 0) {
      console.error(`❌ [ASYNC V2] NENHUMA imagem gerada com sucesso, marcando como failed...`);
      const { error: updateError } = await supabaseClient
        .from('generated_images')
        .update({ status: 'failed' })
        .eq('task_id', taskId);
      
      if (updateError) {
        console.error(`❌ [ASYNC V2] Erro ao atualizar para failed:`, updateError);
      } else {
        console.log(`✅ [ASYNC V2] TaskId ${taskId} marcado como failed`);
      }
      return;
    }

    console.log(`✅ [ASYNC V2] ${successfulImages.length}/${num} imagens geradas com sucesso`);
    console.log(`📤 [ASYNC V2] Atualizando banco com status 'completed'...`);

    // Atualizar banco com imagens prontas
    const { error: updateError } = await supabaseClient
      .from('generated_images')
      .update({
        status: 'completed',
        image_urls: successfulImages,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), // ✅ Adicionar updated_at
      })
      .eq('task_id', taskId);
    
    if (updateError) {
      console.error(`❌ [ASYNC V2] Erro ao atualizar para completed:`, updateError);
    } else {
      console.log(`✅ [ASYNC V2] TaskId ${taskId} atualizado para completed com ${successfulImages.length} imagens`);
    }

    console.log(`✅ [ASYNC V2] ===== FIM DA FUNÇÃO (SUCESSO) =====`);
  } catch (error) {
    console.error(`❌ [ASYNC V2] ===== ERRO CRÍTICO =====`);
    console.error(`❌ [ASYNC V2] Error:`, error);
    console.error(`❌ [ASYNC V2] Stack:`, error instanceof Error ? error.stack : 'No stack');
    console.error(`❌ [ASYNC V2] TaskId:`, taskId);
    
    // Marcar como failed
    try {
      console.log(`🔄 [ASYNC V2] Tentando marcar como failed...`);
      const { error: updateError } = await supabaseClient
        .from('generated_images')
        .update({ status: 'failed' })
        .eq('task_id', taskId);
      
      if (updateError) {
        console.error(`❌ [ASYNC V2] Erro ao atualizar status para failed:`, updateError);
      } else {
        console.log(`✅ [ASYNC V2] TaskId ${taskId} marcado como failed no catch`);
      }
    } catch (updateError) {
      console.error(`❌ [ASYNC V2] Exception ao atualizar status:`, updateError);
    }
    
    console.log(`❌ [ASYNC V2] ===== FIM DA FUNÇÃO (ERRO) =====`);
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('📸 [POST /api/generate-image] Iniciando geração de imagem...');

    // Validar API Key
    if (!NEWPORT_API_KEY) {
      console.error('❌ NEXT_PUBLIC_NEWPORT_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Serviço de geração de imagens não configurado' },
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

    const userEmail = user.email;

    // Parse do body
    const body: GenerateImageRequest = await request.json();
    const {
      prompt,
      width = 512,
      height = 512,
      num = 1,
      seed = -1,
      referenceImageUrl,
      referenceImages = [],
      generationType,
      model = 'v1-fast',
      aspectRatio = '1:1',
      resolution = '1K',
      // useGoogleSearch não é extraído pois sempre usamos false por padrão
      // Google Search funciona apenas para v3 e requer responseModalities: ["TEXT", "IMAGE"]
    } = body;

    // Google Search Grounding: Funciona apenas para Nano Banana 2 (v3-high-quality)
    // Útil para criar visualizações baseadas em dados reais (clima, gráficos, eventos)
    // Mas na prática, raramente necessário para geração de imagens artísticas
    const actualUseGoogleSearch = false; // Desabilitado por padrão

    // Validar API Key para Nano Banana (usado pelo v2-quality e v3-high-quality)
    if ((model === 'v2-quality' || model === 'v3-high-quality') && !LAOZHANG_API_KEY) {
      console.error('❌ LAOZHANG_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Serviço de geração de imagens Quality não configurado' },
        { status: 500 }
      );
    }

      console.log('📋 Dados da requisição:', {
      userEmail,
      generationType,
      model,
      prompt: prompt.substring(0, 50) + '...',
      width,
      height,
      num,
      hasReference: !!referenceImageUrl || (referenceImages && referenceImages.length > 0),
      numReferenceImages: referenceImages?.length || 0,
      aspectRatio: model === 'v3-high-quality' ? aspectRatio : 'N/A',
      resolution: model === 'v3-high-quality' ? resolution : 'N/A',
      useGoogleSearch: model === 'v3-high-quality' ? actualUseGoogleSearch : false, // Sempre false para v3
    });

    // Validações
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt é obrigatório' }, { status: 400 });
    }

    // ⚡ LIMITE DE GERAÇÕES SIMULTÂNEAS: Verificar imagens em processamento
    // IMPORTANTE: Limpar gerações antigas (>5min) automaticamente para evitar travamento
    const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);
    
    // Primeiro, limpar gerações antigas automaticamente
    const { error: cleanupError } = await supabase
      .from('generated_images')
      .update({ 
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail)
      .eq('status', 'processing')
      .lt('created_at', FIVE_MINUTES_AGO.toISOString());

    if (cleanupError) {
      console.error('❌ Erro ao limpar gerações antigas:', cleanupError.message);
    } else {
      console.log('🧹 Limpeza automática de gerações antigas (>5min) executada');
    }

    // Verificar LIMITE GLOBAL (todos os usuários)
    const { count: globalProcessingCount, error: globalCountError } = await supabase
      .from('generated_images')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processing');

    // Vercel Pro: 100 execuções simultâneas
    // Deixar 20 para outras operações (API calls, etc)
    const GLOBAL_LIMIT = 80; // Máximo 80 gerações simultâneas (Vercel Pro)
    
    if (!globalCountError && globalProcessingCount !== null) {
      console.log('🌍 Gerações globais em processamento:', globalProcessingCount, '/', GLOBAL_LIMIT);
      
      if (globalProcessingCount >= GLOBAL_LIMIT) {
        return NextResponse.json(
          {
            error: '⏳ Sistema em alta demanda',
            message: `O sistema está processando ${globalProcessingCount} gerações. Aguarde alguns segundos e tente novamente.`,
            retryAfter: 10, // segundos
          },
          { status: 503 } // Service Unavailable
        );
      }
    }

    // Agora verificar gerações em processamento do USUÁRIO (após limpeza)
    const { data: processingImages, error: processingError } = await supabase
      .from('generated_images')
      .select('id', { count: 'exact' })
      .eq('user_email', userEmail)
      .eq('status', 'processing');

    if (processingError) {
      console.error('❌ Erro ao verificar imagens em processamento:', processingError.message);
    } else {
      const processingCount = processingImages?.length || 0;
      const SIMULTANEOUS_LIMIT = 4;

      console.log('📊 Limite de gerações simultâneas do usuário:', {
        processing: processingCount,
        limit: SIMULTANEOUS_LIMIT,
        allowed: processingCount < SIMULTANEOUS_LIMIT,
      });

      if (processingCount >= SIMULTANEOUS_LIMIT) {
        return NextResponse.json(
          {
            error: '⏳ Limite de gerações simultâneas atingido',
            message: `Você já tem ${processingCount} imagens sendo geradas. Aguarde a conclusão de pelo menos uma para iniciar nova geração.`,
            processingCount,
            limit: SIMULTANEOUS_LIMIT,
          },
          { status: 429 }
        );
      }
    }

    if (width % 16 !== 0 || height % 16 !== 0) {
      return NextResponse.json(
        { error: 'Largura e altura devem ser múltiplos de 16' },
        { status: 400 }
      );
    }

    if (width > 1600 || height > 1600) {
      return NextResponse.json(
        { error: 'Largura e altura máximas: 1600px' },
        { status: 400 }
      );
    }

    if (num < 1 || num > 10) {
      return NextResponse.json(
        { error: 'Número de imagens deve ser entre 1 e 10' },
        { status: 400 }
      );
    }

    if (generationType === 'image2image' && !referenceImageUrl) {
      return NextResponse.json(
        { error: 'URL da imagem de referência é obrigatória para image2image' },
        { status: 400 }
      );
    }

    // Calcular créditos necessários baseado no modelo
    let creditsNeeded: number;
    
    if (model === 'v3-high-quality') {
      // v3-high-quality (Nano Banana 2):
      // - Custo FIXO: 10 créditos por imagem ($0.05/imagem)
      // - Não importa resolução (1K, 2K ou 4K)
      // - Não importa se tem imagens de referência ou não
      creditsNeeded = num * 10;
    } else if (model === 'v2-quality') {
      // v2-quality: 8 créditos FIXOS (API não cobra extra por imagens de referência)
      creditsNeeded = num * 8;
    } else {
      // v1-fast: 2
      creditsNeeded = num * CREDITS_PER_IMAGE;
    }
    
    console.log('💰 Créditos necessários:', {
      model,
      num,
      creditsPerImage: creditsNeeded / num,
      creditsNeeded,
    });

    // ⚡ RATE LIMITING: Verificar se pode processar agora (apenas para gpt-image-1)
    if (model === 'v2-quality') {
      const modelKey = 'gpt-image-1';
      const limitCheck = await rateLimiter.checkLimit(modelKey);
      
      if (!limitCheck.allowed) {
        console.warn(`⏸️ Rate limit atingido para ${modelKey}`);
        console.warn(`📊 Remaining: ${limitCheck.remaining}, Reset in: ${Math.ceil(limitCheck.resetIn / 1000)}s`);
        
        const waitSeconds = Math.ceil(limitCheck.resetIn / 1000);
        
        return NextResponse.json({
          error: '⏳ Sistema em Alta Demanda\n\n' +
                 `O limite de requisições por minuto foi atingido para o modelo GPT Image.\n\n` +
                 `⏰ Aguarde ${waitSeconds} segundos e tente novamente.\n\n` +
                 `💡 Dica: Tente usar o modelo Fast (V1) se disponível!`,
          rateLimitInfo: {
            model: modelKey,
            resetIn: limitCheck.resetIn,
            waitSeconds,
          }
        }, { status: 429 }); // 429 = Too Many Requests
      }

      // Registrar esta requisição no rate limiter
      rateLimiter.recordRequest(modelKey);
      
      console.log(`✅ Rate limit OK para ${modelKey} (${limitCheck.remaining} remaining)`);
    }


    // Verificar créditos e plano do usuário
    const { data: profile, error: profileError } = await supabase
      .from('emails')
      .select('creditos, creditos_extras, plano')
      .eq('email', userEmail)
      .single();

    if (profileError || !profile) {
      console.error('❌ Erro ao buscar perfil:', profileError?.message);
      return NextResponse.json({ error: 'Erro ao verificar créditos' }, { status: 500 });
    }

    const totalCredits = (profile.creditos || 0) + (profile.creditos_extras || 0);
    const userPlan = (profile.plano || 'free').toLowerCase();

    if (totalCredits < creditsNeeded) {
      console.warn('⚠️ Créditos insuficientes:', { totalCredits, creditsNeeded });
      return NextResponse.json(
        {
          error: 'Créditos insuficientes',
          creditsNeeded,
          creditsAvailable: totalCredits,
        },
        { status: 402 }
      );
    }

    // LIMITAÇÃO PARA PLANO FREE: 4 imagens por dia
    if (userPlan === 'free') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Contar imagens geradas hoje (INCLUINDO AS DELETADAS)
      // Importante: Deletar imagens NÃO recupera a cota diária
      // Usando soft delete, então não filtramos por deleted_at para contar TODAS
      const { data: todayImages, error: countError } = await supabase
        .from('generated_images')
        .select('num_images', { count: 'exact' })
        .eq('user_email', userEmail)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());
        // ⚠️ IMPORTANTE: NÃO filtrar por deleted_at - conta TODAS as imagens criadas hoje

      if (countError) {
        console.error('❌ Erro ao contar imagens do dia:', countError.message);
      } else {
        // Somar o total de imagens geradas (num_images de cada registro)
        const totalImagesGenerated = todayImages?.reduce((sum, record) => sum + (record.num_images || 0), 0) || 0;
        const dailyLimit = 4;
        const remainingImages = dailyLimit - totalImagesGenerated;

        console.log('📊 Limite diário FREE:', {
          plan: userPlan,
          generatedToday: totalImagesGenerated,
          limit: dailyLimit,
          remaining: remainingImages,
          requestedImages: num,
        });

        if (totalImagesGenerated >= dailyLimit) {
          return NextResponse.json(
            {
              error: 'Limite diário atingido',
              message: `Plano Free: limite de ${dailyLimit} imagens por dia atingido. Volte amanhã ou faça upgrade para gerar imagens ilimitadas!`,
              generatedToday: totalImagesGenerated,
              dailyLimit,
            },
            { status: 429 }
          );
        }

        if (totalImagesGenerated + num > dailyLimit) {
          return NextResponse.json(
            {
              error: 'Limite diário excedido',
              message: `Você pode gerar apenas mais ${remainingImages} ${remainingImages === 1 ? 'imagem' : 'imagens'} hoje (${totalImagesGenerated}/${dailyLimit} usadas). Reduza a quantidade ou faça upgrade!`,
              generatedToday: totalImagesGenerated,
              dailyLimit,
              remaining: remainingImages,
            },
            { status: 429 }
          );
        }
      }
    }

    // Deduzir créditos ANTES de fazer a requisição
    const newCreditos = Math.max(0, profile.creditos - creditsNeeded);
    const remainingDeduction = creditsNeeded - (profile.creditos - newCreditos);
    const newCreditosExtras = Math.max(0, profile.creditos_extras - remainingDeduction);

    const { error: updateError } = await supabase
      .from('emails')
      .update({
        creditos: newCreditos,
        creditos_extras: newCreditosExtras,
      })
      .eq('email', userEmail);

    if (updateError) {
      console.error('❌ Erro ao deduzir créditos:', updateError.message);
      return NextResponse.json({ error: 'Erro ao processar créditos' }, { status: 500 });
    }

    console.log('✅ Créditos deduzidos:', {
      creditsUsed: creditsNeeded,
      newCreditos,
      newCreditosExtras,
    });

    // ===== ROTEAMENTO DE API BASEADO NO MODELO =====
    let taskId: string;
    let imageUrls: Array<{ imageUrl: string; imageType: string }> | null = null;
    let responseModel: string;
    let isAsyncGeneration = false; // Flag para controlar se é geração assíncrona

    if (model === 'v3-high-quality') {
      // ===== NANO BANANA 2 (GEMINI 3 PRO) API - MODO CRON =====
      console.log('🚀 Usando Nano Banana 2 (Gemini 3 Pro) API para v3-high-quality (MODO CRON)');
      console.log('⚡ Task será processada pelo Vercel Cron a cada 5 minutos');
      
      const hasReferenceImages = referenceImages && referenceImages.length > 0;
      const isImageEdit = hasReferenceImages;
      
      taskId = generateTaskId(generationType);
      responseModel = isImageEdit ? 'gemini-3-pro-image-edit' : 'gemini-3-pro-image-preview';
      
      // ✅ Modo cron: Apenas salva no banco, Cron processa depois
      isAsyncGeneration = true;
      imageUrls = null;
      
      console.log('✅ Task criada - Cron processará em breve');
    } else if (model === 'v2-quality') {
      // ===== NANO BANANA (GEMINI) API - Geração ASSÍNCRONA (COM TIMEOUT ROBUSTO) =====
      console.log('🍌 Usando Nano Banana (Gemini) API para v2-quality (MODO ASSÍNCRONO com timeout)');
      
      // Para v2-quality, verificar se há referenceImages (array de base64)
      const hasReferenceImages = referenceImages && referenceImages.length > 0;
      
      // Validação de payload size
      if (hasReferenceImages) {
        const totalSize = referenceImages.reduce((sum, img) => sum + img.length, 0);
        const sizeMB = totalSize / 1024 / 1024;
        console.log(`📦 [V2] Tamanho total das imagens:`, sizeMB.toFixed(2), 'MB');
        
        // ⚠️ LIMITE REDUZIDO: 5MB (antes era 10MB)
        // API Laozhang pode travar com payloads muito grandes
        const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5MB
        
        if (totalSize > MAX_PAYLOAD_SIZE) {
          console.error(`❌ [V2] Payload muito grande:`, sizeMB.toFixed(2), 'MB (limite: 5MB)');
          
          // Reembolsar créditos
          await supabase
            .from('emails')
            .update({
              creditos: profile.creditos,
              creditos_extras: profile.creditos_extras,
            })
            .eq('email', userEmail);
          
          return NextResponse.json({
            error: 'Imagens muito grandes',
            message: `⚠️ Payload muito grande (${sizeMB.toFixed(1)}MB / limite: 5MB)\n\n` +
                     `Reduza:\n` +
                     `• Número de imagens de referência (máx 2-3 para v2)\n` +
                     `• Tamanho das imagens (elas são reduzidas para 768px automaticamente)\n\n` +
                     `💡 Dica: Use v3-high-quality para até 4 imagens!`,
          }, { status: 413 });
        }
        
        // ⚠️ AVISO se > 3MB
        if (totalSize > 3 * 1024 * 1024) {
          console.warn(`⚠️ [V2] Payload grande (${sizeMB.toFixed(2)}MB) - pode demorar mais ou falhar`);
        }
      }
      
      taskId = generateTaskId(generationType);
      const isImageEdit = hasReferenceImages;
      responseModel = isImageEdit ? 'gemini-2.5-flash-image-edit' : 'gemini-2.5-flash-image-preview';
      isAsyncGeneration = true; // ✅ Modo assíncrono (continua após reload)
      imageUrls = null; // Não espera conclusão
      
      console.log(`🚀 [V2 ASYNC] Preparando geração assíncrona (com timeout robusto):`, {
        taskId,
        model: responseModel,
        numImages: num,
        hasReferenceImages,
        promptPreview: prompt.substring(0, 50),
      });
      
      // ✅ Iniciar geração em background (COM TIMEOUT de 60s)
      generateV2ImageAsync(
        prompt,
        referenceImages,
        userEmail,
        taskId,
        num,
        supabase
      ).then(() => {
        console.log(`✅ [V2] Geração assíncrona completada com sucesso: ${taskId}`);
      }).catch(async (error) => {
        console.error('❌ [CATCH V2] Erro crítico na geração v2 assíncrona:', error);
        console.error('❌ [CATCH V2] Stack:', error instanceof Error ? error.stack : 'No stack');
        console.error('❌ [CATCH V2] TaskId:', taskId);
        
        // ✅ GARANTIR que marca como failed (reembolso já está dentro da função)
        try {
          console.log(`🔄 [CATCH V2] Tentando marcar taskId ${taskId} como failed...`);
          
          // Buscar créditos atuais para reembolsar
          const { data: currentProfile } = await supabase
            .from('emails')
            .select('creditos, creditos_extras')
            .eq('email', userEmail)
            .single();
          
          if (currentProfile) {
            // Reembolsar créditos
            const newCreditos = (currentProfile.creditos || 0) + creditsNeeded;
            await supabase
              .from('emails')
              .update({ creditos: newCreditos })
              .eq('email', userEmail);
            
            console.log(`💰 [CATCH V2] ${creditsNeeded} créditos reembolsados`);
          }
          
          // Marcar como failed
          const { error: updateError } = await supabase
            .from('generated_images')
            .update({ 
              status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('task_id', taskId);
          
          if (updateError) {
            console.error('❌ [CATCH V2] Erro ao marcar como failed:', updateError);
          } else {
            console.log(`✅ [CATCH V2] TaskId ${taskId} marcado como failed`);
          }
        } catch (updateError) {
          console.error('❌ [CATCH V2] Exception ao marcar como failed:', updateError);
        }
      });
      
      console.log('✅ Geração v2 iniciada em background (continua mesmo após reload)');
    } else {
      // ===== NEWPORT AI (FLUX) - Geração Assíncrona =====
      console.log('🚀 Usando Newport AI (Flux) para v1-fast');
      isAsyncGeneration = true; // Marcar como geração assíncrona

      const endpoint =
        generationType === 'text2image'
          ? `${NEWPORT_BASE_URL}/flux_text2image`
          : `${NEWPORT_BASE_URL}/flux_image2image`;

      const requestBody: Record<string, unknown> = {
        prompt,
        width,
        height,
        num,
        seed,
      };

      if (generationType === 'image2image' && referenceImageUrl) {
        requestBody.imageUrl = referenceImageUrl;
        console.log('🖼️ Image-to-Image detectado!');
        console.log('📷 Reference Image URL:', referenceImageUrl);
        console.log('🔗 URL é acessível:', referenceImageUrl.startsWith('http'));
      }

      console.log(`🚀 Enviando requisição para Newport AI (${generationType})...`);
      console.log('📋 Endpoint:', endpoint);
      console.log('📦 Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('🔑 API Key configurada:', !!NEWPORT_API_KEY);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NEWPORT_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      console.log('📥 Resposta da Newport AI:', {
        status: response.status,
        ok: response.ok,
        code: result.code,
        message: result.message,
        hasTaskId: !!result.data?.taskId,
      });
      console.log('📋 Resultado completo:', JSON.stringify(result, null, 2));

      if (!response.ok || result.code !== 0) {
        console.error('❌ Erro na Newport AI:', result);

        // Reembolsar créditos em caso de erro
        await supabase
          .from('emails')
          .update({
            creditos: profile.creditos,
            creditos_extras: profile.creditos_extras,
          })
          .eq('email', userEmail);

        return NextResponse.json(
          { error: result.message || 'Erro ao gerar imagem' },
          { status: response.status }
        );
      }

      taskId = result.data?.taskId;
      responseModel = 'newport-flux';

      if (!taskId) {
        console.error('❌ Task ID não retornado');
        return NextResponse.json({ error: 'Erro ao iniciar geração' }, { status: 500 });
      }
    }

    // Salvar no banco de dados
    const insertData: {
      user_email: string;
      generation_type: GenerationType;
      model: string;
      prompt: string;
      reference_image_url: string | null;
      reference_images?: string[]; // Array de URLs ou base64 das imagens de referência
      aspect_ratio?: string; // Para v3
      width: number;
      height: number;
      seed: number;
      num_images: number;
      task_id: string;
      status: 'processing' | 'completed';
      credits_used: number;
      image_urls?: Array<{ imageUrl: string; imageType: string }>;
      completed_at?: string;
    } = {
      user_email: userEmail,
      generation_type: generationType,
      model: responseModel,
      prompt,
      reference_image_url: referenceImageUrl || null,
      reference_images: (model === 'v2-quality' || model === 'v3-high-quality') ? referenceImages : undefined,
      aspect_ratio: model === 'v3-high-quality' ? aspectRatio : undefined,
      width,
      height,
      seed,
      num_images: num,
      task_id: taskId,
      status: imageUrls ? 'completed' : 'processing',
      credits_used: creditsNeeded,
    };

    // Se já temos as URLs (Nano Banana), adicionar ao registro
    if (imageUrls) {
      insertData.image_urls = imageUrls;
      insertData.completed_at = new Date().toISOString();
    }

    const { data: generatedImage, error: insertError } = await supabase
      .from('generated_images')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar no banco:', insertError.message);
      console.error('❌ Detalhes do erro:', insertError);
      console.error('❌ Dados que tentamos inserir:', JSON.stringify(insertData, null, 2));
      return NextResponse.json({ error: 'Erro ao salvar geração' }, { status: 500 });
    }

    console.log('✅ Geração salva no banco:', { 
      taskId, 
      id: generatedImage.id, 
      model: responseModel, 
      isAsync: isAsyncGeneration,
      status: insertData.status,
      hasImageUrls: !!insertData.image_urls,
      numImageUrls: insertData.image_urls?.length || 0,
    });

    // Retornar resposta diferente baseado no tipo de API
    if (imageUrls) {
      // Nano Banana - resposta síncrona com imagem pronta
      return NextResponse.json({
        success: true,
        taskId,
        generationId: generatedImage.id,
        creditsUsed: creditsNeeded,
        creditsRemaining: newCreditos + newCreditosExtras,
        status: 'completed',
        imageUrls,
        message: 'Imagem gerada com sucesso usando Nano Banana (Gemini)!',
      });
    } else {
      // Newport AI - resposta assíncrona (não espera conclusão, retorna imediatamente)
      console.log('🚀 Retornando resposta assíncrona - cliente fará polling');
      return NextResponse.json({
        success: true,
        taskId,
        generationId: generatedImage.id,
        creditsUsed: creditsNeeded,
        creditsRemaining: newCreditos + newCreditosExtras,
        status: 'processing',
        message: 'Geração iniciada com sucesso! Aguardando processamento...',
      });
    }
  } catch (error) {
    console.error('❌ [POST /api/generate-image] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

