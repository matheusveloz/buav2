'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PROFILE, type Profile } from '@/lib/profile';
import { SvgIconSprite, SvgIcon } from './svg-icons';
import { Home, Video, Mic, ImageIcon, Settings, TrendingUp, LogOut, Coins } from 'lucide-react';

const STORAGE_KEY = 'userProfile';

// Ícone customizado para Avatar Video - Pessoa com ondas de voz
const AvatarVideoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z" />
    <path d="M19 10c.5-.5 1-1 1-2" />
    <path d="M19 6c1 1 2 2 2 4" />
    <path d="M5 10c-.5-.5-1-1-1-2" />
    <path d="M5 6c-1 1-2 2-2 4" />
  </svg>
);

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
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [creditsAnimating, setCreditsAnimating] = useState(false);
  const prevCreditsRef = useRef(initialProfile.credits + initialProfile.extraCredits);
  const [hasCanceledSubscription, setHasCanceledSubscription] = useState(false);

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
        .select('plano, creditos, creditos_extras, ativo, motivo_bloqueio')
        .eq('email', userEmail)
        .maybeSingle();

      if (error) {
        console.error('Erro ao sincronizar perfil do usuário:', error);
        return;
      }

      if (data) {
        // 🔒 VERIFICAR SE CONTA ESTÁ BLOQUEADA
        if (data.ativo === 0) {
          console.log('🔒 Conta bloqueada detectada no AuthenticatedShell:', {
            email: userEmail,
            ativo: data.ativo,
            motivo: data.motivo_bloqueio,
            rota_atual: pathname,
          });
          
          // Se não está na página de conta bloqueada, redireciona
          if (pathname !== '/conta-bloqueada') {
            console.log('→ Redirecionando para /conta-bloqueada');
            router.replace('/conta-bloqueada');
            return;
          }
        }
        
        applyProfile({
          plano: data.plano,
          creditos: data.creditos,
          creditos_extras: data.creditos_extras,
        });
      }
    };

    void fetchProfile();
  }, [userEmail, applyProfile, router, pathname]);

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
        (payload: any) => {
          const record = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (record) {
            // 🔒 VERIFICAR SE CONTA FOI BLOQUEADA EM TEMPO REAL
            if (record.ativo === 0) {
              console.log('🔒 Conta bloqueada detectada via realtime:', {
                email: userEmail,
                ativo: record.ativo,
                motivo: record.motivo_bloqueio,
                rota_atual: pathname,
              });
              
              // Se não está na página de conta bloqueada, redireciona
              if (pathname !== '/conta-bloqueada') {
                console.log('→ Redirecionando para /conta-bloqueada (realtime)');
                router.replace('/conta-bloqueada');
                return;
              }
            }
            
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
  }, [userEmail, applyProfile, router, pathname]);

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

  // Verificar assinatura cancelada
  useEffect(() => {
    if (!userEmail) return;

    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/stripe/subscription');
        const data = await response.json();
        
        if (data.subscription && data.subscription.status === 'cancelada') {
          setHasCanceledSubscription(true);
        }
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
      }
    };

    void checkSubscription();
  }, [userEmail]);

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

  // Listener para atualizar créditos em tempo real
  useEffect(() => {
    const handleCreditsDeducted = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      // Se vier com valores absolutos (credits/extraCredits)
      if (customEvent.detail && typeof customEvent.detail.credits === 'number') {
        applyProfile({
          creditos: customEvent.detail.credits,
          creditos_extras: customEvent.detail.extraCredits || 0,
        });
      }
      // Se vier com valor a deduzir (amount)
      else if (customEvent.detail && typeof customEvent.detail.amount === 'number') {
        const amountToDeduct = customEvent.detail.amount;
        const currentTotal = profile.credits + profile.extraCredits;
        const newTotal = Math.max(0, currentTotal - amountToDeduct);
        
        // Deduz primeiro dos créditos extras, depois dos regulares
        let newExtraCredits = profile.extraCredits;
        let newRegularCredits = profile.credits;
        
        if (amountToDeduct > 0) {
          // Deduzindo
          if (newExtraCredits >= amountToDeduct) {
            newExtraCredits -= amountToDeduct;
          } else {
            const remaining = amountToDeduct - newExtraCredits;
            newExtraCredits = 0;
            newRegularCredits = Math.max(0, newRegularCredits - remaining);
          }
        } else {
          // Adicionando (quando amount é negativo)
          newExtraCredits += Math.abs(amountToDeduct);
        }
        
        applyProfile({
          creditos: newRegularCredits,
          creditos_extras: newExtraCredits,
        });
      }
    };

    window.addEventListener('creditsDeducted', handleCreditsDeducted);
    
    return () => {
      window.removeEventListener('creditsDeducted', handleCreditsDeducted);
    };
  }, [applyProfile, profile.credits, profile.extraCredits]);

  const menuItems = [
    {
      href: '/home',
      label: 'Home',
      Icon: Home,
    },
    {
      href: '/avatar-video',
      label: 'Vídeo Avatar',
      Icon: AvatarVideoIcon,
    },
    {
      href: '/create-voice',
      label: 'Criar Voz',
      Icon: Mic,
    },
    {
      href: '/image-generator',
      label: 'Gerar Imagem',
      Icon: ImageIcon,
    },
    {
      href: '/video-generator',
      label: 'Gerar Vídeo',
      Icon: Video,
    },
  ];

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100" style={{ minHeight: '100vh' }}>
      {/* SVG Icon Sprite */}
      <SvgIconSprite />
      
      {/* Sidebar Lateral Esquerda - Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-56 flex-col border-r border-gray-200/50 bg-white/80 backdrop-blur-xl z-40">
        {/* Logo no topo */}
        <div className="border-b border-gray-200/50 p-4">
          <Link href="/home" className="flex items-center gap-2 transition hover:opacity-80">
            <Image src="/ico.png" alt="BUUA Logo" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold">
              <span className="text-gray-900">Buua</span>
              <span className="text-green-500">.</span>
            </span>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.Icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  isActive
                    ? 'bg-[#c7f9e0]'
                    : 'hover:bg-gray-100'
                }`}
              >
                <Icon 
                  className={`w-5 h-5 transition-all duration-200 ${
                    isActive 
                      ? 'text-[#4b5563]' 
                      : 'text-[#4b5563] group-hover:scale-110 group-hover:rotate-6'
                  }`}
                  strokeWidth={2}
                />
                <span className={`text-sm font-medium text-[#4b5563] ${isActive ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer da Sidebar - Créditos e Menu do Usuário */}
        <div className="border-t border-gray-200/50 p-3 space-y-1.5">
          {/* Créditos */}
          <div className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-sm transition-all duration-500 ${
            creditsAnimating 
              ? 'scale-105 border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200' 
              : 'border-gray-200 bg-white'
          }`}>
            {creditsAnimating && (
              <div className="absolute inset-0 credits-shimmer pointer-events-none rounded-xl" />
            )}
            <SvgIcon 
              name="coin"
              width={18}
              height={18}
              className={`transition-all duration-500 flex-shrink-0 ${
                creditsAnimating ? 'text-emerald-500 rotate-12 scale-125' : 'text-yellow-500'
              }`}
              style={{ fill: 'currentColor', stroke: 'none' }}
            />
            <div className="flex flex-col flex-1 min-w-0">
              <span className={`text-sm font-bold transition-all duration-500 ${
                creditsAnimating ? 'text-emerald-700' : 'text-gray-900'
              }`}>
                {formattedCredits}
              </span>
              <span className="text-[10px] text-gray-500 capitalize">{displayPlan}</span>
            </div>
          </div>

          {/* Informação do Usuário */}
          <div className="rounded-xl bg-gray-50/50 px-3 py-2.5 border border-gray-100">
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Conectado como</p>
            <p className="text-xs text-gray-900 font-semibold truncate mt-1">{userEmail || '—'}</p>
          </div>

          {/* Links de Configurações e Upgrade */}
          <div className="space-y-0.5">
            <Link
              href="/configuracoes"
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                pathname === '/configuracoes'
                  ? 'bg-[#c7f9e0]'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Settings 
                className={`w-5 h-5 transition-all duration-200 ${
                  pathname === '/configuracoes'
                    ? 'text-[#4b5563]'
                    : 'text-[#4b5563] group-hover:scale-110 group-hover:rotate-12'
                }`}
                strokeWidth={2}
              />
              <span className={`font-medium text-[#4b5563] ${pathname === '/configuracoes' ? 'font-semibold' : ''}`}>
                Configurações
              </span>
            </Link>

            <Link
              href="/upgrade"
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                pathname === '/upgrade'
                  ? 'bg-[#c7f9e0]'
                  : 'hover:bg-gray-100'
              }`}
            >
              <TrendingUp 
                className={`w-5 h-5 transition-all duration-200 ${
                  pathname === '/upgrade'
                    ? 'text-[#4b5563]'
                    : 'text-[#4b5563] group-hover:scale-110 group-hover:translate-y-[-2px]'
                }`}
                strokeWidth={2}
              />
              <span className={`font-medium text-[#4b5563] ${pathname === '/upgrade' ? 'font-semibold' : ''}`}>
                Fazer Upgrade
              </span>
            </Link>

            <Link
              href="/buy-credits"
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                pathname === '/buy-credits'
                  ? 'bg-[#c7f9e0]'
                  : 'hover:bg-gray-100'
              }`}
            >
              <Coins 
                className={`w-5 h-5 transition-all duration-200 ${
                  pathname === '/buy-credits'
                    ? 'text-[#4b5563]'
                    : 'text-[#4b5563] group-hover:scale-110 group-hover:rotate-12'
                }`}
                strokeWidth={2}
              />
              <span className={`font-medium text-[#4b5563] ${pathname === '/buy-credits' ? 'font-semibold' : ''}`}>
                Comprar Créditos
              </span>
            </Link>

            <button
              onClick={handleSignOut}
              className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 hover:bg-red-50"
            >
              <LogOut 
                className="w-5 h-5 text-red-600 transition-all duration-200 group-hover:scale-110 group-hover:translate-x-1"
                strokeWidth={2}
              />
              <span className="font-medium text-red-600">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header com Menu Hambúrguer */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 border-b border-gray-200/50 bg-white/60 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/home" className="flex items-center gap-2">
            <Image src="/ico.png" alt="BUUA Logo" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-bold">
              <span className="text-gray-900">Buua</span>
              <span className="text-green-500">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Créditos - Mobile */}
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-sm transition-all ${
              creditsAnimating ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'
            }`}>
              <SvgIcon 
                name="coin"
                width={16}
                height={16}
                className={creditsAnimating ? 'text-emerald-500' : 'text-yellow-500'}
                style={{ fill: 'currentColor', stroke: 'none' }}
              />
              <span className="text-xs font-semibold text-gray-900">{formattedCredits}</span>
            </div>

            {/* Botão Menu Hambúrguer */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white border border-gray-200 shadow-sm"
            >
              <SvgIcon 
                name={isMobileMenuOpen ? 'close' : 'menu'}
                width={20}
                height={20}
                className="text-gray-700"
              />
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="border-t border-gray-200/50 bg-white/95 backdrop-blur-xl shadow-lg">
            <nav className="space-y-1 p-4">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.Icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-[#c7f9e0]'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <Icon 
                      className={`w-5 h-5 transition-all duration-200 ${
                        isActive 
                          ? 'text-[#4b5563]' 
                          : 'text-[#4b5563] group-hover:scale-110 group-hover:rotate-6'
                      }`}
                      strokeWidth={2}
                    />
                    <span className="text-[#4b5563]">{item.label}</span>
                  </Link>
                );
              })}
              
              <div className="border-t border-gray-200 pt-3 mt-3 space-y-1">
                <div className="rounded-lg bg-gray-50/70 px-3 py-2 mb-3">
                  <p className="text-[10px] text-gray-500 font-medium">Conectado como</p>
                  <p className="text-xs text-gray-900 font-medium truncate mt-0.5">{userEmail || '—'}</p>
                </div>

                <Link
                  href="/configuracoes"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    pathname === '/configuracoes'
                      ? 'bg-[#c7f9e0]'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <Settings 
                    className={`w-5 h-5 transition-all duration-200 ${
                      pathname === '/configuracoes'
                        ? 'text-[#4b5563]'
                        : 'text-[#4b5563] group-hover:scale-110 group-hover:rotate-12'
                    }`}
                    strokeWidth={2}
                  />
                  <span className="text-[#4b5563]">Configurações</span>
                </Link>

                <Link
                  href="/upgrade"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    pathname === '/upgrade'
                      ? 'bg-[#c7f9e0]'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <TrendingUp 
                    className={`w-5 h-5 transition-all duration-200 ${
                      pathname === '/upgrade'
                        ? 'text-[#4b5563]'
                        : 'text-[#4b5563] group-hover:scale-110 group-hover:translate-y-[-2px]'
                    }`}
                    strokeWidth={2}
                  />
                  <span className="text-[#4b5563]">Fazer Upgrade</span>
                </Link>

                <Link
                  href="/buy-credits"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                    pathname === '/buy-credits'
                      ? 'bg-[#c7f9e0]'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <Coins 
                    className={`w-5 h-5 transition-all duration-200 ${
                      pathname === '/buy-credits'
                        ? 'text-[#4b5563]'
                        : 'text-[#4b5563] group-hover:scale-110 group-hover:rotate-12'
                    }`}
                    strokeWidth={2}
                  />
                  <span className="text-[#4b5563]">Comprar Créditos</span>
                </Link>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 hover:bg-red-50"
                >
                  <LogOut 
                    className="w-5 h-5 text-red-600 transition-all duration-200 group-hover:scale-110 group-hover:translate-x-1"
                    strokeWidth={2}
                  />
                  <span className="text-red-600">Sair da Conta</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Conteúdo Principal - Unificado para Desktop e Mobile */}
      <div className="lg:ml-56 pt-16 lg:pt-0 flex-1 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
        {/* Banner de Assinatura Cancelada */}
        {hasCanceledSubscription && profile.plan !== 'free' && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-center text-sm text-white shadow-md">
            <p className="font-medium">
              ⚠️ Sua assinatura foi cancelada. Você ainda tem acesso ao plano {displayPlan} e seus créditos até esgotá-los.
            </p>
            <Link 
              href="/configuracoes" 
              className="ml-2 font-semibold underline hover:text-white/90"
            >
              Reativar Assinatura
            </Link>
          </div>
        )}

        <main className="relative z-0 py-6 sm:py-8 lg:py-10 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1600px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
