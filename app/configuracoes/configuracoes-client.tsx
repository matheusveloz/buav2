'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import { type Profile } from '@/lib/profile';

type ConfiguracoesClientProps = {
  initialProfile: Profile;
  userEmail: string;
};

type SubscriptionData = {
  status: string;
  nextRenewal: string | null;
  stripeSubscriptionId: string | null;
};

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  premium: 'Premium',
  unlimited: 'Unlimited',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'from-gray-400 to-gray-600',
  pro: 'from-blue-400 to-blue-600',
  premium: 'from-purple-400 to-purple-600',
  unlimited: 'from-yellow-400 to-orange-600',
};

export default function ConfiguracoesClient({ initialProfile, userEmail }: ConfiguracoesClientProps) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  const currentPlan = initialProfile.plan || 'free';
  const planName = PLAN_NAMES[currentPlan] || currentPlan;
  const planColor = PLAN_COLORS[currentPlan] || 'from-gray-400 to-gray-600';

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/subscription');
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Erro ao buscar assinatura:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const result = await Swal.fire({
      title: 'Cancelar Assinatura',
      text: 'Tem certeza que deseja cancelar sua assinatura? Você perderá os benefícios do plano atual.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, cancelar',
      cancelButtonText: 'Não, manter',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3b82f6',
    });

    if (!result.isConfirmed) return;

    setCanceling(true);

    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Erro ao cancelar assinatura');
      }

      await Swal.fire({
        title: 'Assinatura Cancelada',
        text: 'Sua assinatura foi cancelada com sucesso. Você manterá acesso até o final do período pago.',
        icon: 'success',
        confirmButtonText: 'Ok',
        confirmButtonColor: '#10b981',
      });

      fetchSubscription();
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      Swal.fire({
        title: 'Erro',
        text: 'Não foi possível cancelar a assinatura. Tente novamente.',
        icon: 'error',
        confirmButtonText: 'Ok',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      active: { text: 'Ativa', color: 'bg-green-100 text-green-700' },
      canceled: { text: 'Cancelada', color: 'bg-red-100 text-red-700' },
      incomplete: { text: 'Incompleta', color: 'bg-yellow-100 text-yellow-700' },
      past_due: { text: 'Atrasada', color: 'bg-orange-100 text-orange-700' },
      trialing: { text: 'Teste', color: 'bg-blue-100 text-blue-700' },
    };

    const badge = badges[status] || { text: status, color: 'bg-gray-100 text-gray-700' };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <div className="px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-3">
            Configurações da Conta
          </h1>
          <p className="text-xl text-gray-600">
            Gerencie sua assinatura e preferências
          </p>
        </div>

        {/* Plano Atual Card */}
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Seu Plano</h2>
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br ${planColor}`}>
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plano */}
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Plano Atual</p>
              <p className="text-3xl font-bold text-gray-900">{planName}</p>
            </div>

            {/* Créditos */}
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Créditos Disponíveis</p>
              <p className="text-3xl font-bold text-green-600">{initialProfile.credits.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Assinatura Card */}
        {currentPlan !== 'free' && (
          <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-xl p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Assinatura</h2>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            ) : subscription ? (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  {getStatusBadge(subscription.status)}
                </div>

                {/* Próxima Renovação */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-500">Próxima Renovação</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(subscription.nextRenewal)}</p>
                </div>

                {/* ID da Assinatura */}
                {subscription.stripeSubscriptionId && (
                  <div className="flex items-center justify-between py-3">
                    <p className="text-sm font-medium text-gray-500">ID da Assinatura</p>
                    <p className="text-xs font-mono text-gray-600 bg-gray-50 px-3 py-1 rounded">
                      {subscription.stripeSubscriptionId.substring(0, 20)}...
                    </p>
                  </div>
                )}

                {/* Botão Cancelar */}
                {subscription.status === 'active' && (
                  <div className="pt-4">
                    <button
                      onClick={handleCancelSubscription}
                      disabled={canceling}
                      className="w-full md:w-auto px-6 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {canceling ? 'Cancelando...' : 'Cancelar Assinatura'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Nenhuma assinatura ativa encontrada.</p>
            )}
          </div>
        )}

        {/* Upgrade Card (se for free) */}
        {currentPlan === 'free' && (
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl border-2 border-green-200 shadow-xl p-8">
            <div className="text-center">
              <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Faça Upgrade!</h3>
              <p className="text-gray-600 mb-6">
                Desbloqueie recursos ilimitados e leve sua criação de conteúdo para o próximo nível.
              </p>
              <a
                href="/upgrade"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold rounded-xl hover:shadow-lg hover:scale-105 transition-all"
              >
                Ver Planos
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    </AuthenticatedShell>
  );
}
