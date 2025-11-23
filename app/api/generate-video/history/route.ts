import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar vídeos do usuário (incluindo job_id para polling)
    // IMPORTANTE: Soft delete só funciona se a coluna deleted_at existir
    // Execute o script supabase/ADD_SOFT_DELETE_TO_VIDEOS.sql se necessário
    const { data: videos, error } = await supabase
      .from('generated_videos_sora')
      .select('id, video_url, prompt, created_at, seconds, size, status, model, job_id, deleted_at')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao buscar vídeos:', error);
      return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
    }

    // Filtrar vídeos não deletados no JavaScript (compatível com ou sem coluna deleted_at)
    const filteredVideos = (videos || []).filter((v: { deleted_at: string | null }) => !v.deleted_at);

    return NextResponse.json({ videos: filteredVideos });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
