'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectToHome = useCallback(() => {
    router.replace('/home');
  }, [router]);

  const checkExistingSession = useCallback(async () => {
    setIsLoading(true);
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
      redirectToHome();
      return true;
    }

    setIsLoading(false);
    return false;
  }, [redirectToHome]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!isMounted) return;

      const alreadyLogged = await checkExistingSession();

      if (!alreadyLogged && isMounted) {
        setIsLoading(false);
      }
    };

    if (isMounted) {
      setIsLoading(true);
      void bootstrap();
    }

    return () => {
      isMounted = false;
    };
  }, [checkExistingSession]);

  const getOAuthRedirectTo = () => {
    const fallbackBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') ?? 'https://buav2.vercel.app';

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
    setIsLoading(true);
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível continuar com Google.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="relative transition-transform duration-300 hover:scale-[1.02]">
          <div className="relative mx-auto mb-[-16px] h-6 w-[65%] rounded-3xl bg-gradient-to-b from-gray-50 to-gray-100" />
          <div className="relative z-10 mx-auto mb-[-20px] h-8 w-[75%] rounded-3xl bg-gradient-to-b from-gray-100 to-gray-200" />
          <div className="relative z-20 mx-auto mb-[-24px] h-10 w-[85%] rounded-3xl border border-gray-300 bg-white" />

          <div className="relative z-30 rounded-2xl border border-gray-200 bg-white p-10 shadow-xl">
            <div className="mb-8 text-center">
              <Image
                src="/ico.png"
                alt="BUUA Logo"
                width={70}
                height={70}
                className="mx-auto mb-6"
              />
              <h1 className="text-2xl font-light text-gray-700">Bem-vindo à</h1>
              <div className="relative mt-1 text-5xl font-bold">
                <span className="animate-shimmer bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 bg-[length:200%_100%] bg-clip-text text-transparent">
                  Buua
                </span>
                <span className="text-green-500">.</span>
              </div>
              <p className="mt-6 text-sm font-light leading-relaxed text-gray-600">
                Entre ou crie sua conta com o Google para começar a aproveitar nossa plataforma.
              </p>
            </div>

            {errorMessage ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {errorMessage}
              </p>
            ) : isLoading ? (
              <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Verificando credenciais...
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="group mb-6 inline-flex w-full items-center justify-center gap-3 rounded-full border border-gray-200 bg-white px-6 py-4 text-sm font-medium text-gray-700 shadow-md transition-all hover:shadow-xl hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
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
              {isLoading ? 'Redirecionando...' : 'Continuar com o Google'}
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