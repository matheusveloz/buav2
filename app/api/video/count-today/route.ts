import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/video/count-today
 * 
 * Conta quantos vídeos foram criados hoje pelo usuário
 * 🔥 INCLUI vídeos deletados (soft delete) para validar limite diário
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Calcular início e fim do dia (UTC)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // 🔥 IMPORTANTE: NÃO filtra por deleted_at
    // Conta TODOS os vídeos criados hoje, incluindo os deletados
    const { data, error, count } = await supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', user.email)
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString());
      // Propositalmente NÃO filtra deleted_at

    if (error) {
      console.error('Erro ao contar vídeos do dia:', error);
      return NextResponse.json({ error: 'Erro ao contar vídeos' }, { status: 500 });
    }

    return NextResponse.json({ 
      count: count ?? 0,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
    });
  } catch (error) {
    console.error('Erro inesperado ao contar vídeos do dia:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

