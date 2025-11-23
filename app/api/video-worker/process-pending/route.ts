import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

// ==================== VIDEO WORKER - PROCESSA VÍDEOS PENDENTES ====================
// Este endpoint processa vídeos que estão em "processing" no banco de dados
// Consulta a LaoZhang, baixa vídeo pronto, e atualiza no Supabase Storage
// ==================================================================================

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
const LAOZHANG_ASYNC_BASE_URL = 'https://api.laozhang.ai/v1/videos';

interface ProcessResult {
  videoId: string;
  status: 'completed' | 'still_processing' | 'failed' | 'timeout';
  message: string;
  videoUrl?: string;
}

interface PendingVideo {
  id: string;
  job_id: string;
  user_email: string;
  created_at: string;
  model: string;
  [key: string]: unknown;
}

// Helper: Processar um único vídeo pendente
async function processSingleVideo(video: PendingVideo): Promise<ProcessResult> {
  const { id, job_id, user_email, created_at } = video;

  console.log(`\n🎬 Processando vídeo: ${id}`);
  console.log(`   Job ID: ${job_id}`);
  console.log(`   Usuário: ${user_email}`);

  // Verificar timeout (10 minutos desde criação)
  const videoAge = Date.now() - new Date(created_at).getTime();
  const maxAge = 10 * 60 * 1000; // 10 minutos

  if (videoAge > maxAge) {
    console.log(`   ⏰ Timeout (${Math.floor(videoAge / 1000)}s) - Reembolsando...`);
    
    const supabase = await createSupabaseServerClient();
    
    // Reembolsar créditos
    const { data: profile } = await supabase
      .from('emails')
      .select('creditos, creditos_extras')
      .eq('email', user_email)
      .single();

    if (profile) {
      const refundAmount = video.model === 'sora-2-pro-all' ? 56 : 21; // Doc diz $0.40=56, mas API pode cobrar menos
      await supabase
        .from('emails')
        .update({
          creditos_extras: profile.creditos_extras + refundAmount,
        })
        .eq('email', user_email);
      
      console.log(`   💰 ${refundAmount} créditos reembolsados`);
    }

    // Marcar como failed
    await supabase
      .from('generated_videos_sora')
      .update({ status: 'failed' })
      .eq('id', id);

    return {
      videoId: id,
      status: 'timeout',
      message: 'Timeout após 10 minutos',
    };
  }

  // Consultar LaoZhang
  try {
    console.log(`   🔍 Consultando LaoZhang...`);
    const response = await fetch(`${LAOZHANG_ASYNC_BASE_URL}/${job_id}`, {
      headers: { 'Authorization': `Bearer ${LAOZHANG_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.log(`   ⚠️ Erro HTTP ${response.status}`);
      return {
        videoId: id,
        status: 'still_processing',
        message: `Erro ao consultar: ${response.status}`,
      };
    }

    const taskData = await response.json();
    console.log(`   📊 Status: ${taskData.status}, Progress: ${taskData.progress || 0}%`);

    // Ainda processando
    if (taskData.status === 'submitted' || taskData.status === 'in_progress' || taskData.status === 'queued') {
      return {
        videoId: id,
        status: 'still_processing',
        message: `Status: ${taskData.status} (${taskData.progress || 0}%)`,
      };
    }

    // Falhou
    if (taskData.status === 'failed') {
      console.log(`   ❌ Geração falhou`);
      
      const supabase = await createSupabaseServerClient();
      
      // Reembolsar
      const { data: profile } = await supabase
        .from('emails')
        .select('creditos, creditos_extras')
        .eq('email', user_email)
        .single();

      if (profile) {
        const refundAmount = video.model === 'sora-2-pro-all' ? 56 : 21; // Doc diz $0.40=56
        await supabase
          .from('emails')
          .update({
            creditos_extras: profile.creditos_extras + refundAmount,
          })
          .eq('email', user_email);
        
        console.log(`   💰 ${refundAmount} créditos reembolsados`);
      }

      await supabase
        .from('generated_videos_sora')
        .update({ status: 'failed' })
        .eq('id', id);

      return {
        videoId: id,
        status: 'failed',
        message: 'Geração falhou',
      };
    }

    // Completado!
    if (taskData.status === 'completed') {
      console.log(`   ✅ Vídeo pronto! Baixando...`);

      const supabase = await createSupabaseServerClient();

      // Baixar vídeo
      const videoContentUrl = `${LAOZHANG_ASYNC_BASE_URL}/${job_id}/content`;
      const videoResponse = await fetch(videoContentUrl, {
        headers: { 'Authorization': `Bearer ${LAOZHANG_API_KEY}` },
        signal: AbortSignal.timeout(60000),
      });

      if (!videoResponse.ok) {
        throw new Error(`Erro ao baixar vídeo: ${videoResponse.status}`);
      }

      const videoBlob = await videoResponse.blob();
      const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

      console.log(`   📥 Vídeo baixado (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

      // Upload para Supabase Storage
      const timestamp = Date.now();
      const fileName = `${user_email.split('@')[0]}_${timestamp}_${id}.mp4`;
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
        console.error(`   ❌ Erro no upload:`, uploadError);
        throw new Error('Erro ao fazer upload');
      }

      // Obter URL pública
      const { data: publicUrlData } = supabase
        .storage
        .from('generated-videos')
        .getPublicUrl(filePath);

      const finalVideoUrl = publicUrlData.publicUrl;

      // Atualizar banco
      await supabase
        .from('generated_videos_sora')
        .update({
          status: 'completed',
          video_url: finalVideoUrl,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id);

      console.log(`   ✅ Vídeo salvo: ${finalVideoUrl}`);

      return {
        videoId: id,
        status: 'completed',
        message: 'Vídeo processado com sucesso',
        videoUrl: finalVideoUrl,
      };
    }

    return {
      videoId: id,
      status: 'still_processing',
      message: `Status desconhecido: ${taskData.status}`,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Erro ao processar:`, errorMessage);
    return {
      videoId: id,
      status: 'still_processing',
      message: `Erro: ${errorMessage}`,
    };
  }
}

export async function POST() {
  try {
    console.log('🔄 [VIDEO WORKER] Iniciando processamento de vídeos pendentes...');

    const supabase = await createSupabaseServerClient();

    // ==================== LIMPAR VÍDEOS VEO TRAVADOS ====================
    // Vídeos Veo não têm job_id (usam Sync API com streaming)
    // Se ficaram "processing" por mais de 2 minutos, marcar como failed
    console.log('🔍 Verificando vídeos Veo travados (processing sem job_id)...');
    
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: stuckVeoVideos } = await supabase
      .from('generated_videos_sora')
      .select('id, user_email, model, created_at')
      .eq('status', 'processing')
      .is('job_id', null) // Veo não tem job_id
      .lt('created_at', twoMinutesAgo); // Criado há mais de 2 minutos
    
    if (stuckVeoVideos && stuckVeoVideos.length > 0) {
      console.log(`⚠️ Encontrados ${stuckVeoVideos.length} vídeo(s) Veo travados`);
      
      for (const video of stuckVeoVideos) {
        try {
          console.log(`   🧹 Limpando vídeo Veo: ${video.id}`);
          
          // Buscar perfil para reembolsar
          const { data: profile } = await supabase
            .from('emails')
            .select('creditos, creditos_extras')
            .eq('email', video.user_email)
            .single();
          
          if (profile) {
            // Determinar créditos baseado no modelo Veo
            let refundAmount = 35; // Padrão Veo 3.1
            if (video.model?.includes('landscape')) refundAmount = 21;
            
            await supabase
              .from('emails')
              .update({
                creditos_extras: profile.creditos_extras + refundAmount,
              })
              .eq('email', video.user_email);
            
            console.log(`   💰 ${refundAmount} créditos reembolsados`);
          }
          
          // Marcar como failed
          await supabase
            .from('generated_videos_sora')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', video.id);
          
          console.log(`   ✅ Vídeo marcado como failed`);
        } catch (cleanupError) {
          console.error(`   ❌ Erro ao limpar vídeo ${video.id}:`, cleanupError);
        }
      }
    }

    // ==================== PROCESSAR VÍDEOS SORA ASYNC ====================
    // Buscar vídeos em "processing" com job_id (LaoZhang Async)
    const { data: pendingVideos, error: fetchError } = await supabase
      .from('generated_videos_sora')
      .select('*')
      .eq('status', 'processing')
      .not('job_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(10); // Processar até 10 vídeos por vez

    if (fetchError) {
      console.error('❌ Erro ao buscar vídeos pendentes:', fetchError);
      return NextResponse.json({ error: 'Erro ao buscar vídeos' }, { status: 500 });
    }

    if (!pendingVideos || pendingVideos.length === 0) {
      console.log('✅ Nenhum vídeo pendente para processar');
      return NextResponse.json({ 
        success: true, 
        message: 'Nenhum vídeo pendente',
        processed: 0,
      });
    }

    console.log(`📋 ${pendingVideos.length} vídeo(s) pendente(s) encontrado(s)`);

    // Processar cada vídeo
    const results: ProcessResult[] = [];
    
    for (const video of pendingVideos) {
      const result = await processSingleVideo(video);
      results.push(result);
    }

    // Resumo
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const timeout = results.filter(r => r.status === 'timeout').length;
    const stillProcessing = results.filter(r => r.status === 'still_processing').length;

    console.log('\n📊 RESUMO:');
    console.log(`   ✅ Completados: ${completed}`);
    console.log(`   ❌ Falhas: ${failed}`);
    console.log(`   ⏰ Timeouts: ${timeout}`);
    console.log(`   🔄 Ainda processando: ${stillProcessing}`);

    return NextResponse.json({
      success: true,
      processed: pendingVideos.length,
      results: {
        completed,
        failed,
        timeout,
        stillProcessing,
      },
      details: results,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Erro geral no worker:', error);
    return NextResponse.json(
      { error: 'Erro no worker', details: errorMessage },
      { status: 500 }
    );
  }
}

