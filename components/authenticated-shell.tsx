'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [creditsAnimating, setCreditsAnimating] = useState(false);
  const prevCreditsRef = useRef(initialProfile.credits + initialProfile.extraCredits);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fechar menu quando qualquer modal abrir
  useEffect(() => {
    const handleModalOpened = () => {
      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
    };

    window.addEventListener('modalOpened', handleModalOpened);
    
    return () => {
      window.removeEventListener('modalOpened', handleModalOpened);
    };
  }, []);

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

  // Handlers para dropdowns com delay
  const handleMouseEnterDropdown = (dropdown: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpenDropdown(dropdown);
  };

  const handleMouseLeaveDropdown = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 300); // 300ms delay antes de fechar
  };

  const totalCredits = profile.credits + profile.extraCredits;
  const formattedCredits = new Intl.NumberFormat('pt-BR').format(Math.max(totalCredits, 0));
  const displayPlan = profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1);

  // Detectar mudança de créditos e animar
  useEffect(() => {
    const currentTotal = profile.credits + profile.extraCredits;
    const previousTotal = prevCreditsRef.current;

    if (currentTotal !== previousTotal) {
      setCreditsAnimating(true);
      prevCreditsRef.current = currentTotal;

      const timer = setTimeout(() => {
        setCreditsAnimating(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [profile.credits, profile.extraCredits]);

  // Listener para forçar reload do perfil quando créditos forem descontados
  useEffect(() => {
    const handleCreditsDeducted = async () => {
      // Forçar reload dos créditos do banco
      const { data } = await supabase
        .from('emails')
        .select('plano, creditos, creditos_extras')
        .eq('email', userEmail)
        .maybeSingle();

      if (data) {
        applyProfile({
          plano: data.plano,
          creditos: data.creditos,
          creditos_extras: data.creditos_extras,
        });
      }
    };

    window.addEventListener('creditsDeducted', handleCreditsDeducted);
    
    return () => {
      window.removeEventListener('creditsDeducted', handleCreditsDeducted);
    };
  }, [userEmail, applyProfile]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="relative z-40 border-b border-gray-200/50 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/home" className="flex items-center gap-3 transition hover:opacity-80">
            <Image src="/ico.png" alt="BUUA Logo" width={40} height={40} className="rounded-lg sm:h-12 sm:w-12" />
            <span className="text-xl font-bold sm:text-2xl">
              <span className="text-gray-900">Buua</span>
              <span className="text-green-500">.</span>
            </span>
          </Link>

          {/* Central Navigation Menu - Desktop */}
          <nav className="hidden lg:flex items-center gap-3">
            {/* Home */}
            <Link 
              href="/home"
              className="group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 hover:bg-gradient-to-br hover:from-purple-50/80 hover:to-pink-50/80"
            >
              <svg className="w-5 h-5 text-gray-700 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                <div className="bg-gray-900/90 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">Home</div>
              </div>
            </Link>

            {/* Avatar (with dropdown) */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnterDropdown('avatar')}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <button 
                className="group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 hover:bg-gradient-to-br hover:from-purple-50/80 hover:to-pink-50/80"
              >
                <svg className="w-6 h-6 text-gray-700 group-hover:text-purple-600 transition-colors" viewBox="0 0 32 32" fill="currentColor">
                  <path d="M10.906 13.114c1.415-2.462 4.647-2.958 6.797-1.492a4.94 4.94 0 0 1 2.744-.816c1.579 0 3.217.711 4.308 2.13.623.81 1.223 1.483 1.762 2.025l.035.032.343.334a12.328 12.328 0 0 0 .954.814c.264.198.454.313.554.359.44.202.765.592.884 1.061.048.19.058.383.036.572a1.597 1.597 0 0 1-.499 1.028c-.736.94-1.888 2.2-3.407 3.324-.028.021-.059.04-.088.058-1.964 1.438-4.544 2.657-7.632 2.657-2.214 0-4.379-.837-6.18-1.876-.009-.005-.019-.008-.028-.014a17.73 17.73 0 0 1-.347-.207l-.21-.13a19.73 19.73 0 0 1-.44-.285 18.199 18.199 0 0 1-.393-.269l-.09-.064c-1.493-1.059-2.73-2.245-3.463-3.212a1.599 1.599 0 0 1-.48-1.056 1.6 1.6 0 0 1 .926-1.588l.026-.013c.018-.01.044-.023.076-.042a10.145 10.145 0 0 0 .37-.235 14.66 14.66 0 0 0 .68-.479c.514-.38 1.086-.839 1.593-1.307l.014-.013c.552-.51.97-.972 1.155-1.296Zm13.098 3.755c-4.833.489-9.187.36-12.286.074-.544.488-1.12.952-1.64 1.338.65.622 1.507 1.317 2.494 1.943 2.92.212 6.622.273 10.683-.07.075-.088.161-.169.258-.24a14.594 14.594 0 0 0 1.863-1.656 16.33 16.33 0 0 1-.7-.624l-.388-.38-.11-.12a1.596 1.596 0 0 1-.174-.265Z" />
                </svg>
              </button>
              
              {openDropdown === 'avatar' && (
                <div 
                  className="absolute top-full left-0 mt-2 w-48 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl overflow-hidden z-50"
                  onMouseEnter={() => handleMouseEnterDropdown('avatar')}
                  onMouseLeave={handleMouseLeaveDropdown}
                >
                  <Link 
                    href="/avatar-video" 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-purple-50/80 hover:to-pink-50/80 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 shadow-md group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Vídeo Avatar</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Voice (with dropdown) */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnterDropdown('voice')}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <button 
                className="group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 hover:bg-gradient-to-br hover:from-blue-50/80 hover:to-cyan-50/80"
              >
                <svg className="w-5 h-5 text-gray-700 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>

              {openDropdown === 'voice' && (
                <div 
                  className="absolute top-full left-0 mt-2 w-48 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl overflow-hidden z-50"
                  onMouseEnter={() => handleMouseEnterDropdown('voice')}
                  onMouseLeave={handleMouseLeaveDropdown}
                >
                  <Link 
                    href="/create-voice" 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-cyan-50/80 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 shadow-md group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Criar Voz</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Image (with dropdown) */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnterDropdown('image')}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <button 
                className="group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 hover:bg-gradient-to-br hover:from-emerald-50/80 hover:to-lime-50/80"
              >
                <svg className="w-5 h-5 text-gray-700 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              
              {openDropdown === 'image' && (
                <div 
                  className="absolute top-full left-0 mt-2 w-48 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl overflow-hidden z-50"
                  onMouseEnter={() => handleMouseEnterDropdown('image')}
                  onMouseLeave={handleMouseLeaveDropdown}
                >
                  <button className="flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-emerald-50/80 hover:to-lime-50/80 transition-colors group w-full">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-lime-500 shadow-md group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Gerar Imagem</span>
                  </button>
                </div>
              )}
            </div>

            {/* Video (with dropdown) */}
            <div 
              className="relative"
              onMouseEnter={() => handleMouseEnterDropdown('video')}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <button 
                className="group relative flex items-center justify-center w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 hover:bg-gradient-to-br hover:from-orange-50/80 hover:to-yellow-50/80"
              >
                <svg className="w-5 h-5 text-gray-700 group-hover:text-orange-600 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              
              {openDropdown === 'video' && (
                <div 
                  className="absolute top-full left-0 mt-2 w-auto rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl overflow-hidden z-50"
                  onMouseEnter={() => handleMouseEnterDropdown('video')}
                  onMouseLeave={handleMouseLeaveDropdown}
                >
                  <button className="flex items-center gap-3 px-4 py-3 hover:bg-gradient-to-r hover:from-orange-50/80 hover:to-yellow-50/80 transition-colors group w-full whitespace-nowrap">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-yellow-500 shadow-md group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-900">Animar imagem ou texto</span>
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Desktop menu */}
          <div className="hidden items-center gap-4 sm:flex">
            <div 
              className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm transition-all duration-500 overflow-hidden sm:px-4 sm:py-2 ${
                creditsAnimating 
                  ? 'scale-110 border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200' 
                  : 'border-gray-200 bg-white'
              }`}
            >
              {creditsAnimating && (
                <div className="absolute inset-0 credits-shimmer pointer-events-none" />
              )}
              <svg 
                className={`h-4 w-4 transition-all duration-500 sm:h-5 sm:w-5 ${
                  creditsAnimating ? 'text-emerald-500 rotate-12 scale-125' : 'text-yellow-500'
                }`} 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
              </svg>
              <span 
                className={`relative text-sm font-semibold transition-all duration-500 sm:text-base ${
                  creditsAnimating ? 'text-emerald-700 scale-110' : 'text-gray-900'
                }`}
              >
                {formattedCredits}
              </span>
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
                    <Link
                      href="/configuracoes"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
                    >
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
                    </Link>

                    <Link
                      href="/upgrade"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
                    >
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 17l6-6 4 4 7-7M14 4h7v7"
                        />
                      </svg>
                      Upgrade
                    </Link>

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

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center sm:hidden"
          >
            <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white sm:hidden">
            <div className="space-y-1 px-4 pb-3 pt-2">
              <div 
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                  creditsAnimating 
                    ? 'border-emerald-400 bg-emerald-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <svg 
                  className={`h-5 w-5 ${
                    creditsAnimating ? 'text-emerald-500' : 'text-yellow-500'
                  }`} 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                </svg>
                <span className="font-semibold text-gray-900">{formattedCredits}</span>
                <span className="text-sm text-gray-500 capitalize">{displayPlan}</span>
              </div>

              <div className="mt-3 space-y-1">
                <p className="px-3 py-1 text-xs text-gray-500">Conectado como</p>
                <p className="truncate px-3 text-sm font-medium text-gray-900">{userEmail || '—'}</p>
              </div>

              <div className="mt-3 space-y-1">
                <Link
                  href="/configuracoes"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
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
                </Link>

                <Link
                  href="/upgrade"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 17l6-6 4 4 7-7M14 4h7v7"
                    />
                  </svg>
                  Upgrade
                </Link>

                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
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

                <button
                  onClick={handleSignOut}
                  className="mt-2 flex w-full items-center gap-3 rounded-lg border-t border-gray-200 px-3 py-2 pt-3 text-sm text-red-600 hover:bg-red-50"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-0 mx-auto max-w-7xl py-6 sm:py-12">{children}</main>
    </div>
  );
}