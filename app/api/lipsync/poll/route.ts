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

    const apiKey = process.env.NEWPORT_API_KEY;

    if (!apiKey) {
      console.error('NEWPORT_API_KEY não configurada');
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

    const durationMs = sttTotalLengthMs ?? executionTimeMs ?? 0;
    const durationSeconds = Math.max(0, Math.ceil(durationMs / 1000));
    const creditsUsed = durationSeconds + 1;

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

    const buffer = await videoResponse.arrayBuffer();
    const extension = videoType.replace(/^\./, '') || 'mp4';
    const { publicPath } = await saveVideoBuffer(taskId, buffer, extension);

    const updateResult = await supabase
      .from('videos')
      .update({
        status: 'completed',
        remote_video_url: videoUrl,
        local_video_path: publicPath,
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

    const { data: updatedRecord } = await supabase
      .from('videos')
      .select('*')
      .eq('task_id', taskId)
      .eq('user_email', user.email)
      .maybeSingle();

    return NextResponse.json({
      status: 'completed',
      videoUrl: publicPath,
      remoteVideoUrl: videoUrl,
      durationSeconds,
      creditsUsed,
      record: updatedRecord ?? null,
    });
  } catch (error) {
    console.error('Erro inesperado ao consultar task de LipSync', error);
    return NextResponse.json({ error: 'Erro interno ao consultar task' }, { status: 500 });
  }
}

