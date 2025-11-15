import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioId, newName } = body;

    if (!audioId || typeof audioId !== 'string') {
      return NextResponse.json(
        { error: 'ID do áudio é obrigatório.' },
        { status: 400 }
      );
    }

    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      return NextResponse.json(
        { error: 'Nome do áudio é obrigatório.' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Verificar autenticação
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: 'Usuário não autenticado.' },
        { status: 401 }
      );
    }

    console.log('[POST /api/audio/rename] Renomeando áudio:', {
      audioId,
      newName: newName.trim(),
      userEmail: user.email,
    });

    // Primeiro, verificar se o áudio existe e pertence ao usuário
    const { data: existingAudio, error: checkError } = await supabase
      .from('user_audios')
      .select('id, user_email, original_filename')
      .eq('id', audioId)
      .maybeSingle();

    console.log('[POST /api/audio/rename] Verificação do áudio:', {
      found: !!existingAudio,
      audioData: existingAudio,
      checkError,
    });

    if (checkError) {
      console.error('[POST /api/audio/rename] Erro ao verificar áudio:', checkError);
      return NextResponse.json(
        { error: 'Erro ao verificar áudio no banco de dados.' },
        { status: 500 }
      );
    }

    if (!existingAudio) {
      console.warn('[POST /api/audio/rename] Áudio não encontrado:', audioId);
      return NextResponse.json(
        { error: 'Áudio não encontrado.' },
        { status: 404 }
      );
    }

    if (existingAudio.user_email !== user.email) {
      console.warn('[POST /api/audio/rename] Usuário sem permissão:', {
        audioOwner: existingAudio.user_email,
        requestUser: user.email,
      });
      return NextResponse.json(
        { error: 'Você não tem permissão para editar este áudio.' },
        { status: 403 }
      );
    }

    // Atualizar o nome do áudio no banco de dados
    const { data, error: updateError } = await supabase
      .from('user_audios')
      .update({ original_filename: newName.trim() })
      .eq('id', audioId)
      .select();

    if (updateError) {
      console.error('[POST /api/audio/rename] Erro ao atualizar áudio:', updateError);
      return NextResponse.json(
        { error: 'Erro ao renomear áudio no banco de dados.' },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.error('[POST /api/audio/rename] Nenhum dado retornado após update');
      return NextResponse.json(
        { error: 'Falha ao atualizar áudio.' },
        { status: 500 }
      );
    }

    console.log('[POST /api/audio/rename] ✅ Áudio renomeado com sucesso:', {
      audioId,
      newName: newName.trim(),
    });

    return NextResponse.json({
      success: true,
      audio: {
        id: data[0].id,
        name: data[0].original_filename,
      },
    });
  } catch (error) {
    console.error('[POST /api/audio/rename] Erro inesperado:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}

