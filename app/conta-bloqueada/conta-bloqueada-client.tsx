'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

type AccountInfo = {
  ativo: number;
  motivo_bloqueio: string | null;
  data_bloqueio: string | null;
};

export default function ContaBloqueadaClient() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccount = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user?.email) {
          console.log('⚠️ Sem sessão na página /conta-bloqueada, redirecionando para /login');
          router.replace('/login');
          return;
        }

        const { data: accountData } = await supabase
          .from('emails')
          .select('ativo, motivo_bloqueio, data_bloqueio')
          .eq('email', session.user.email)
          .single();

        if (accountData?.ativo !== 0) {
          console.log('✅ Conta ativa, redirecionando para /home');
          router.replace('/home');
          return;
        }

        setAccount(accountData);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao verificar conta:', error);
        router.replace('/login');
      }
    };

    checkAccount();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-pulse">
            <h1 className="text-2xl font-bold text-gray-800">Carregando...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
      <div className="w-full max-w-lg">
        {/* Card Principal */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          {/* Header com ícone */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-8 py-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white">Conta Bloqueada</h1>
          </div>

          {/* Conteúdo */}
          <div className="px-8 py-8">
            {/* Mensagem Principal */}
            <div className="mb-6 text-center">
              <p className="text-gray-700">
                Sua conta foi temporariamente bloqueada por questões de segurança.
              </p>
            </div>

            {/* Motivo do Bloqueio */}
            {account?.motivo_bloqueio && (
              <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm font-semibold text-red-900">Motivo</span>
                </div>
                <p className="text-sm text-gray-700">{account.motivo_bloqueio}</p>
              </div>
            )}

            {/* Data do Bloqueio */}
            {account?.data_bloqueio && (
              <div className="mb-8 text-center">
                <p className="text-xs text-gray-500">
                  Bloqueado em {new Date(account.data_bloqueio).toLocaleString('pt-BR')}
                </p>
              </div>
            )}

            {/* Botão Sair */}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-6 py-3.5 font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sair da Conta
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Contas bloqueadas por violação dos{' '}
            <a href="#" className="font-medium text-gray-700 underline-offset-2 hover:underline">
              Termos de Serviço
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

