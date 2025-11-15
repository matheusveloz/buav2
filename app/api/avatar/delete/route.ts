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

    const { avatarId } = (await request.json()) as { avatarId: string };

    if (!avatarId) {
      return NextResponse.json({ error: 'ID do avatar não fornecido' }, { status: 400 });
    }

    // Buscar o avatar para pegar o storage_path
    const { data: avatar, error: fetchError } = await supabase
      .from('user_avatars')
      .select('*')
      .eq('id', avatarId)
      .eq('user_email', user.email)
      .maybeSingle();

    if (fetchError || !avatar) {
      return NextResponse.json({ error: 'Avatar não encontrado' }, { status: 404 });
    }

    // Tentar deletar do Storage se for URL do Supabase
    if (avatar.video_path?.includes('supabase.co/storage')) {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET?.trim() || 'avatars';
      const storagePath = `${user.id}/${avatarId}`;
      
      // Buscar arquivos que começam com esse ID
      const { data: files } = await supabase.storage.from(bucket).list(user.id, {
        search: avatarId,
      });

      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from(bucket).remove(filePaths);
      }
    }

    // Deletar registro do banco
    const { error: deleteError } = await supabase
      .from('user_avatars')
      .delete()
      .eq('id', avatarId)
      .eq('user_email', user.email);

    if (deleteError) {
      console.error('Erro ao deletar avatar do banco', deleteError);
      return NextResponse.json({ error: 'Falha ao deletar avatar' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Avatar deletado com sucesso' });
  } catch (error) {
    console.error('Erro inesperado ao deletar avatar', error);
    return NextResponse.json({ error: 'Erro interno ao deletar avatar' }, { status: 500 });
  }
}

