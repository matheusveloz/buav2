import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveAudioFile } from '@/lib/file-storage';

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
      return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const { fileId, publicPath, extension } = await saveAudioFile(arrayBuffer, file.name);

    return NextResponse.json(
      {
        audio: {
          id: fileId,
          url: publicPath,
          name: file.name,
          extension,
          type: 'upload' as const,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado ao enviar áudio', error);
    return NextResponse.json({ error: 'Erro interno ao enviar áudio' }, { status: 500 });
  }
}

