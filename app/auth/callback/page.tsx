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

    const redirectHome = async () => {
      console.log('🔄 callback: redirectHome iniciado');
      cleanupUrl();
      
      // Verificar se a conta está bloqueada antes de redirecionar
      try {
        console.log('🔍 callback: Buscando sessão...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ callback: Erro ao buscar sessão:', sessionError);
        }
        
        console.log('📧 callback: Email da sessão:', session?.user?.email || 'SEM EMAIL');
        
        if (session?.user?.email) {
          console.log('🔍 callback: Buscando perfil do usuário...');
          const { data: profile, error } = await supabase
            .from('emails')
            .select('ativo, creditos, plano')
            .eq('email', session.user.email)
            .maybeSingle();
          
          console.log('📊 callback: Perfil obtido:', { 
            ativo: profile?.ativo, 
            temPerfil: !!profile,
            error: error?.message 
          });
          
          // Se o usuário não existe, criar com 90 créditos (primeiro acesso)
          if (!profile && !error) {
            console.log('🆕 Primeiro acesso detectado! Criando usuário com 90 créditos...');
            console.log('📊 Dados a inserir:', {
              email: session.user.email,
              plano: 'free',
              creditos: 90,
              creditos_extras: 0,
              ativo: 1
            });
            
            const { data: insertData, error: insertError } = await supabase
              .from('emails')
              .insert({
                email: session.user.email,
                plano: 'free',
                creditos: 90, // 90 créditos apenas no primeiro acesso
                creditos_extras: 0,
                ativo: 1
              })
              .select();
            
            if (insertError) {
              console.error('❌ Erro ao criar usuário:', insertError);
              console.error('❌ Código do erro:', insertError.code);
              console.error('❌ Detalhes:', insertError.message);
              
              // Se for erro de conflito (usuário já existe), continuar normalmente
              if (insertError.code !== '23505') {
                redirectWithError('Erro ao criar perfil de usuário');
                return;
              } else {
                console.warn('⚠️ Usuário já existia no banco! Buscando dados...');
                // Buscar os dados do usuário que já existe
                const { data: existingProfile } = await supabase
                  .from('emails')
                  .select('creditos, creditos_extras, plano')
                  .eq('email', session.user.email)
                  .single();
                console.log('📊 Perfil existente:', existingProfile);
              }
            } else {
              console.log('✅ Usuário criado com sucesso!');
              console.log('📊 Dados inseridos:', insertData);
              // Marcar como primeiro acesso no sessionStorage
              sessionStorage.setItem('isFirstTimeUser', 'true');
            }
          } else if (profile?.ativo === 0) {
            console.log('🔒 Conta bloqueada detectada no callback, redirecionando para /conta-bloqueada');
            scheduleRedirect('/conta-bloqueada', HOME_DELAY_MS);
            return;
          } else if (profile?.ativo === 1) {
            console.log('✅ Conta ativa, redirecionando para /home');
          }
        } else {
          console.warn('⚠️ callback: Sessão sem email');
        }
      } catch (error) {
        console.error('❌ callback: Erro ao verificar status da conta:', error);
      }
      
      console.log('✅ callback: Redirecionando para /home');
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
          await redirectHome();
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

          await redirectHome();
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

          await redirectHome();
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

