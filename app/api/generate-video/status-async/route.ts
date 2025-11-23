import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ==================== POLLING ASYNC API - LAOZHANG ====================
// Endpoint para verificar o status de uma tarefa assíncrona
// Consultado pelo frontend a cada 3-5 segundos
// ======================================================================

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
const LAOZHANG_ASYNC_BASE_URL = 'https://api.laozhang.ai/v1/videos';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('id');

    if (!generationId) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    }

    console.log('🔍 [GET /api/generate-video/status-async] Verificando status:', generationId);

    // Buscar no banco
    const supabase = await createSupabaseServerClient();
    const { data: video, error } = await supabase
      .from('generated_videos_sora')
      .select('*')
      .eq('id', generationId)
      .single();

    if (error || !video) {
      console.error('❌ Vídeo não encontrado:', error?.message);
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 });
    }

    // Se já estiver completo, retornar imediatamente
    if (video.status === 'completed') {
      console.log('✅ Vídeo já completo:', video.video_url);
      return NextResponse.json({
        status: 'completed',
        videoUrl: video.video_url,
        progress: 100,
      });
    }

    // Se falhou, retornar erro
    if (video.status === 'failed') {
      console.log('❌ Vídeo falhou');
      return NextResponse.json({
        status: 'failed',
        message: 'Erro ao gerar vídeo',
      });
    }

    // Se está processando, verificar na LaoZhang
    if (video.status === 'processing' && video.job_id) {
      console.log('🔄 Consultando LaoZhang para task_id:', video.job_id);

      const laozhangResponse = await fetch(`${LAOZHANG_ASYNC_BASE_URL}/${video.job_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LAOZHANG_API_KEY}`,
        },
      });

      if (!laozhangResponse.ok) {
        console.error('❌ Erro ao consultar LaoZhang:', laozhangResponse.status);
        return NextResponse.json({
          status: 'processing',
          progress: 50,
          message: 'Processando...',
        });
      }

      const taskData = await laozhangResponse.json();
      console.log('📊 Status da tarefa COMPLETO:', JSON.stringify(taskData, null, 2));

      // Verificar se a tarefa está travada (mais de 10 minutos sem progresso)
      const taskAge = Date.now() / 1000 - taskData.created_at; // segundos
      const maxWaitTime = 600; // 10 minutos = 600 segundos
      
      console.log(`⏰ Tempo decorrido: ${Math.floor(taskAge / 60)} minutos e ${Math.floor(taskAge % 60)} segundos (max: ${maxWaitTime / 60} minutos)`);
      console.log(`📌 Status atual: "${taskData.status}" | Progress: ${taskData.progress}%`);
      
      if ((taskData.status === 'queued' || taskData.status === 'submitted') && taskAge > maxWaitTime) {
        console.error('⏰ TIMEOUT: Tarefa na fila por mais de 10 minutos');
        console.error('📋 Task ID:', video.job_id);
        console.error('🔗 Para debugar, consulte: https://api.laozhang.ai/v1/videos/' + video.job_id);
        
        // Reembolsar créditos
        const { data: profile } = await supabase
          .from('emails')
          .select('creditos, creditos_extras')
          .eq('email', video.user_email)
          .single();

        if (profile) {
          const creditsToRefund = video.model === 'sora-2-pro-all' ? 56 : 21;
          
          await supabase
            .from('emails')
            .update({
              creditos_extras: profile.creditos_extras + creditsToRefund,
            })
            .eq('email', video.user_email);
          
          console.log('💰 Créditos reembolsados por timeout:', creditsToRefund);
        }

        await supabase
          .from('generated_videos_sora')
          .update({ status: 'failed' })
          .eq('id', generationId);

        return NextResponse.json({
          status: 'failed',
          message: 'Tempo limite excedido. Tente novamente. Seus créditos foram reembolsados.',
        });
      }

      // Se ainda está processando (incluindo queued!)
      if (taskData.status === 'submitted' || taskData.status === 'in_progress' || taskData.status === 'queued') {
        return NextResponse.json({
          status: 'processing',
          progress: taskData.progress || 10, // Queued = 10%
          message: taskData.status === 'queued' ? 'Na fila de processamento...' : 'Processando...',
        });
      }

      // Se completou, baixar o vídeo
      if (taskData.status === 'completed' && taskData.url) {
        console.log('🎉 Vídeo pronto! Baixando:', taskData.url);

        // Construir URL completa do vídeo
        const videoContentUrl = `${LAOZHANG_ASYNC_BASE_URL}/${video.job_id}/content`;
        
        // Baixar vídeo
        const videoResponse = await fetch(videoContentUrl, {
          headers: {
            'Authorization': `Bearer ${LAOZHANG_API_KEY}`,
          },
        });

        if (!videoResponse.ok) {
          console.error('❌ Erro ao baixar vídeo:', videoResponse.status);
          
          await supabase
            .from('generated_videos_sora')
            .update({ status: 'failed' })
            .eq('id', generationId);
          
          return NextResponse.json({
            status: 'failed',
            message: 'Erro ao baixar vídeo',
          });
        }

        const videoBlob = await videoResponse.blob();
        const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

        // Upload para Supabase Storage
        const timestamp = Date.now();
        const fileName = `${video.user_email.split('@')[0]}_${timestamp}_${generationId}.mp4`;
        const filePath = `videos/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from('generated-videos')
          .upload(filePath, videoBuffer, {
            contentType: 'video/mp4',
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('❌ Erro no upload:', uploadError);
          
          // Fallback: salvar URL da LaoZhang (válida por 24h)
          await supabase
            .from('generated_videos_sora')
            .update({ 
              status: 'completed',
              video_url: videoContentUrl,
              completed_at: new Date().toISOString(),
            })
            .eq('id', generationId);
          
          return NextResponse.json({
            status: 'completed',
            videoUrl: videoContentUrl,
            progress: 100,
          });
        }

        // Obter URL pública
        const { data: publicUrlData } = supabase
          .storage
          .from('generated-videos')
          .getPublicUrl(filePath);

        const finalVideoUrl = publicUrlData.publicUrl;

        // Atualizar banco com URL final
        await supabase
          .from('generated_videos_sora')
          .update({ 
            status: 'completed',
            video_url: finalVideoUrl,
            completed_at: new Date().toISOString(),
          })
          .eq('id', generationId);

        console.log('✅ Vídeo salvo no storage:', finalVideoUrl);

        return NextResponse.json({
          status: 'completed',
          videoUrl: finalVideoUrl,
          progress: 100,
        });
      }

      // Se falhou na LaoZhang
      if (taskData.status === 'failed') {
        console.error('❌ Tarefa falhou na LaoZhang:', taskData.error);
        
        // Reembolsar créditos
        const { data: profile } = await supabase
          .from('emails')
          .select('creditos, creditos_extras')
          .eq('email', video.user_email)
          .single();

        if (profile) {
          const creditsToRefund = video.model === 'sora-2-pro-all' ? 56 : 21;
          
          await supabase
            .from('emails')
            .update({
              creditos_extras: profile.creditos_extras + creditsToRefund,
            })
            .eq('email', video.user_email);
          
          console.log('💰 Créditos reembolsados:', creditsToRefund);
        }

        await supabase
          .from('generated_videos_sora')
          .update({ status: 'failed' })
          .eq('id', generationId);

        // ✅ Traduzir mensagem de erro (chinês → português)
        let errorMessage = taskData.error?.message || 'Erro ao gerar vídeo';
        const errorType = taskData.error?.type || '';
        
        // Traduzir mensagens comuns em chinês
        if (errorMessage === '服务不可用，请稍后重试' || errorMessage.includes('服务不可用')) {
          errorMessage = '⚠️ Serviço Temporariamente Indisponível\n\n' +
                         'A API Sora 2 está com problemas no momento.\n\n' +
                         '✅ Seus créditos foram reembolsados automaticamente.\n\n' +
                         '💡 Tente novamente em alguns minutos!';
        } else if (errorType === 'task_failed') {
          errorMessage = '❌ Falha na Geração do Vídeo\n\n' +
                         'A API não conseguiu processar seu vídeo.\n\n' +
                         '✅ Créditos reembolsados.\n\n' +
                         '💡 Tente:\n' +
                         '• Reformular o prompt\n' +
                         '• Usar prompt mais simples\n' +
                         '• Aguardar alguns minutos';
        }

        return NextResponse.json({
          status: 'failed',
          message: errorMessage,
        });
      }
    }

    // Status padrão
    return NextResponse.json({
      status: 'processing',
      progress: 30,
      message: 'Processando...',
    });

  } catch (error) {
    console.error('❌ Erro no polling:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}

