import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos para image-to-image (pode demorar mais)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Custo em créditos por tipo de geração (gpt-image-1)
// 1 crédito = R$ 0,04 (custo base da plataforma)
// 
// Custos OpenAI (dólar R$ 5,40):
// - Text-to-Image: ~$0.04 = R$ 0,216 = 5,4 créditos (cobramos 8 = margem 48%)
// - Image-to-Image: ~$0.06 = R$ 0,324 = 8,1 créditos (cobramos 12 = margem 48%)
const CREDITS_TEXT_TO_IMAGE = 8;   // R$ 0,32
const CREDITS_IMAGE_TO_IMAGE = 12; // R$ 0,48

interface GenerateImageRequest {
  prompt: string;
  num?: number;
  model?: string;
  width?: number;
  height?: number;
  referenceImages?: string[]; // Array de imagens base64 (até 2)
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 [POST /api/generate-image/dalle] Iniciando geração com gpt-image-1...');

    // Validar API Key
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Serviço de geração de imagens gpt-image-1 não configurado' },
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
      num = 1,
      width = 1024,
      height = 1024,
      referenceImages = [],
    } = body;

    console.log('📋 Dados da requisição:', {
      userEmail,
      model: 'gpt-image-1',
      prompt: prompt.substring(0, 50) + '...',
      num,
      width,
      height,
      hasReferenceImages: referenceImages.length > 0,
      numReferenceImages: referenceImages.length,
    });

    // Validações
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt é obrigatório' }, { status: 400 });
    }

    if (prompt.length > 32000) {
      return NextResponse.json(
        { error: 'Prompt muito longo. Máximo: 32000 caracteres para gpt-image-1' },
        { status: 400 }
      );
    }

    // gpt-image-1 suporta até 10 imagens
    if (num < 1 || num > 10) {
      return NextResponse.json(
        { error: 'gpt-image-1 suporta entre 1 e 10 imagens por requisição' },
        { status: 400 }
      );
    }

    // Calcular créditos necessários baseado no tipo de geração
    const hasReferenceImages = referenceImages && referenceImages.length > 0;
    const creditsPerImage = hasReferenceImages ? CREDITS_IMAGE_TO_IMAGE : CREDITS_TEXT_TO_IMAGE;
    const creditsNeeded = num * creditsPerImage;

    console.log('💰 Cálculo de créditos:', {
      tipo: hasReferenceImages ? 'Image-to-Image' : 'Text-to-Image',
      creditsPerImage,
      numImages: num,
      creditsNeeded,
    });

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

    const { error: creditsError } = await supabase
      .from('emails')
      .update({
        creditos: newCreditos,
        creditos_extras: newCreditosExtras,
      })
      .eq('email', userEmail);

    if (creditsError) {
      console.error('❌ Erro ao deduzir créditos:', creditsError.message);
      return NextResponse.json({ error: 'Erro ao processar créditos' }, { status: 500 });
    }

    console.log('✅ Créditos deduzidos:', {
      creditsUsed: creditsNeeded,
      newCreditos,
      newCreditosExtras,
    });

    // Salvar no banco ANTES de fazer requisição (como processing)
    // Isso permite que o usuário recarregue a página e o loading continue
    const { data: generatedImage, error: insertError } = await supabase
      .from('generated_images')
      .insert({
        user_email: userEmail,
        generation_type: 'text2image',
        model: 'gpt-image-1',
        prompt,
        reference_image_url: null,
        width: 1024,
        height: 1024,
        seed: -1,
        num_images: num,
        task_id: `gpt-image-${Date.now()}`, // ID único para gpt-image-1
        status: 'processing', // Começa como processing
        credits_used: creditsNeeded,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao salvar no banco:', insertError.message);
      return NextResponse.json({ error: 'Erro ao salvar geração' }, { status: 500 });
    }

    console.log('✅ Registro criado no banco:', { id: generatedImage.id, status: 'processing' });

    // Decidir qual endpoint usar baseado em ter imagens de referência ou não
    const endpoint = hasReferenceImages 
      ? 'https://api.openai.com/v1/images/edits'  // Image-to-image (edits)
      : 'https://api.openai.com/v1/images/generations'; // Text-to-image

    console.log(`🚀 Enviando requisição para OpenAI gpt-image-1 (${hasReferenceImages ? 'edits' : 'generations'})...`);
    
    let response;

    if (hasReferenceImages) {
      // ===== IMAGE EDITS (image-to-image) =====
      console.log('🖼️ Modo: Image-to-image com', referenceImages.length, 'imagem(ns) de referência');
      
      // Preparar FormData para /images/edits
      const formData = new FormData();
      formData.append('model', 'gpt-image-1');
      formData.append('prompt', prompt.trim());
      formData.append('n', num.toString());
      formData.append('size', '1024x1024');
      formData.append('quality', 'high');
      formData.append('input_fidelity', 'high'); // high = mais fidelidade às imagens de entrada

      // Adicionar imagens (base64 para Blob)
      for (let i = 0; i < Math.min(referenceImages.length, 16); i++) {
        const base64Data = referenceImages[i].includes(',') 
          ? referenceImages[i].split(',')[1] 
          : referenceImages[i];
        
        // Converter base64 para Blob
        const byteString = Buffer.from(base64Data, 'base64');
        const blob = new Blob([byteString], { type: 'image/png' });
        formData.append('image[]', blob, `image${i}.png`);
      }

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      });

    } else {
      // ===== IMAGE GENERATION (text-to-image) =====
      console.log('📝 Modo: Text-to-image');
      
      const payload = {
        model: 'gpt-image-1',
        prompt: prompt.trim(),
        n: num,
        size: '1024x1024',
        quality: 'high',
      };

      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
    }

    // Capturar resposta como texto primeiro para debug
    const responseText = await response.text();
    console.log('📥 Resposta raw da OpenAI:', {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 200),
    });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON:', parseError);
      console.error('📄 Resposta completa:', responseText);
      
      // Reembolsar créditos
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', userEmail);
      
      return NextResponse.json(
        { 
          error: 'Erro na resposta da API OpenAI',
          details: responseText.substring(0, 500),
        },
        { status: 500 }
      );
    }

    console.log('📥 Resposta da OpenAI:', { 
      status: response.status, 
      ok: response.ok,
      hasData: !!result.data,
      numImages: result.data?.length,
    });

    if (!response.ok) {
      console.error('❌ Erro na OpenAI API:', result);
      
      // Reembolsar créditos em caso de erro
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', userEmail);

      // Marcar como failed no banco
      await supabase
        .from('generated_images')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', generatedImage.id);

      // Verificar se é erro de safety system
      const errorMessage = result.error?.message || '';
      const isSafetyError = errorMessage.includes('safety system') || 
                           errorMessage.includes('rejected');

      return NextResponse.json(
        { 
          error: isSafetyError 
            ? 'Não foi possível gerar a imagem. Tente ajustar sua descrição.' 
            : 'Erro ao gerar imagem'
        },
        { status: response.status }
      );
    }

    // Extrair imagens base64 e converter para URLs de dados
    const images = result.data?.map((img: { b64_json: string }) => ({
      imageUrl: `data:image/png;base64,${img.b64_json}`,
      imageType: 'png',
    }));

    if (!images || images.length === 0) {
      console.error('❌ Imagens não retornadas');
      
      // Marcar como failed no banco
      await supabase
        .from('generated_images')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', generatedImage.id);
      
      return NextResponse.json({ error: 'Erro ao gerar imagem' }, { status: 500 });
    }

    console.log('✅ Imagens geradas com sucesso:', images.length);

    // Atualizar no banco de dados para completed
    const { error: updateError } = await supabase
      .from('generated_images')
      .update({
        status: 'completed',
        image_urls: images,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', generatedImage.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar no banco:', updateError.message);
      return NextResponse.json({ error: 'Erro ao salvar resultado' }, { status: 500 });
    }

    console.log('✅ Registro atualizado para completed:', { id: generatedImage.id });

    // Retornar imagens diretamente (é síncrono, não precisa de polling)
    return NextResponse.json({
      success: true,
      images, // Retorna as imagens diretamente
      generationId: generatedImage.id,
      creditsUsed: creditsNeeded,
      creditsRemaining: newCreditos + newCreditosExtras,
      message: 'Imagem gerada com sucesso!',
    });
  } catch (error) {
    console.error('❌ [POST /api/generate-image/dalle] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

