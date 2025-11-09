import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email;

  if (email) {
    const { data: profile, error } = await supabase
      .from('emails')
      .select('creditos, plano')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('middleware: erro ao obter perfil do usuário', error.message);
    }

    res.headers.set('x-user-credits', String(profile?.creditos ?? 150));
    res.headers.set('x-user-plan', profile?.plano ?? 'free');
  }

  return res;
}

export const config = {
  matcher: ['/home/:path*'],
};
