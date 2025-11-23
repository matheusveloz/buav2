import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Sistema de créditos por modelo e tamanho (POR SEGUNDO)
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    console.log('🔄 [GET /api/generate-video/polling] Consultando resultado...');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId é obrigatório' }, { status: 400 });
    }

    console.log('📋 Consultando jobId:', jobId);

    // Consultar OpenAI Sora API
    console.log('🚀 Consultando OpenAI Sora...');

    const openaiResponse = await fetch(
      `https://api.openai.com/v1/videos/${jobId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    // Verificar se a resposta é OK
    if (!openaiResponse.ok) {
      console.error('❌ OpenAI retornou erro:', openaiResponse.status);
      
      // Se for 404, o job pode ter falhado ou não existe
      if (openaiResponse.status === 404) {
        // Verificar no banco de dados
        const supabase = await createSupabaseServerClient();
        const { data: videoRecord } = await supabase
          .from('generated_videos_sora')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (videoRecord) {
          // Marcar como failed no banco
          await supabase
            .from('generated_videos_sora')
            .update({ status: 'failed' })
            .eq('job_id', jobId);

          // Reembolsar créditos
          const creditsToRefund = getCreditsForConfig(videoRecord.model, videoRecord.size, videoRecord.seconds);
          
          const { data: userProfile } = await supabase
            .from('emails')
            .select('creditos, creditos_extras')
            .eq('email', videoRecord.user_email)
            .single();

          if (userProfile) {
            await supabase
              .from('emails')
              .update({
                creditos: userProfile.creditos + creditsToRefund,
              })
              .eq('email', videoRecord.user_email);

            console.log('✅ Créditos reembolsados:', creditsToRefund);
          }

          console.log('❌ Job não encontrado na OpenAI - marcado como failed');
          
          return NextResponse.json({
            status: 'failed',
            message: 'Vídeo não foi gerado. Seus créditos foram reembolsados.',
          });
        }
      }
      
      return NextResponse.json({
        status: 'processing', // Continuar tentando para outros erros
      });
    }

    // Tentar fazer parse do JSON
    const responseText = await openaiResponse.text();
    
    if (!responseText || responseText.trim() === '') {
      console.log('⏳ Resposta vazia - vídeo ainda processando...');
      return NextResponse.json({
        status: 'processing',
      });
    }

    let openaiData;
    try {
      openaiData = JSON.parse(responseText);
    } catch {
      console.error('❌ Erro ao fazer parse do JSON:', responseText.substring(0, 200));
      return NextResponse.json({
        status: 'processing', // Continuar tentando
      });
    }

    console.log('📥 Resposta COMPLETA da OpenAI:', JSON.stringify(openaiData, null, 2));
    
    console.log('📥 Resposta da OpenAI (resumo):', {
      id: openaiData.id,
      status: openaiData.status,
      progress: openaiData.progress,
      object: openaiData.object,
      model: openaiData.model,
      hasError: !!openaiData.error,
      completedAt: openaiData.completed_at,
    });

    // IMPORTANTE: A estrutura do Sora 2 é diferente
    // O vídeo completo vem como propriedade direta, não como openaiData.video.url
    
    // 1. Verificar se há erro explícito
    if (openaiData.error) {
      console.error('❌ Job retornou erro:', openaiData.error);
      
      const supabase = await createSupabaseServerClient();
      const { data: videoRecord } = await supabase
        .from('generated_videos_sora')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (videoRecord) {
        await supabase
          .from('generated_videos_sora')
          .update({ status: 'failed' })
          .eq('job_id', jobId);

        const creditsToRefund = getCreditsForConfig(videoRecord.model, videoRecord.size, videoRecord.seconds);
        
        const { data: userProfile } = await supabase
          .from('emails')
          .select('creditos, creditos_extras')
          .eq('email', videoRecord.user_email)
          .single();

        if (userProfile) {
          await supabase
            .from('emails')
            .update({
              creditos: userProfile.creditos + creditsToRefund,
            })
            .eq('email', videoRecord.user_email);

          console.log('✅ Créditos reembolsados:', creditsToRefund);
        }
      }

      // Mensagens user-friendly baseadas no tipo de erro
      const errorCode = openaiData.error.code || '';
      const errorMessage = openaiData.error.message || '';
      
      let userMessage = errorMessage || 'Não foi possível gerar o vídeo. Tente novamente.';
      
      if (errorCode === 'moderation_blocked' || errorMessage.includes('moderation')) {
        userMessage = '❌ Conteúdo Não Permitido\n\n' +
                     'Esta imagem ou texto não pode ser processado.\n\n' +
                     '💰 Seus créditos foram reembolsados.';
      }

      return NextResponse.json({
        status: 'failed',
        message: userMessage,
        errorCode: errorCode,
      });
    }

    // 2. Verificar status: failed
    if (openaiData.status === 'failed') {
      console.error('❌ Job com status failed');
      
      const supabase = await createSupabaseServerClient();
      const { data: videoRecord } = await supabase
        .from('generated_videos_sora')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (videoRecord) {
        await supabase
          .from('generated_videos_sora')
          .update({ status: 'failed' })
          .eq('job_id', jobId);

        const creditsToRefund = getCreditsForConfig(videoRecord.model, videoRecord.size, videoRecord.seconds);
        
        const { data: userProfile } = await supabase
          .from('emails')
          .select('creditos, creditos_extras')
          .eq('email', videoRecord.user_email)
          .single();

        if (userProfile) {
          await supabase
            .from('emails')
            .update({
              creditos: userProfile.creditos + creditsToRefund,
            })
            .eq('email', videoRecord.user_email);

          console.log('✅ Créditos reembolsados:', creditsToRefund);
        }
      }

      return NextResponse.json({
        status: 'failed',
        message: 'Vídeo não foi gerado. Seus créditos foram reembolsados.',
      });
    }

    // 3. Processing/Queued/Pending/In Progress
    if (openaiData.status === 'processing' || 
        openaiData.status === 'queued' || 
        openaiData.status === 'pending' ||
        openaiData.status === 'in_progress') {
      console.log(`⏳ Job ${openaiData.status}... (${openaiData.progress || 0}%)`);
      return NextResponse.json({
        status: 'processing',
        progress: openaiData.progress || 0,
      });
    }

    // 4. Completed - precisamos fazer uma chamada adicional para obter a URL do download
    if (openaiData.status === 'completed') {
      console.log('✅ Vídeo completo! Obtendo URL de download...');
      
      // Tentar endpoint /content primeiro
      let videoUrl: string | null = null;
      
      try {
        const contentResponse = await fetch(
          `https://api.openai.com/v1/videos/${jobId}/content`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
          }
        );

        console.log('📥 Content endpoint:', {
          status: contentResponse.status,
          contentType: contentResponse.headers.get('content-type'),
        });

        if (contentResponse.ok) {
          const contentType = contentResponse.headers.get('content-type');
          
          // Se retornar JSON com URL
          if (contentType?.includes('application/json')) {
            const contentData = await contentResponse.json();
            console.log('📥 Content data (JSON):', contentData);
            videoUrl = contentData.url || contentData.download_url || null;
          } 
          // Se retornar o vídeo direto (binário)
          else if (contentType?.includes('video/')) {
            console.log('📥 Vídeo binário recebido, salvando no Supabase...');
            
            const videoBlob = await contentResponse.blob();
            const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
            
            const supabase = await createSupabaseServerClient();
            const fileName = `sora-${jobId}.mp4`;
            
            const { error: uploadError } = await supabase.storage
              .from('generated-videos')
              .upload(fileName, videoBuffer, {
                contentType: 'video/mp4',
                upsert: true,
              });

            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from('generated-videos')
                .getPublicUrl(fileName);
              
              videoUrl = publicUrlData.publicUrl;
              console.log('✅ Vídeo salvo no Supabase:', videoUrl);
            } else {
              console.error('❌ Erro ao salvar vídeo:', uploadError);
            }
          }
        }
      } catch (contentError) {
        console.error('❌ Erro no endpoint /content:', contentError);
      }
      
      if (!videoUrl) {
        console.warn('⚠️ Não foi possível obter URL do vídeo');
        return NextResponse.json({
          status: 'processing',
        });
      }

      console.log('✅ URL do vídeo:', videoUrl.substring(0, 100));

      // Atualizar banco de dados
      const supabase = await createSupabaseServerClient();

      const { data: videoRecord, error: findError } = await supabase
        .from('generated_videos_sora')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (findError || !videoRecord) {
        console.error('❌ Erro ao buscar registro:', findError?.message);
        return NextResponse.json({
          status: 'completed',
          videoUrl,
        });
      }

      // Atualizar status para completed
      const { error: updateError } = await supabase
        .from('generated_videos_sora')
        .update({
          status: 'completed',
          video_url: videoUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('id', videoRecord.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar banco:', updateError.message);
      } else {
        console.log('✅ Banco atualizado com sucesso');
      }

      return NextResponse.json({
        status: 'completed',
        videoUrl,
        prompt: videoRecord.prompt,
        seconds: videoRecord.seconds,
        size: videoRecord.size,
        model: videoRecord.model,
      });
    }

    // Status desconhecido - continuar polling
    console.log('⏳ Status desconhecido, continuando polling...');
    return NextResponse.json({
      status: 'processing',
    });
  } catch (error) {
    console.error('❌ Erro ao fazer polling:', error);
    return NextResponse.json(
      { error: 'Erro ao consultar status do vídeo' },
      { status: 500 }
    );
  }
}
