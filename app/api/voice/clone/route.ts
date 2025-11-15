import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
    const name = (body.name ?? '').toString().trim();
    const description = (body.description ?? '').toString().trim() || undefined;
    const audioUrl = (body.audioUrl ?? '').toString().trim() || undefined;

    if (name.length < 2) {
      return NextResponse.json({ error: 'Informe um nome válido para a voz.' }, { status: 400 });
    }

    console.log('[POST /api/voice/clone] Criando voz virtual:', {
      name,
      description,
      audioUrl,
      userEmail: user.email,
    });

    // Gerar ID único para a voz virtual
    const virtualVoiceId = `virtual-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Salvar apenas no banco (NÃO envia para ElevenLabs)
    const { error: insertError } = await supabase
      .from('user_voice_clones')
      .insert({
        user_email: user.email,
        voice_id: virtualVoiceId,
        name,
        description: description ?? null,
        category: 'virtual',
        sample_url: audioUrl,
        labels: null,
        is_public: false,
      });

    if (insertError) {
      console.error('[POST /api/voice/clone] Erro ao salvar voz virtual:', insertError);
      return NextResponse.json(
        { error: 'Falha ao salvar voz virtual no banco de dados.', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('[POST /api/voice/clone] Voz virtual criada com sucesso:', virtualVoiceId);

    return NextResponse.json(
      {
        voice: {
          id: virtualVoiceId,
          name,
          description: description ?? null,
          category: 'virtual',
          previewUrl: audioUrl,
          type: 'cloned' as const,
          owned: true,
          audioUrl, // Incluir URL do áudio para uso posterior
        },
        persisted: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/voice/clone] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao criar voz virtual.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}




