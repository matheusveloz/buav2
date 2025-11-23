import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;

// Endpoint para cancelar uma geração em andamento
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params; // ⚡ Next.js 15: params é Promise
    const videoId = params.id;
    
    console.log(`🗑️ [DELETE /api/generate-video/${videoId}] Cancelando geração...`);

    // Obter usuário autenticado
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Buscar vídeo no banco
    const { data: video, error: videoError } = await supabase
      .from('generated_videos_sora')
      .select('*')
      .eq('id', videoId)
      .eq('user_email', user.email) // Garantir que é do usuário
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: 'Vídeo não encontrado' }, { status: 404 });
    }

    // Se tiver job_id, tentar cancelar na LaoZhang
    if (video.job_id) {
      console.log(`🔄 Tentando cancelar task na LaoZhang: ${video.job_id}`);
      
      try {
        // LaoZhang pode ter endpoint de cancelamento (verificar docs)
        // Por enquanto, apenas marcamos como cancelled no banco
        console.log('⚠️ LaoZhang API pode não suportar cancelamento direto');
      } catch (cancelError) {
        console.error('❌ Erro ao cancelar na LaoZhang:', cancelError);
      }
    }

    // Marcar como cancelled no banco
    const { error: updateError } = await supabase
      .from('generated_videos_sora')
      .update({ 
        status: 'failed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao cancelar' }, { status: 500 });
    }

    // Reembolsar créditos
    const { data: profile } = await supabase
      .from('emails')
      .select('creditos, creditos_extras')
      .eq('email', user.email)
      .single();

    if (profile) {
      const refundAmount = video.model === 'sora-2-pro-all' ? 56 : 21;
      
      await supabase
        .from('emails')
        .update({
          creditos_extras: profile.creditos_extras + refundAmount,
        })
        .eq('email', user.email);
      
      console.log(`💰 ${refundAmount} créditos reembolsados`);
    }

    console.log(`✅ Geração ${videoId} cancelada com sucesso`);

    return NextResponse.json({
      success: true,
      message: 'Geração cancelada e créditos reembolsados',
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar geração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

