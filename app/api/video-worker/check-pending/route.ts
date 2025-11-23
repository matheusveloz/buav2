import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ==================== CHECK PENDING VIDEOS ====================
// Endpoint para o frontend verificar vídeos pendentes do usuário
// Retorna vídeos em "processing" e dispara worker para processá-los
// ==============================================================

export async function GET() {
  try {
    console.log('🔍 [CHECK PENDING] Verificando vídeos pendentes do usuário...');

    const supabase = await createSupabaseServerClient();

    // Obter usuário autenticado
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar vídeos pendentes do usuário
    const { data: pendingVideos, error: fetchError } = await supabase
      .from('generated_videos_sora')
      .select('*')
      .eq('user_email', user.email)
      .eq('status', 'processing')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Erro ao buscar vídeos pendentes:', fetchError);
      return NextResponse.json({ error: 'Erro ao buscar vídeos' }, { status: 500 });
    }

    console.log(`📋 ${pendingVideos?.length || 0} vídeo(s) pendente(s) encontrado(s)`);

    // Se houver vídeos pendentes, disparar worker em background (apenas se NEXT_PUBLIC_SITE_URL estiver definido)
    if (pendingVideos && pendingVideos.length > 0 && process.env.NEXT_PUBLIC_SITE_URL) {
      console.log('🚀 Disparando worker em background...');
      
      // Chamar worker de forma assíncrona (não aguardar resposta)
      fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/video-worker/process-pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(err => {
        console.error('⚠️ Erro ao disparar worker:', err);
      });
    } else if (pendingVideos && pendingVideos.length > 0) {
      console.log('ℹ️ Worker não disparado: NEXT_PUBLIC_SITE_URL não configurado (desenvolvimento)');
    }

    return NextResponse.json({
      success: true,
      pendingCount: pendingVideos?.length || 0,
      videos: pendingVideos || [],
    });

  } catch (error) {
    console.error('❌ Erro ao verificar vídeos pendentes:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

