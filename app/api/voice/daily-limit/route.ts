import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DAILY_LIMIT_FREE = 3;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar plano do usuário
    const { data: profile } = await supabase
      .from('emails')
      .select('plano')
      .eq('email', user.email)
      .maybeSingle();

    const userPlan = profile?.plano ?? 'free';

    // Se não for free, não tem limite
    if (userPlan !== 'free') {
      return NextResponse.json({
        hasLimit: false,
        plan: userPlan,
        unlimited: true,
      });
    }

    // Buscar contagem de hoje
    const { data: dailyCount, error: countError } = await supabase.rpc('count_daily_audio_generations', {
      p_email: user.email,
    });

    if (countError) {
      console.error('[GET /api/voice/daily-limit] Erro ao verificar limite:', countError);
      
      // Se a função não existir, retornar limite padrão sem bloquear
      if (countError.code === '42883' || countError.message?.includes('function') || countError.message?.includes('does not exist')) {
        console.warn('[GET /api/voice/daily-limit] Função count_daily_audio_generations não existe, retornando limite padrão');
        return NextResponse.json({
          hasLimit: true,
          plan: 'free',
          limit: DAILY_LIMIT_FREE,
          used: 0,
          remaining: DAILY_LIMIT_FREE,
          canGenerate: true,
          warning: 'Sistema de limite em configuração',
        });
      }
      
      return NextResponse.json({ error: 'Erro ao verificar limite diário.' }, { status: 500 });
    }

    // dailyCount pode retornar um número ou um array [{audios_hoje: 0}]
    let todayGenerations = 0;
    
    if (typeof dailyCount === 'number') {
      todayGenerations = dailyCount;
    } else if (Array.isArray(dailyCount) && dailyCount.length > 0) {
      todayGenerations = dailyCount[0]?.audios_hoje ?? dailyCount[0] ?? 0;
    } else if (typeof dailyCount === 'object' && dailyCount !== null) {
      todayGenerations = (dailyCount as any).audios_hoje ?? 0;
    }
    
    const remaining = Math.max(0, DAILY_LIMIT_FREE - todayGenerations);

    console.log('[GET /api/voice/daily-limit] Resultado:', {
      email: user.email,
      plan: 'free',
      limit: DAILY_LIMIT_FREE,
      dailyCountRaw: dailyCount,
      used: todayGenerations,
      remaining,
    });

    return NextResponse.json({
      hasLimit: true,
      plan: 'free',
      limit: DAILY_LIMIT_FREE,
      used: todayGenerations,
      remaining,
      canGenerate: remaining > 0,
    });
  } catch (error) {
    console.error('[GET /api/voice/daily-limit] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro ao verificar limite diário.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

