'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState('Confirmando sua conta...');

  useEffect(() => {
    const exchangeSession = async () => {
      try {
        // Para lidar com o token no hash, usamos setSession
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        let session = null;

        if (accessToken && refreshToken) {
          // Fluxo implícito - seta a sessão manualmente
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            throw error;
          }
          session = data.session;

          // Limpa o hash da URL
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, document.title, cleanUrl);
        } else {
          // Fluxo PKCE com código
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            window.location.href,
          );
          if (error) {
            throw error;
          }
          session = data.session;
        }

        if (!session) {
          throw new Error('Sessão inválida recebida do Supabase.');
        }

        const userEmail = session.user?.email;

        if (userEmail) {
          const { error: upsertError } = await supabase
            .from('emails')
            .upsert(
              { email: userEmail },
              {
                onConflict: 'email',
              },
            );

          if (upsertError) {
            console.error('Erro ao salvar email no Supabase:', upsertError);
          }
        }

        router.replace('/home');
      } catch (error) {
        setStatus('error');
        const readableMessage =
          error instanceof Error
            ? error.message
            : 'Não foi possível confirmar sua sessão. Tente novamente.';
        setMessage(readableMessage);

        setTimeout(() => {
          router.replace('/login');
        }, 3000);
      }
    };

    void exchangeSession();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 text-center text-white">
      <div className="max-w-md space-y-4">
        <div className="relative h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        <h1 className="text-2xl font-semibold">
          {status === 'loading' ? 'Conectando...' : 'Ops! Algo deu errado'}
        </h1>
        <p className="text-sm text-white/70">{message}</p>
        {status === 'error' ? (
          <p className="text-xs text-white/50">
            Você será redirecionado para tentar novamente.
          </p>
        ) : null}
      </div>
    </main>
  );
}

