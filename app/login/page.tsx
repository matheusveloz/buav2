'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        flowType: 'pkce',
        options: {
          redirectTo,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar o login com Google.';
      setErrorMessage(message);
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur">
        <h1 className="text-3xl font-bold">Entrar</h1>
        <p className="mt-3 text-sm text-white/70">
          Use sua conta Google para acessar a BUUA v2.
        </p>
        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-base font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Redirecionando...' : 'Entrar com Google'}
        </button>
        <p className="mt-8 text-center text-sm text-white/60">
          Ainda não possui acesso?{' '}
          <Link
            href="/signup"
            className="font-semibold text-white hover:text-white/80"
          >
            Criar conta
          </Link>
        </p>
      </div>
      <Link
        href="/"
        className="mt-8 text-sm text-white/60 hover:text-white/90"
      >
        ← Voltar para a home
      </Link>
    </main>
  );
}

