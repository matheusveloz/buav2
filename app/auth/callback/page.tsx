'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const CALLBACK_PATH = '/auth/callback';
const HOME_DELAY_MS = 500;

export default function AuthCallbackPage() {
  const router = useRouter();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    const scheduleRedirect = (path: string, delay = 0) => {
      if (!isMounted) return;
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
      if (delay > 0) {
        redirectTimerRef.current = setTimeout(() => {
          router.replace(path);
        }, delay);
      } else {
        router.replace(path);
      }
    };

    const cleanupUrl = () => {
      if (window.location.pathname === CALLBACK_PATH && (window.location.search || window.location.hash)) {
        window.history.replaceState(null, '', CALLBACK_PATH);
      }
    };

    const redirectHome = () => {
      cleanupUrl();
      scheduleRedirect('/home', HOME_DELAY_MS);
    };

    const redirectWithError = (message: string) => {
      cleanupUrl();
      scheduleRedirect(`/login?error=${encodeURIComponent(message)}`);
    };

    const finalizeAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('auth/callback: erro ao verificar sessão atual', sessionError.message);
        }

        if (session) {
          redirectHome();
          return;
        }

        const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
        const searchParams = new URLSearchParams(window.location.search);

        const errorMessage =
          hashParams.get('error_description') ||
          searchParams.get('error_description') ||
          hashParams.get('error') ||
          searchParams.get('error');

        if (errorMessage) {
          redirectWithError(errorMessage);
          return;
        }

        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          cleanupUrl();
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            redirectWithError(error.message || 'Não foi possível concluir o login.');
            return;
          }

          redirectHome();
          return;
        }

        const authCode = searchParams.get('code');

        if (authCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(authCode);

          cleanupUrl();

          if (error) {
            redirectWithError(error.message || 'Não foi possível concluir o login.');
            return;
          }

          redirectHome();
          return;
        }

        redirectWithError('Retorno de autenticação inválido. Tente novamente.');
      } catch (error) {
        redirectWithError(error instanceof Error ? error.message : 'Não foi possível concluir o login.');
      }
    };

    void finalizeAuth();

    return () => {
      isMounted = false;
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-white">
      <div className="text-center">
        <div className="animate-pulse">
          <h1 className="text-2xl font-bold text-gray-800">Entrando...</h1>
        </div>
      </div>
    </div>
  );
}

