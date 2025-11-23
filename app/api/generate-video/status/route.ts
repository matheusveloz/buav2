import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const maxDuration = 30;

// API para verificar status de um vídeo em processamento
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Buscar vídeo no banco
    const { data: video, error } = await supabase
      .from('generated_videos_sora')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      id: video.id,
      status: video.status,
      videoUrl: video.video_url,
      prompt: video.prompt,
      createdAt: video.created_at,
      completedAt: video.completed_at,
    });
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}

