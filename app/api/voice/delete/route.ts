import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ElevenLabsApiError } from '@/lib/elevenlabs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function deleteElevenLabsVoice(voiceId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY não configurada');
  }

  const url = `${process.env.ELEVENLABS_API_URL?.trim() || 'https://api.elevenlabs.io'}/v1/voices/${voiceId}`;

  console.log('[DELETE ElevenLabs Voice] Deletando voz:', { voiceId, url });

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    let details: unknown = null;
    const contentType = response.headers.get('content-type') ?? '';

    try {
      details = contentType.includes('application/json') ? await response.json() : await response.text();
    } catch (error) {
      details = { parseError: error instanceof Error ? error.message : String(error) };
    }

    console.error('[DELETE ElevenLabs Voice] Erro:', {
      status: response.status,
      statusText: response.statusText,
      details,
    });

    throw new ElevenLabsApiError(
      `Falha ao deletar voz na ElevenLabs (${response.status})`,
      response.status,
      details,
    );
  }

  console.log('[DELETE ElevenLabs Voice] Voz deletada com sucesso:', voiceId);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { voiceId } = body;

    if (!voiceId || typeof voiceId !== 'string') {
      return NextResponse.json({ error: 'Informe o voiceId da voz a ser deletada.' }, { status: 400 });
    }

    // Verificar se a voz pertence ao usuário
    const { data: voiceClone, error: fetchError } = await supabase
      .from('user_voice_clones')
      .select('*')
      .eq('voice_id', voiceId)
      .eq('user_email', user.email)
      .maybeSingle();

    if (fetchError) {
      console.error('[POST /api/voice/delete] Erro ao buscar voz:', fetchError);
      return NextResponse.json({ error: 'Erro ao verificar propriedade da voz.' }, { status: 500 });
    }

    if (!voiceClone) {
      return NextResponse.json({ error: 'Voz não encontrada ou você não tem permissão para deletá-la.' }, { status: 404 });
    }

    // Deletar da ElevenLabs
    await deleteElevenLabsVoice(voiceId);

    // Deletar do banco de dados
    const { error: deleteError } = await supabase
      .from('user_voice_clones')
      .delete()
      .eq('voice_id', voiceId)
      .eq('user_email', user.email);

    if (deleteError) {
      console.error('[POST /api/voice/delete] Erro ao deletar do banco:', deleteError);
      return NextResponse.json({ 
        error: 'Voz deletada da ElevenLabs, mas falhou ao remover do banco.',
        warning: 'A voz pode reaparecer na lista até você recarregar a página.'
      }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Voz deletada com sucesso.',
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ElevenLabsApiError) {
      console.error('[POST /api/voice/delete] ElevenLabs API error:', {
        status: error.status,
        details: error.details,
      });

      return NextResponse.json(
        {
          error: 'Falha ao deletar voz na ElevenLabs.',
          status: error.status,
          details: error.details,
        },
        { status: error.status >= 400 ? error.status : 502 },
      );
    }

    console.error('[POST /api/voice/delete] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao deletar voz.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

