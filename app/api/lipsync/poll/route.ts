import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveVideoBuffer } from '@/lib/file-storage';

const POLL_API_URL = 'https://api.newportai.com/api/getAsyncResult';

type PollRequestBody = {
  taskId?: string;
};

type PollResponseData = {
  code?: number;
  message?: string;
  data?: {
    task?: {
      taskId?: string;
      status?: number;
      reason?: string;
      executionTime?: number;
    };
    videos?: Array<{
      videoUrl?: string;
      videoType?: string;
    }>;
    sttResult?: {
      tl?: number;
    };
  };
};

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const apiKey = process.env.NEXT_PUBLIC_NEWPORT_API_KEY;

    if (!apiKey) {
      console.error('NEXT_PUBLIC_NEWPORT_API_KEY não configurada');
      return NextResponse.json({ error: 'Configuração de API ausente' }, { status: 500 });
    }

    const { taskId } = (await request.json()) as PollRequestBody;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId é obrigatório' }, { status: 400 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_email', user.email)
      .maybeSingle();

    if (fetchError) {
      console.error('Erro ao buscar task local', fetchError);
      return NextResponse.json({ error: 'Erro ao buscar task' }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Task não encontrada para este usuário' }, { status: 404 });
    }

    const response = await fetch(POLL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      console.error('Polling API respondeu com erro', errorPayload);
      return NextResponse.json(
        { error: 'Falha ao consultar status da task', details: errorPayload },
        { status: response.status }
      );
    }

    const data = (await response.json()) as PollResponseData;

    if (data.code !== 0) {
      return NextResponse.json(
        { error: data.message ?? 'Erro ao consultar task', details: data },
        { status: 502 }
      );
    }

    const taskStatus = data.data?.task?.status;
    const failureReason = data.data?.task?.reason ?? null;

    if (taskStatus === 1 || taskStatus === 2) {
      return NextResponse.json({
        status: 'processing',
        task: data.data?.task,
        record: existing,
      });
    }

    if (taskStatus === 4) {
      // DEVOLVER CRÉDITOS EM CASO DE ERRO
      console.log('❌ Vídeo falhou, devolvendo créditos:', {
        taskId,
        creditos_a_devolver: existing.creditos_utilizados,
        motivo: failureReason,
      });

      if (existing.creditos_utilizados > 0) {
        const { data: currentProfile } = await supabase
          .from('emails')
          .select('creditos, creditos_extras')
          .eq('email', user.email)
          .maybeSingle();

        if (currentProfile) {
          // Devolver aos créditos regulares
          const newCredits = (currentProfile.creditos || 0) + existing.creditos_utilizados;
          
          await supabase
            .from('emails')
            .update({
              creditos: newCredits,
            })
            .eq('email', user.email);

          console.log('💰 Créditos devolvidos:', {
            creditos_anteriores: currentProfile.creditos,
            creditos_devolvidos: existing.creditos_utilizados,
            creditos_novos: newCredits,
          });
        }
      }

      await supabase
        .from('videos')
        .update({
          status: 'failed',
          failure_reason: failureReason,
          updated_at: new Date().toISOString(),
        })
        .eq('task_id', taskId)
        .eq('user_email', user.email);

      const { data: failedRecord } = await supabase
        .from('videos')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_email', user.email)
        .maybeSingle();

      return NextResponse.json({
        status: 'failed',
        reason: failureReason,
        record: failedRecord ?? null,
        creditsRefunded: existing.creditos_utilizados,
      });
    }

    if (taskStatus !== 3) {
      return NextResponse.json({
        status: 'unknown',
        task: data.data?.task,
      });
    }

    const videoUrl = data.data?.videos?.[0]?.videoUrl;
    const videoType = data.data?.videos?.[0]?.videoType ?? 'mp4';
    const sttTotalLengthMs =
      typeof data.data?.sttResult?.tl === 'number' ? data.data.sttResult.tl : undefined;
    const executionTimeMs =
      typeof data.data?.task?.executionTime === 'number'
        ? data.data.task.executionTime
        : undefined;

    console.log('📊 Dados brutos da API Newport:', {
      sttTotalLengthMs,
      executionTimeMs,
      hasVideo: !!videoUrl,
    });

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Task concluída sem retornar vídeo' },
        { status: 502 }
      );
    }

    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      console.error('Falha ao baixar vídeo retornado', videoUrl);
      return NextResponse.json(
        { error: 'Não foi possível baixar o vídeo gerado' },
        { status: 502 }
      );
    }

    // Baixar o vídeo
    const buffer = await videoResponse.arrayBuffer();
    const extension = videoType.replace(/^\./, '') || 'mp4';
    
    let ourVideoUrl: string | null = null;
    let localPath: string | null = null;

    // Upload direto para Supabase Storage
    const videoBucket = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET?.trim() || 'videos';
    const storagePath = `${user.id}/${taskId}.${extension}`;
    
    const { error: uploadError } = await supabase.storage
      .from(videoBucket)
      .upload(storagePath, Buffer.from(buffer), {
        cacheControl: '3600',
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      console.warn('Não foi possível salvar vídeo no Supabase Storage, usando URL remota', uploadError);
      ourVideoUrl = videoUrl;
    } else {
      const { data: publicUrlResult } = supabase.storage.from(videoBucket).getPublicUrl(storagePath);
      ourVideoUrl = publicUrlResult.publicUrl;
    }

    // Salvar localmente apenas em desenvolvimento
    if (!process.env.VERCEL) {
      try {
        const { publicPath } = await saveVideoBuffer(taskId, buffer, extension);
        localPath = publicPath;
      } catch (saveError) {
        console.warn('Não foi possível salvar localmente', saveError);
      }
    }

    // AGORA calcular duração e créditos DEPOIS de processar o vídeo
    // Prioridade: usar duração do áudio retornado pela API
    let durationSeconds = 0;
    
    if (sttTotalLengthMs !== undefined && sttTotalLengthMs > 0) {
      durationSeconds = Math.floor(sttTotalLengthMs);
      console.log('📊 Usando duração do áudio (sttResult.tl):', {
        rawValue: sttTotalLengthMs,
        durationSeconds,
      });
    } else if (executionTimeMs !== undefined && executionTimeMs > 0) {
      // Último recurso: execution time (milissegundos)
      durationSeconds = Math.floor(executionTimeMs / 1000);
      console.log('⏱️ Fallback: usando execution time:', {
        rawValue: executionTimeMs,
        durationSeconds,
      });
    }

    const creditsUsed = Math.max(1, durationSeconds + 1); // Mínimo 1 crédito

    console.log('💰 Cálculo final de créditos:', {
      durationSeconds,
      creditsUsed,
      formula: `${durationSeconds} segundos + 1 = ${creditsUsed} créditos`,
    });

    const updateResult = await supabase
      .from('videos')
      .update({
        status: 'completed',
        remote_video_url: ourVideoUrl || videoUrl,
        local_video_path: localPath,
        cloudinary_public_id: null,
        creditos_utilizados: creditsUsed,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('task_id', taskId)
      .eq('user_email', user.email);

    if (updateResult.error) {
      console.error('Erro ao atualizar registro de vídeo', updateResult.error);
      return NextResponse.json(
        { error: 'Vídeo gerado, mas falhou ao atualizar registro local' },
        { status: 500 }
      );
    }

    // CRÉDITOS JÁ FORAM DESCONTADOS NO INÍCIO - NÃO COBRAR NOVAMENTE
    console.log('✅ Créditos já cobrados no início:', {
      creditos_ja_cobrados: existing.creditos_utilizados,
      duracao_real: durationSeconds,
      creditos_que_seriam_cobrados: creditsUsed,
    });

    const { data: updatedRecord } = await supabase
      .from('videos')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_email', user.email)
      .maybeSingle();

    return NextResponse.json({
      status: 'completed',
      videoUrl: localPath || ourVideoUrl || videoUrl,
      remoteVideoUrl: ourVideoUrl || videoUrl,
      durationSeconds,
      creditsUsed,
      record: updatedRecord ?? null,
    });
  } catch (error) {
    console.error('Erro inesperado ao consultar task de LipSync', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ 
      error: 'Erro interno ao consultar task',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 500 });
  }
}

