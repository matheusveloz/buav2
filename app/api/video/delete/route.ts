import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { videoId } = (await request.json()) as { videoId: string };

    if (!videoId) {
      return NextResponse.json({ error: 'ID do vídeo não fornecido' }, { status: 400 });
    }

    // Buscar o vídeo para pegar informações
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_email', user.email)
      .maybeSingle();

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 });
    }

    // Deletar do Supabase Storage se for URL do Supabase
    if (video.remote_video_url?.includes('supabase.co/storage')) {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET?.trim() || 'videos';
      const taskId = video.task_id;
      
      // Buscar arquivos que começam com esse taskId
      const { data: files } = await supabase.storage.from(bucket).list(user.id, {
        search: taskId,
      });

      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from(bucket).remove(filePaths);
      }
    }

    // 🔥 SOFT DELETE: Marcar como deletado ao invés de remover
    // Isso garante que o limite diário (3 vídeos/dia no plano FREE) funcione corretamente
    // mesmo se o usuário deletar vídeos
    const { error: deleteError } = await supabase
      .from('videos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', videoId)
      .eq('user_email', user.email);

    if (deleteError) {
      console.error('Erro ao deletar vídeo do banco', deleteError);
      return NextResponse.json({ error: 'Falha ao deletar vídeo' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Vídeo deletado com sucesso' });
  } catch (error) {
    console.error('Erro inesperado ao deletar vídeo', error);
    return NextResponse.json({ error: 'Erro interno ao deletar vídeo' }, { status: 500 });
  }
}

