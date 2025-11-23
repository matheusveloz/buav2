import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verifica se a conta do usuário está bloqueada
 * @param userEmail Email do usuário
 * @returns { isBlocked: boolean, reason?: string }
 */
export async function checkAccountBlocked(userEmail: string): Promise<{
  isBlocked: boolean;
  reason?: string;
  blockedAt?: string;
}> {
  const { data, error } = await supabaseAdmin
    .from('emails')
    .select('ativo, motivo_bloqueio, data_bloqueio')
    .eq('email', userEmail)
    .single();

  if (error || !data) {
    return { isBlocked: false };
  }

  if (data.ativo === 0) {
    return {
      isBlocked: true,
      reason: data.motivo_bloqueio || 'Conta bloqueada',
      blockedAt: data.data_bloqueio || undefined,
    };
  }

  return { isBlocked: false };
}

/**
 * Retorna resposta de erro se conta estiver bloqueada
 * Usado nas APIs para verificar antes de processar
 */
export async function blockIfAccountBlocked(userEmail: string): Promise<NextResponse | null> {
  const blocked = await checkAccountBlocked(userEmail);

  if (blocked.isBlocked) {
    return NextResponse.json(
      {
        error: 'Conta bloqueada',
        message: blocked.reason || 'Sua conta foi bloqueada. Entre em contato com o suporte.',
        blockedAt: blocked.blockedAt,
      },
      { status: 403 }
    );
  }

  return null;
}

