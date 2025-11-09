import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const LIPSYNC_API_URL = 'https://api.newportai.com/api/async/lipsync';

type LipsyncRequestBody = {
  srcVideoUrl?: string;
  audioUrl?: string;
  vocalAudioUrl?: string | null;
  videoParams?: Partial<{
    video_width: number;
    video_height: number;
    video_enhance: number;
  }>;
};

function toAbsoluteUrl(url: string, request: Request) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const origin = new URL(request.url).origin;
  if (url.startsWith('/')) {
    return `${origin}${url}`;
  }

  return `${origin}/${url}`;
}

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

    const body = (await request.json()) as LipsyncRequestBody;
    const { srcVideoUrl, audioUrl, vocalAudioUrl, videoParams } = body;

    if (!srcVideoUrl || !audioUrl) {
      return NextResponse.json(
        { error: 'srcVideoUrl e audioUrl são obrigatórios' },
        { status: 400 }
      );
    }

    const payload = {
      srcVideoUrl: toAbsoluteUrl(srcVideoUrl, request),
      audioUrl: toAbsoluteUrl(audioUrl, request),
      ...(vocalAudioUrl ? { vocalAudioUrl: toAbsoluteUrl(vocalAudioUrl, request) } : {}),
      videoParams: {
        video_width: 0,
        video_height: 0,
        video_enhance: 1,
        ...videoParams,
      },
    };

    const response = await fetch(LIPSYNC_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      console.error('LipSync API respondeu com erro', errorPayload);
      return NextResponse.json(
        { error: 'Falha ao iniciar geração de avatar', details: errorPayload },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      code?: number;
      message?: string;
      data?: { taskId?: string };
    };

    if (data.code !== 0 || !data.data?.taskId) {
      return NextResponse.json(
        { error: data.message ?? 'Falha ao obter taskId', details: data },
        { status: 502 }
      );
    }

    const taskId = data.data.taskId;

    const insertResult = await supabase.from('videos').insert({
      user_email: user.email,
      task_id: taskId,
      status: 'pending',
      source_video_url: srcVideoUrl,
      audio_url: audioUrl,
      creditos_utilizados: 0,
    });

    if (insertResult.error) {
      console.error('Erro ao registrar task: ', insertResult.error);
      return NextResponse.json(
        { error: 'Task criada, mas não foi possível registrar no banco.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        taskId,
        message: 'Task criada e registrada com sucesso.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado ao criar task de LipSync', error);
    return NextResponse.json({ error: 'Erro interno ao criar task' }, { status: 500 });
  }
}

