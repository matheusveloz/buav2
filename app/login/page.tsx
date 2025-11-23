'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectToHome = useCallback(async () => {
    console.log('🔄 redirectToHome iniciado');
    
    // Verificar se a conta está bloqueada antes de redirecionar
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('📧 Email da sessão:', session?.user?.email);
      
      if (session?.user?.email) {
        const { data: profile, error } = await supabase
          .from('emails')
          .select('ativo')
          .eq('email', session.user.email)
          .maybeSingle();
        
        console.log('📊 Perfil obtido:', { ativo: profile?.ativo, error: error?.message });
        
        if (profile?.ativo === 0) {
          console.log('🔒 Conta bloqueada detectada no login, redirecionando para /conta-bloqueada');
          router.replace('/conta-bloqueada');
          return;
        }
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status da conta:', error);
    }
    
    console.log('✅ Redirecionando para /home');
    router.replace('/home');
  }, [router]);

  const checkExistingSession = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Erro ao verificar sessão:', error.message);
        setIsLoading(false);
        return false;
      }

      if (session) {
        await redirectToHome();
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (err) {
      console.error('Erro ao verificar sessão existente:', err);
      setIsLoading(false);
      return false;
    }
  }, [redirectToHome]);

  useEffect(() => {
    let isMounted = true;

    // Timeout de segurança: se após 10 segundos ainda estiver loading, desativa
    const safetyTimeout = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn('⚠️ Timeout de segurança ativado - resetando isLoading');
        setIsLoading(false);
        setErrorMessage('O login demorou muito. Por favor, tente novamente.');
      }
    }, 10000);

    const redirectIfAuthParamsPresent = () => {
      if (typeof window === 'undefined') return false;

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
      );

      const hasAuthParams =
        searchParams.has('code') ||
        searchParams.has('error') ||
        searchParams.has('error_description') ||
        searchParams.has('access_token') ||
        searchParams.has('refresh_token') ||
        hashParams.has('access_token') ||
        hashParams.has('refresh_token') ||
        hashParams.has('code') ||
        hashParams.has('error') ||
        hashParams.has('error_description');

      if (!hasAuthParams) {
        return false;
      }

      setIsLoading(true);
      const nextUrl = `/auth/callback${window.location.search}${window.location.hash}`;
      router.replace(nextUrl);
      return true;
    };

    if (redirectIfAuthParamsPresent()) {
      return () => {
        isMounted = false;
        clearTimeout(safetyTimeout);
      };
    }

    const bootstrap = async () => {
      if (!isMounted) return;

      // NÃO mostrar loading durante verificação inicial
      const alreadyLogged = await checkExistingSession();

      if (!alreadyLogged && isMounted) {
        setIsLoading(false);
      }
    };

    if (isMounted) {
      // NÃO setar isLoading aqui - evita flash na tela
      void bootstrap();
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [checkExistingSession, router, isLoading]);

  const getOAuthRedirectTo = () => {
    const fallbackBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? 'https://buua.app';

    if (typeof window === 'undefined') {
      return `${fallbackBaseUrl}/auth/callback`;
    }

    const { origin, hostname } = window.location;
    const isLocalhost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

    if (isLocalhost) {
      return `${origin.replace(/\/+$/, '')}/auth/callback`;
    }

    return `${fallbackBaseUrl}/auth/callback`;
  };

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      const redirectTo = getOAuthRedirectTo();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        throw error;
      }
      
      // NÃO desativar loading aqui - deixar ativo até redirecionar
      // A página do Google vai abrir e o loading continua
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível continuar com Google.';
      setErrorMessage(message);
      setIsGoogleLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md">
        <div className="relative">
          <div className="relative mx-auto mb-[-12px] h-4 w-[65%] rounded-3xl bg-gradient-to-b from-gray-50 to-gray-100 sm:mb-[-16px] sm:h-6" />
          <div className="relative z-10 mx-auto mb-[-16px] h-6 w-[75%] rounded-3xl bg-gradient-to-b from-gray-100 to-gray-200 sm:mb-[-20px] sm:h-8" />
          <div className="relative z-20 mx-auto mb-[-20px] h-8 w-[85%] rounded-3xl border border-gray-300 bg-white sm:mb-[-24px] sm:h-10" />

          <div className="relative z-30 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-10">
            <div className="mb-6 text-center sm:mb-8">
              <Image
                src="/ico.png"
                alt="BUUA Logo"
                width={60}
                height={60}
                className="mx-auto mb-4 sm:mb-6 sm:h-[70px] sm:w-[70px]"
              />
              <h1 className="text-xl font-light text-gray-700 sm:text-2xl">Bem-vindo à</h1>
              <div className="relative mt-1 text-4xl font-bold sm:text-5xl">
                <span className="animate-shimmer bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-[length:200%_100%] bg-clip-text text-transparent">
                  Buua
                </span>
                <span className="text-green-500">.</span>
              </div>
              <p className="mt-4 text-xs font-light leading-relaxed text-gray-600 sm:mt-6 sm:text-sm">
                Entre ou crie sua conta com o Google para começar a aproveitar nossa plataforma.
              </p>
            </div>

            {/* Mensagem de erro (se houver) */}
            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading || isGoogleLoading}
              className="group mb-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-3 text-xs font-medium text-gray-700 shadow-md transition-all hover:shadow-xl hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:mb-6 sm:gap-3 sm:px-6 sm:py-4 sm:text-sm"
            >
              {isGoogleLoading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Abrindo Google...
                </>
              ) : isLoading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verificando credenciais...
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 transition-transform group-hover:scale-110"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                      <path
                        fill="#4285F4"
                        d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"
                      />
                      <path
                        fill="#34A853"
                        d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"
                      />
                    </g>
                  </svg>
                  Continuar com o Google
                </>
              )}
            </button>

            <div className="border-t border-gray-100 pt-6">
              <p className="text-center text-xs font-light text-gray-500">
                Ao continuar, você concorda com nossos{' '}
                <Link href="#" className="font-medium text-gray-700 underline-offset-2 hover:underline">
                  termos de serviço
                </Link>{' '}
                e{' '}
                <Link href="#" className="font-medium text-gray-700 underline-offset-2 hover:underline">
                  política de privacidade
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}