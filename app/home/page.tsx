'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function HomeDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace('/login');
        return;
      }

      setEmail(user.email ?? null);
      setIsLoading(false);
    };

    void loadUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 py-12 text-center text-white">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur">
        {isLoading ? (
          <>
            <div className="relative mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="mt-6 text-sm text-white/70">
              Carregando suas informações...
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Home BUUA</h1>
            <p className="mt-4 text-sm text-white/70">
              Seja bem-vindo(a) à nova BUUA v2.
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {email ?? 'Conta sem email definido'}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-full border border-white px-6 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
            >
              Sair
            </button>
          </>
        )}
      </div>
    </main>
  );
}

