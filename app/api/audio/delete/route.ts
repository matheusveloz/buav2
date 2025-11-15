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

    const { audioIds } = (await request.json()) as { audioIds: string[] };

    if (!audioIds || !Array.isArray(audioIds) || audioIds.length === 0) {
      return NextResponse.json({ error: 'IDs dos áudios não fornecidos' }, { status: 400 });
    }

    console.log('Tentando deletar áudios:', { audioIds, userEmail: user.email });

    // Buscar todos os áudios para verificar ownership e pegar storage_path
    const { data: audios, error: fetchError } = await supabase
      .from('user_audios')
      .select('*')
      .in('id', audioIds)
      .eq('user_email', user.email);

    console.log('Áudios encontrados:', { count: audios?.length, error: fetchError });

    if (fetchError) {
      console.error('Erro ao buscar áudios:', fetchError);
      return NextResponse.json({ 
        error: 'Erro ao buscar áudios',
        details: fetchError.message,
      }, { status: 500 });
    }

    if (!audios || audios.length === 0) {
      return NextResponse.json({ error: 'Áudios não encontrados ou você não tem permissão' }, { status: 404 });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET?.trim() || 'audio';
    const storagePaths: string[] = [];

    // Coletar paths do storage
    for (const audio of audios) {
      if (audio.storage_path) {
        storagePaths.push(audio.storage_path);
      } else if (audio.audio_url?.includes('supabase.co/storage')) {
        // Tentar extrair o path da URL
        const match = audio.audio_url.match(/\/object\/public\/[^/]+\/(.+)$/);
        if (match) {
          storagePaths.push(match[1]);
        }
      }
    }

    // Deletar do Storage
    if (storagePaths.length > 0) {
      console.log('Deletando do Storage:', { bucket, paths: storagePaths });
      const { error: storageError } = await supabase.storage.from(bucket).remove(storagePaths);
      
      if (storageError) {
        console.warn('Erro ao deletar áudios do Storage (continuando...)', storageError);
      } else {
        console.log('Deletado do Storage com sucesso');
      }
    }

    // Deletar registros do banco
    console.log('Deletando do banco:', { audioIds });
    const { error: deleteError } = await supabase
      .from('user_audios')
      .delete()
      .in('id', audioIds)
      .eq('user_email', user.email);

    if (deleteError) {
      console.error('Erro ao deletar áudios do banco', deleteError);
      return NextResponse.json({ 
        error: 'Falha ao deletar áudios',
        details: deleteError.message,
      }, { status: 500 });
    }

    console.log('Deletado do banco com sucesso');

    return NextResponse.json({ 
      success: true, 
      message: `${audios.length} áudio(s) deletado(s) com sucesso`,
      deletedCount: audios.length,
    });
  } catch (error) {
    console.error('Erro inesperado ao deletar áudios', error);
    return NextResponse.json({ error: 'Erro interno ao deletar áudios' }, { status: 500 });
  }
}

