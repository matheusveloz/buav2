'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PROFILE, type Profile } from '@/lib/profile';

const STORAGE_KEY = 'userProfile';

type ProfileInput = {
  plan?: string | null;
  plano?: string | null;
  credits?: number | null;
  creditos?: number | null;
  extraCredits?: number | null;
  creditos_extras?: number | null;
};

type AuthenticatedShellProps = {
  initialProfile: Profile;
  userEmail: string;
  children: ReactNode;
};

export function AuthenticatedShell({ initialProfile, userEmail, children }: AuthenticatedShellProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const applyProfile = useCallback((input: ProfileInput) => {
    setProfile((current) => {
      const base = current ?? { ...DEFAULT_PROFILE };

      const planSource = input.plan ?? input.plano;
      const creditsSource = input.credits ?? input.creditos;
      const extraCreditsSource = input.extraCredits ?? input.creditos_extras;

      const next: Profile = {
        plan: typeof planSource === 'string' && planSource.trim().length > 0 ? planSource : base.plan,
        credits:
          typeof creditsSource === 'number' && Number.isFinite(creditsSource) ? creditsSource : base.credits,
        extraCredits:
          typeof extraCreditsSource === 'number' && Number.isFinite(extraCreditsSource)
            ? extraCreditsSource
            : base.extraCredits,
      };

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
          console.warn('Não foi possível salvar userProfile no localStorage:', error);
        }
      }

      if (
        base.plan === next.plan &&
        base.credits === next.credits &&
        base.extraCredits === next.extraCredits
      ) {
        return base;
      }

      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        applyProfile({
          plan: parsed?.plan,
          credits: parsed?.credits,
          extraCredits: parsed?.extraCredits,
        });
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialProfile));
      }
    } catch (error) {
      console.warn('Não foi possível ler userProfile do localStorage:', error);
    }
  }, [initialProfile, applyProfile]);

  useEffect(() => {
    if (!userEmail) {
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('emails')
        .select('plano, creditos, creditos_extras')
        .eq('email', userEmail)
        .maybeSingle();

      if (error) {
        console.error('Erro ao sincronizar perfil do usuário:', error);
        return;
      }

      if (data) {
        applyProfile({
          plano: data.plano,
          creditos: data.creditos,
          creditos_extras: data.creditos_extras,
        });
      }
    };

    void fetchProfile();
  }, [userEmail, applyProfile]);

  useEffect(() => {
    if (!userEmail) {
      return;
    }

    const channel = supabase
      .channel(`emails-changes-${userEmail}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emails',
          filter: `email=eq.${userEmail}`,
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (record) {
            applyProfile({
              plano: record.plano as string,
              creditos: record.creditos as number,
              creditos_extras: record.creditos_extras as number,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userEmail, applyProfile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn('Não foi possível remover userProfile do localStorage:', error);
      }
    }

    await supabase.auth.signOut();
    router.replace('/');
  }, [router]);

  const totalCredits = profile.credits + profile.extraCredits;
  const formattedCredits = new Intl.NumberFormat('pt-BR').format(Math.max(totalCredits, 0));
  const displayPlan = profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="relative z-[45] border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/ico.png" alt="BUUA Logo" width={48} height={48} className="rounded-lg" />
            <span className="text-2xl font-bold">
              <span className="text-gray-900">Buua</span>
              <span className="text-green-500">.</span>
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm transition-all duration-300">
              <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
              </svg>
              <span className="font-semibold text-gray-900 transition-all duration-300">{formattedCredits}</span>
              <span className="text-xs text-gray-500 capitalize transition-all duration-300">{displayPlan}</span>
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-md transition hover:shadow-lg"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-2xl">
                  <div className="border-b border-gray-100 p-4">
                    <p className="text-xs text-gray-500">Conectado como</p>
                    <p className="mt-1 truncate text-sm font-medium text-gray-900">{userEmail || '—'}</p>
                  </div>

                  <div className="py-2">
                    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Configurações
                    </button>

                    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                        />
                      </svg>
                      Planos
                    </button>

                    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                      Comprar créditos
                    </button>
                  </div>

                  <div className="border-t border-gray-100 py-2">
                    <button
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-0 mx-auto max-w-7xl px-6 py-12">{children}</main>
    </div>
  );
}

