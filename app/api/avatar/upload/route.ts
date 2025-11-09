import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveAvatarFile } from '@/lib/file-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de avatar não enviado' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const { fileId, publicPath } = await saveAvatarFile(arrayBuffer, file.name);

    const { data: inserted, error } = await supabase
      .from('user_avatars')
      .insert({
        user_email: user.email,
        video_path: publicPath,
        preview_path: null,
        thumbnail_path: null,
        original_filename: file.name,
      })
      .select('*')
      .maybeSingle();

    if (error || !inserted) {
      console.error('Erro ao registrar avatar do usuário', error);
      return NextResponse.json(
        { error: 'Avatar salvo, mas falhou ao registrar no banco.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        avatar: {
          id: inserted.id,
          label: inserted.original_filename ?? 'Avatar personalizado',
          videoUrl: inserted.video_path ?? publicPath,
          type: 'uploaded' as const,
          createdAt: inserted.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado ao enviar avatar', error);
    return NextResponse.json({ error: 'Erro interno ao enviar avatar' }, { status: 500 });
  }
}
