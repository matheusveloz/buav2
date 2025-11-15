'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Profile {
  email: string;
  plano: string;
  creditos: number;
  creditos_extras: number;
}

interface Subscription {
  plano: string;
  status: string;
  current_period_end: string;
  preco_mensal: number;
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  premium: 'Premium',
  unlimited: 'Unlimited',
};

export default function ConfiguracoesClient({
  initialProfile,
}: {
  initialProfile: Profile | null;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const res = await fetch('/api/stripe/subscription');
      const data = await res.json();

      if (data.hasSubscription) {
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Erro ao carregar assinatura:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura? Você voltará para o plano Free.')) {
      return;
    }

    setCanceling(true);

    try {
      const res = await fetch('/api/stripe/subscription', {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        alert('Assinatura cancelada com sucesso. Você voltou para o plano Free.');
        
        // Atualizar estado local
        setProfile((prev) => prev ? { ...prev, plano: 'free' } : null);
        setSubscription(null);
        
        // Recarregar página
        router.refresh();
      } else {
        alert(data.error || 'Erro ao cancelar assinatura');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao cancelar assinatura');
    } finally {
      setCanceling(false);
    }
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  const totalCredits = profile.creditos + profile.creditos_extras;
  const planName = PLAN_NAMES[profile.plano] || profile.plano;
  const isPaidPlan = profile.plano !== 'free';

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Configurações da Conta</h1>

      {/* Card Principal */}
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
        {/* Plano Atual */}
        <div className="border-b pb-4">
          <h2 className="text-sm text-gray-500 mb-1">Seu Plano</h2>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">{planName}</span>
            {isPaidPlan && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Ativo
              </span>
            )}
          </div>
        </div>

        {/* Créditos Disponíveis */}
        <div className="border-b pb-4">
          <h2 className="text-sm text-gray-500 mb-1">Créditos Disponíveis</h2>
          <div className="text-2xl font-bold text-blue-600">{totalCredits.toLocaleString('pt-BR')}</div>
          <div className="text-sm text-gray-500 mt-1">
            {profile.creditos} créditos mensais + {profile.creditos_extras} extras
          </div>
        </div>

        {/* Informações da Assinatura */}
        {isPaidPlan && (
          <>
            <div className="border-b pb-4">
              <h2 className="text-sm text-gray-500 mb-1">Status da Assinatura</h2>
              {loading ? (
                <div className="text-gray-400">Carregando...</div>
              ) : subscription ? (
                <div className="space-y-1">
                  <div className="text-lg font-semibold capitalize">
                    {subscription.status === 'ativa' ? '✅ Ativa' : '⚠️ ' + subscription.status}
                  </div>
                  <div className="text-sm text-gray-600">
                    R$ {subscription.preco_mensal.toFixed(2).replace('.', ',')} por mês
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">Sem assinatura ativa</div>
              )}
            </div>

            {subscription && subscription.status === 'ativa' && (
              <div className="border-b pb-4">
                <h2 className="text-sm text-gray-500 mb-1">Data da Próxima Renovação</h2>
                <div className="text-lg font-medium">
                  {new Date(subscription.current_period_end).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Seus créditos serão renovados nesta data
                </div>
              </div>
            )}

            {/* Botão Cancelar */}
            {subscription && subscription.status === 'ativa' && (
              <div className="pt-2">
                <button
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="text-sm text-gray-500 hover:text-red-600 underline transition-colors disabled:opacity-50"
                >
                  {canceling ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Plano Free */}
        {!isPaidPlan && (
          <div className="pt-2">
            <button
              onClick={() => router.push('/upgrade')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Fazer Upgrade
            </button>
          </div>
        )}
      </div>

      {/* Informações Adicionais */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">📌 Informações Importantes:</p>
        <ul className="space-y-1 list-disc list-inside">
          {isPaidPlan ? (
            <>
              <li>Seus créditos são renovados automaticamente todo mês</li>
              <li>Créditos não expiram enquanto sua assinatura estiver ativa</li>
              <li>Ao fazer upgrade, os créditos são somados (não substituídos)</li>
              <li>O cancelamento é efetivo imediatamente e você volta para o plano Free</li>
            </>
          ) : (
            <>
              <li>O plano Free inclui 150 créditos iniciais</li>
              <li>Faça upgrade para ter acesso a mais recursos</li>
              <li>Vídeos de até 30 segundos</li>
              <li>Até 3 audios por dia</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

