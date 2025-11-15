import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
      return NextResponse.json({ error: 'ID do vídeo não fornecido' }, { status: 400 });
    }

    // Buscar o vídeo
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_email', user.email)
      .maybeSingle();

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 });
    }

    const videoUrl = video.remote_video_url || video.local_video_path;

    if (!videoUrl) {
      return NextResponse.json({ error: 'URL do vídeo não disponível' }, { status: 404 });
    }

    // Fazer fetch do vídeo
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      return NextResponse.json({ error: 'Não foi possível baixar o vídeo' }, { status: 502 });
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const filename = `video-${videoId.slice(0, 8)}.mp4`;

    // Retornar com headers de download forçado
    return new NextResponse(videoBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': videoBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Erro ao fazer download do vídeo', error);
    return NextResponse.json({ error: 'Erro ao fazer download' }, { status: 500 });
  }
}

