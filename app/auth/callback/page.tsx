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
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href,
        );

        if (error) {
          throw error;
        }

        const userEmail = data.session?.user?.email;

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

        router.replace('/dashboard');
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

