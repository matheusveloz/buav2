'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { BILLING_PLANS, type PlanId } from '@/lib/billing-plans';
import Swal from 'sweetalert2';

type Subscription = {
  stripe_subscription_id: string;
  status: string;
  plano: string;
  proxima_cobranca: string | null;
  data_cancelamento: string | null;
  data_inicio: string;
};

type ConfiguracoesClientProps = {
  userEmail: string;
};

export default function ConfiguracoesClient({ userEmail }: ConfiguracoesClientProps) {
  const [profile, setProfile] = useState<{
    plano: string;
    creditos: number;
    creditos_extras: number;
  } | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const loadUserData = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar perfil do usuário
      const { data: profileData } = await supabase
        .from('emails')
        .select('plano, creditos, creditos_extras')
        .eq('email', userEmail)
        .single();

      setProfile(profileData);

      // Buscar assinatura
      const response = await fetch('/api/stripe/subscription');
      const subData = await response.json();
      
      if (subData.hasSubscription || subData.subscription) {
        setSubscription(subData.subscription);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleCancelSubscription = async () => {
    const result = await Swal.fire({
      title: 'Cancelar Assinatura',
      text: 'Tem certeza que deseja cancelar sua assinatura? Você manterá seu plano e créditos atuais, mas não haverá renovação automática.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Não, manter',
      reverseButtons: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    setCanceling(true);
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        await Swal.fire({
          title: 'Assinatura Cancelada',
          text: 'Sua assinatura foi cancelada. Você continuará com acesso ao seu plano e créditos até acabarem. Não haverá renovação automática.',
          icon: 'success',
          confirmButtonColor: '#22c55e',
        });
        
        // Recarregar dados
        await loadUserData();
      } else {
        throw new Error(data.error || 'Erro ao cancelar assinatura');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível cancelar a assinatura. Tente novamente.';
      await Swal.fire({
        title: 'Erro',
        text: errorMessage,
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivateSubscription = async () => {
    const result = await Swal.fire({
      title: 'Reativar Assinatura',
      text: `Deseja reativar sua assinatura do plano ${profile?.plano}? Você será redirecionado para o checkout.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, reativar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) {
      return;
    }

    setReactivating(true);
    try {
      // Criar checkout para reativar
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: profile?.plano || 'pro' }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirecionar para checkout
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Erro ao criar checkout');
      }
    } catch (error) {
      setReactivating(false);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível reativar a assinatura. Tente novamente.';
      await Swal.fire({
        title: 'Erro',
        text: errorMessage,
        icon: 'error',
        confirmButtonColor: '#ef4444',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-green-500"></div>
          <p className="mt-4 text-gray-600">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  const plan = BILLING_PLANS[profile?.plano as PlanId] || BILLING_PLANS.free;
  const totalCredits = (profile?.creditos || 0) + (profile?.creditos_extras || 0);
  const isActiveSubscription = subscription?.status === 'ativa';
  const isCanceledSubscription = subscription?.status === 'cancelada';
  const isPaidPlan = profile?.plano !== 'free';

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-8 text-3xl font-bold text-gray-900">Configurações</h1>

      {/* Warning Banner para assinatura cancelada */}
      {isCanceledSubscription && (
        <div className="mb-6 rounded-xl border-2 border-orange-200 bg-orange-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900">Assinatura Cancelada</h3>
              <p className="mt-1 text-sm text-orange-700">
                Sua assinatura foi cancelada em{' '}
                {subscription.data_cancelamento
                  ? new Date(subscription.data_cancelamento).toLocaleDateString('pt-BR')
                  : 'data desconhecida'}
                . Você mantém acesso ao seu plano e créditos atuais até acabarem.
              </p>
              <button
                onClick={handleReactivateSubscription}
                disabled={reactivating}
                className="mt-3 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {reactivating ? 'Processando...' : 'Reativar Assinatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Seu Plano */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Seu Plano</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-gray-900">{plan.name}</span>
                {plan.highlightLabel && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    {plan.highlightLabel}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">{plan.tagline}</p>
              <p className="mt-3 text-lg font-semibold text-gray-900">{plan.priceLabel}/mês</p>
            </div>
            {profile?.plano === 'free' && (
              <a
                href="/upgrade"
                className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white transition hover:bg-green-700"
              >
                Fazer Upgrade
              </a>
            )}
          </div>
        </div>

        {/* Créditos Disponíveis */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Créditos Disponíveis</h2>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
              <svg
                className="h-8 w-8 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {new Intl.NumberFormat('pt-BR').format(totalCredits)}
              </p>
              <p className="text-sm text-gray-600">
                {profile?.creditos || 0} créditos do plano + {profile?.creditos_extras || 0} extras
              </p>
            </div>
          </div>
          {isPaidPlan && (
            <a
              href="/buy-credits"
              className="mt-4 inline-block text-sm font-medium text-green-600 hover:text-green-700"
            >
              Comprar mais créditos →
            </a>
          )}
        </div>

        {/* Status da Assinatura e Próxima Renovação */}
        {isPaidPlan && isActiveSubscription && subscription && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Status da Assinatura</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  <span className="h-2 w-2 rounded-full bg-green-500"></span>
                  Ativa
                </span>
              </div>

              {subscription.proxima_cobranca && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Próxima Renovação</span>
                  <span className="text-sm font-medium text-gray-900">
                    {new Date(subscription.proxima_cobranca).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Data de Início</span>
                <span className="text-sm font-medium text-gray-900">
                  {new Date(subscription.data_inicio).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="text-sm text-gray-500 transition hover:text-red-600 disabled:opacity-50"
              >
                {canceling ? 'Cancelando...' : 'Cancelar assinatura'}
              </button>
            </div>
          </div>
        )}

        {/* Informações do Plano */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Recursos do Plano</h2>
          <ul className="space-y-3">
            {plan.featureHighlights.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Informações da Conta */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Informações da Conta</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">E-mail</span>
              <span className="text-sm font-medium text-gray-900">{userEmail}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

