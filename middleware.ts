import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Cache simples para evitar múltiplas queries
const accountCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 segundos

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // ✅ Criar cliente Supabase com @supabase/ssr (mais recente e estável)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const email = session?.user?.email;

  // Se tem sessão, verificar status da conta
  if (email) {
    let profile = null;
    const cached = accountCache.get(email);
    const now = Date.now();

    // Usar cache se disponível e ainda válido
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      profile = cached.data;
    } else {
      // Buscar do banco apenas se não tiver cache válido
      const { data, error } = await supabase
        .from('emails')
        .select('creditos, plano, ativo, motivo_bloqueio')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('middleware: erro ao obter perfil do usuário', error.message);
      } else {
        profile = data;
        // Atualizar cache
        accountCache.set(email, { data: profile, timestamp: now });
      }
    }

    // Verificar se conta está bloqueada
    if (profile?.ativo === 0) {
      // Se NÃO está tentando acessar conta-bloqueada ou api/auth, redireciona
      if (!req.nextUrl.pathname.startsWith('/conta-bloqueada') && 
          !req.nextUrl.pathname.startsWith('/api/auth')) {
        const redirectUrl = new URL('/conta-bloqueada', req.url);
        return NextResponse.redirect(redirectUrl);
      }
    }

    res.headers.set('x-user-credits', String(profile?.creditos ?? 90));
    res.headers.set('x-user-plan', profile?.plano ?? 'free');
    res.headers.set('x-user-active', String(profile?.ativo ?? 1));
  }

  return res;
}

export const config = {
  matcher: [
    '/home/:path*', 
    '/avatar-video/:path*', 
    '/create-voice/:path*',
    '/image-generator/:path*',
    '/configuracoes/:path*', 
    '/upgrade/:path*',
    '/buy-credits/:path*',
    '/dashboard/:path*',
    '/debug/:path*',
    '/conta-bloqueada',
    '/api/auth/callback',
  ],
};
