import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Esta rota limpa o cache do middleware quando o usuário atualizar créditos/plano
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // O cache do middleware será atualizado na próxima requisição
    // Esta rota serve apenas para forçar uma nova verificação
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

