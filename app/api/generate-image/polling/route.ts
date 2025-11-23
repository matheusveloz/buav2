import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const NEWPORT_API_KEY = process.env.NEXT_PUBLIC_NEWPORT_API_KEY;
const NEWPORT_POLLING_URL = 'https://api.newportai.com/api/getAsyncResult';

interface PollingRequest {
  taskId: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [POST /api/generate-image/polling] Consultando resultado...');

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
    const body: PollingRequest = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId é obrigatório' }, { status: 400 });
    }

    console.log('📋 Consultando taskId:', taskId);

    // Detectar se é Nano Banana (taskId começa com 'nano-' ou 'nano-edit-')
    const isNanoBanana = taskId.startsWith('nano-') || taskId.startsWith('nano-edit-');
    
    // Detectar se é gpt-image-1 (taskId começa com 'gpt-image-')
    const isGptImage = taskId.startsWith('gpt-image-');

    // Verificar se a tarefa pertence ao usuário
    console.log(`🔍 [POLLING] Buscando no banco: taskId=${taskId}, user=${userEmail}`);
    const { data: generatedImage, error: fetchError } = await supabase
      .from('generated_images')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_email', userEmail)
      .single();

    if (fetchError || !generatedImage) {
      console.error('❌ Tarefa não encontrada:', fetchError?.message);
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }
    
    console.log(`📋 [POLLING] Registro encontrado:`, {
      id: generatedImage.id,
      status: generatedImage.status,
      model: generatedImage.model,
      hasImageUrls: !!generatedImage.image_urls,
      numImageUrls: generatedImage.image_urls?.length || 0,
      created_at: generatedImage.created_at,
    });

    // Se já completou, retornar dados do banco
    if (generatedImage.status === 'completed' && generatedImage.image_urls) {
      console.log('✅ [POLLING] Tarefa já concluída (cache do banco)');
      console.log('📸 [POLLING] Retornando', generatedImage.image_urls.length, 'imagens');
      console.log('📸 [POLLING] Estrutura das imagens:', JSON.stringify(generatedImage.image_urls));
      return NextResponse.json({
        status: 'completed',
        images: generatedImage.image_urls,
        generationId: generatedImage.id,
        taskId: generatedImage.task_id,
      });
    }

    // Se é Nano Banana, só retorna o status do banco (não faz polling externo)
    if (isNanoBanana) {
      console.log('🍌 [POLLING] Nano Banana detectado - consultando apenas banco de dados');
      
      // ⚠️ TIMEOUT DETECTION: Se a tarefa está em processing há mais de 5 minutos, marcar como failed
      // maxDuration = 300s (5min) e timeout da API = 240s (4min)
      // Com retry (2x 240s) + margem, pode demorar até 4.5min
      // Então timeout de 5min é seguro
      const TIMEOUT_MINUTES = 5; // 5 minutos
      const createdAt = new Date(generatedImage.created_at);
      const now = new Date();
      const elapsedMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;
      
      if (generatedImage.status === 'processing' && elapsedMinutes > TIMEOUT_MINUTES) {
        console.error(`⏱️ [POLLING] Timeout detectado! Tarefa está processando há ${Math.round(elapsedMinutes)} minutos (limite: ${TIMEOUT_MINUTES}min)`);
        console.error(`⏱️ [POLLING] Marcando taskId ${taskId} como failed devido a timeout`);
        
        // Reembolsar créditos ao usuário
        const creditsToRefund = generatedImage.credits_used || 0;
        if (creditsToRefund > 0) {
          console.log(`💰 [POLLING] Reembolsando ${creditsToRefund} créditos para ${userEmail}`);
          
          // Buscar perfil atual
          const { data: currentProfile } = await supabase
            .from('emails')
            .select('creditos, creditos_extras')
            .eq('email', userEmail)
            .single();
          
          if (currentProfile) {
            // Reembolsar aos créditos normais
            const newCreditos = (currentProfile.creditos || 0) + creditsToRefund;
            
            await supabase
              .from('emails')
              .update({ creditos: newCreditos })
              .eq('email', userEmail);
            
            console.log(`✅ [POLLING] ${creditsToRefund} créditos reembolsados (novo total: ${newCreditos})`);
          }
        }
        
        // Marcar como failed
        await supabase
          .from('generated_images')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('task_id', taskId);
        
        return NextResponse.json({
          status: 'failed',
          taskId,
          generationId: generatedImage.id,
          error: `Timeout: A geração demorou mais de ${TIMEOUT_MINUTES} minutos. Possível causa: Payload muito grande (muitas imagens de referência) ou problema na API. Seus créditos foram reembolsados.`,
        });
      }
      
      // Se ainda está processing, retornar processing
      if (generatedImage.status === 'processing') {
        console.log(`⏳ [POLLING] Nano Banana ainda processando... (${Math.round(elapsedMinutes)}min / ${TIMEOUT_MINUTES}min)`);
        return NextResponse.json({
          status: 'processing',
          taskId,
          generationId: generatedImage.id,
        });
      }

      // Se falhou
      if (generatedImage.status === 'failed') {
        console.log('❌ [POLLING] Nano Banana falhou');
        return NextResponse.json({
          status: 'failed',
          taskId,
          generationId: generatedImage.id,
        });
      }

      // Se completou mas não tem imagens (não deveria acontecer)
      if (generatedImage.status === 'completed') {
        console.log('✅ [POLLING] Nano Banana completou (verificando image_urls)');
        console.log('📸 [POLLING] image_urls:', generatedImage.image_urls);
        return NextResponse.json({
          status: 'completed',
          images: generatedImage.image_urls || [],
          generationId: generatedImage.id,
          taskId,
        });
      }
    }

    // Se é gpt-image-1, só retorna o status do banco (não faz polling externo)
    if (isGptImage) {
      console.log('🔍 gpt-image-1 detectado - consultando apenas banco de dados');
      
      // Se ainda está processing, retornar processing
      if (generatedImage.status === 'processing') {
        console.log('⏳ gpt-image-1 ainda processando...');
        return NextResponse.json({
          status: 'processing',
          taskId,
          generationId: generatedImage.id,
        });
      }

      // Se falhou
      if (generatedImage.status === 'failed') {
        console.log('❌ gpt-image-1 falhou');
        return NextResponse.json({
          status: 'failed',
          taskId,
          generationId: generatedImage.id,
        });
      }
    }

    // Consultar Newport AI (apenas para v1-fast / taskIds da Newport)
    console.log('🚀 Consultando Newport AI...');
    const response = await fetch(NEWPORT_POLLING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${NEWPORT_API_KEY}`,
      },
      body: JSON.stringify({ taskId }),
    });

    const result = await response.json();

    console.log('📥 Resposta da Newport AI:', { status: response.status, code: result.code });

    if (!response.ok || result.code !== 0) {
      console.error('❌ Erro na Newport AI:', result);

      // Se falhou, marcar como failed no banco
      if (result.code !== 0 && result.message !== 'processing') {
        await supabase
          .from('generated_images')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('task_id', taskId);
      }

      return NextResponse.json(
        { error: result.message || 'Erro ao consultar resultado' },
        { status: response.status }
      );
    }

    const taskData = result.data?.task;
    const images = result.data?.images;

    // Status da tarefa: 1=pendente, 2=processando, 3=concluído, 4=falhou
    const taskStatus = taskData?.status;

    console.log('📊 Status da tarefa:', { 
      taskStatus, 
      taskType: taskData?.taskType,
      hasImages: !!images,
      numImages: images?.length || 0,
    });

    // Se ainda processando
    if (taskStatus !== 3) {
      console.log('⏳ Tarefa ainda processando...');
      return NextResponse.json({
        status: 'processing',
        taskId,
        generationId: generatedImage.id,
        message: 'Imagem ainda sendo gerada. Aguarde...',
      });
    }

    // Se completou
    if (taskStatus === 3 && images && images.length > 0) {
      console.log(`✅ Tarefa concluída! ${images.length} imagens geradas.`);
      console.log('📋 URLs da Newport AI:', images.map((img: { imageUrl: string }) => img.imageUrl));

      // Fazer download das imagens e upload para Supabase Storage
      const finalImages = [];
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const imageUrl = img.imageUrl;
        const imageType = img.imageType || 'png';
        
        try {
          console.log(`📥 Baixando imagem ${i + 1}/${images.length}...`);
          
          // Baixar imagem da Newport AI
          const imageResponse = await fetch(imageUrl);
          
          if (!imageResponse.ok) {
            console.error(`❌ Erro ao baixar imagem ${i + 1}:`, imageResponse.status);
            continue;
          }
          
          const imageBuffer = await imageResponse.arrayBuffer();
          const imageBlob = Buffer.from(imageBuffer);
          
          // Gerar nome único para o arquivo
          const fileName = `${user.id}/${taskId}_${i}.${imageType}`;
          
          console.log(`📤 Fazendo upload para Supabase Storage: ${fileName}`);
          
          // Upload para Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('generated-images')
            .upload(fileName, imageBlob, {
              contentType: `image/${imageType}`,
              cacheControl: '3600',
              upsert: true,
            });
          
          if (uploadError) {
            console.error(`❌ Erro ao fazer upload da imagem ${i + 1}:`, uploadError.message);
            continue;
          }
          
          // Obter URL pública
          const { data: publicUrlData } = supabase.storage
            .from('generated-images')
            .getPublicUrl(fileName);
          
          const publicUrl = publicUrlData.publicUrl;
          
          console.log(`✅ Imagem ${i + 1} salva com sucesso:`, publicUrl);
          
          finalImages.push({
            imageUrl: publicUrl,
            imageType: imageType,
          });
          
        } catch (error) {
          console.error(`❌ Erro ao processar imagem ${i + 1}:`, error);
          // Em caso de erro, usar a URL original da Newport AI como fallback
          finalImages.push({
            imageUrl: imageUrl,
            imageType: imageType,
          });
        }
      }

      // Atualizar banco de dados com URLs do Supabase
      const { error: updateError } = await supabase
        .from('generated_images')
        .update({
          status: 'completed',
          image_urls: finalImages,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('task_id', taskId);

      if (updateError) {
        console.error('❌ Erro ao atualizar banco:', updateError.message);
      } else {
        console.log('✅ Banco de dados atualizado com sucesso');
      }

      return NextResponse.json({
        status: 'completed',
        images: finalImages,
        generationId: generatedImage.id,
        taskId,
        message: `${finalImages.length} imagem(ns) gerada(s) com sucesso!`,
      });
    }

    // Status desconhecido
    console.warn('⚠️ Status desconhecido:', taskStatus);
    return NextResponse.json({
      status: 'unknown',
      taskId,
      message: 'Status da tarefa desconhecido',
    });
  } catch (error) {
    console.error('❌ [POST /api/generate-image/polling] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

