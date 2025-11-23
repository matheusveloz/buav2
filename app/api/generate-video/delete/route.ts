import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Verificar se o vídeo pertence ao usuário
    const { data: video, error: fetchError } = await supabase
      .from('generated_videos_sora')
      .select('*')
      .eq('id', id)
      .eq('user_email', user.email)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 });
    }

    // Deletar do banco
    const { error: deleteError } = await supabase
      .from('generated_videos_sora')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar:', deleteError);
      return NextResponse.json({ error: 'Erro ao deletar vídeo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
