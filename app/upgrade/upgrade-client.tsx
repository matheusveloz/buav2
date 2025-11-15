'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import type { Profile } from '@/lib/profile';
import {
  ORDERED_PLAN_IDS,
  PLAN_CONFIGS,
  formatCurrencyBRL,
  getBonusCredits,
  type PlanId,
  type PlanConfig,
} from '@/lib/plans';

type UpgradeClientProps = {
  initialProfile: Profile;
  userEmail: string;
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

const PLAN_THEMES: Record<
  PlanId,
  {
    border: string;
    background: string;
    badge: string;
    button: string;
    buttonHover: string;
  }
> = {
  free: {
    border: 'border-gray-200',
    background: 'bg-white/90',
    badge: 'bg-gray-100 text-gray-700',
    button: 'bg-gray-200 text-gray-600',
    buttonHover: 'hover:bg-gray-200/80',
  },
  pro: {
    border: 'border-purple-200',
    background: 'bg-gradient-to-br from-purple-50/90 to-pink-50/90',
    badge: 'bg-purple-100 text-purple-700',
    button: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    buttonHover: 'hover:from-purple-600 hover:to-pink-600',
  },
  premium: {
    border: 'border-amber-200',
    background: 'bg-gradient-to-br from-amber-50/90 to-yellow-50/90',
    badge: 'bg-amber-100 text-amber-700',
    button: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    buttonHover: 'hover:from-amber-600 hover:to-yellow-600',
  },
  unlimited: {
    border: 'border-emerald-200',
    background: 'bg-gradient-to-br from-emerald-50/90 to-green-50/90',
    badge: 'bg-emerald-100 text-emerald-700',
    button: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
    buttonHover: 'hover:from-emerald-600 hover:to-teal-600',
  },
};

export default function UpgradeClient({ initialProfile, userEmail }: UpgradeClientProps) {
  const searchParams = useSearchParams();
  const currentPlanSlug = useMemo<PlanId>(() => {
    const normalized = initialProfile.plan?.toLowerCase() ?? 'free';
    return (PLAN_CONFIGS[normalized as PlanId]?.id ?? 'free') as PlanId;
  }, [initialProfile.plan]);

  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const alertFromQuery = useMemo<FeedbackState>(() => {
    if (searchParams.get('success')) {
      return {
        type: 'success',
        message:
          'Pagamento recebido! Os créditos serão liberados assim que o webhook da Stripe terminar o processamento (modo teste).',
      };
    }

    return null;
  }, [searchParams]);

  const orderedPlans = ORDERED_PLAN_IDS.map((id) => PLAN_CONFIGS[id]);

  const handleCheckout = async (planId: PlanId) => {
    if (planId === currentPlanSlug) {
      return;
    }

    setLoadingPlan(planId);
    setFeedback(null);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Não foi possível iniciar o checkout.');
      }

      if (typeof data?.url === 'string') {
        window.location.href = data.url;
        return;
      }

      throw new Error('Stripe não retornou a URL do checkout.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado ao iniciar checkout.';
      setFeedback({ type: 'error', message });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <section className="space-y-10 px-4 sm:px-6 lg:px-8">
        {/* Header Minimalista */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            Seu plano atual: <span className="text-gray-900 capitalize font-semibold">{currentPlanSlug}</span>
          </p>
          <h1 className="mt-3 text-4xl font-bold text-gray-900 sm:text-5xl">
            Faça upgrade para desbloquear mais recursos!
          </h1>
        </div>

        {alertFromQuery && (
          <AlertBanner state={alertFromQuery.type} message={alertFromQuery.message} />
        )}

        {feedback && !alertFromQuery && <AlertBanner state={feedback.type} message={feedback.message} />}

        {/* Cards de Planos */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {orderedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === currentPlanSlug}
              isLoading={loadingPlan === plan.id}
              onCheckout={handleCheckout}
            />
          ))}
        </div>

        {/* Tabela de Comparação de Planos */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Comparação de Planos
          </h2>
          
          <div className="overflow-x-auto rounded-2xl border-2 border-gray-200 shadow-xl bg-white">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50">
                    Recursos
                  </th>
                  {orderedPlans.map((plan) => (
                    <th key={plan.id} className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Créditos */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                    Créditos iniciais
                  </td>
                  {orderedPlans.map((plan) => {
                    const bonus = getBonusCredits(plan);
                    return (
                      <td key={plan.id} className="px-6 py-4 text-center text-sm text-gray-700 font-semibold">
                        {(plan.includedCredits + bonus).toLocaleString('pt-BR')}
                      </td>
                    );
                  })}
                </tr>

                {/* Bônus */}
                <tr className="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-gray-50">
                    Bônus
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center text-sm text-gray-600">
                      {plan.bonusPercentage > 0 ? `+${plan.bonusPercentage * 100}%` : '—'}
                    </td>
                  ))}
                </tr>

                {/* Duração de vídeo */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                    Duração máxima de vídeo
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center text-sm text-gray-700">
                      {plan.videoLimitMinutes < 1 
                        ? `${Math.round(plan.videoLimitMinutes * 60)} segundos`
                        : `${plan.videoLimitMinutes} minuto${plan.videoLimitMinutes > 1 ? 's' : ''}`
                      }
                    </td>
                  ))}
                </tr>

                {/* Uploads de avatares */}
                <tr className="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-gray-50">
                    Uploads de avatares
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center text-sm text-gray-700">
                      {plan.avatarUploadsLimit === null ? 'Ilimitado' : `Máximo ${plan.avatarUploadsLimit}`}
                    </td>
                  ))}
                </tr>

                {/* Processamentos simultâneos */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                    Processamentos simultâneos
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center text-sm text-gray-700 font-semibold">
                      {plan.concurrentProcesses}
                    </td>
                  ))}
                </tr>

                {/* Processamento prioritário */}
                <tr className="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-gray-50">
                    Processamento prioritário
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center">
                      {plan.priorityProcessing ? (
                        <svg className="w-5 h-5 text-emerald-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Recarga extra */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white">
                    Recarga extra por crédito
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-4 text-center text-sm text-gray-700">
                      {plan.extraCreditPrice > 0 
                        ? formatCurrencyBRL(plan.extraCreditPrice)
                        : '—'
                      }
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </AuthenticatedShell>
  );
}

function PlanCard({
  plan,
  isCurrent,
  isLoading,
  onCheckout,
}: {
  plan: PlanConfig;
  isCurrent: boolean;
  isLoading: boolean;
  onCheckout: (planId: PlanId) => void;
}) {
  const theme = PLAN_THEMES[plan.id];
  const bonus = getBonusCredits(plan);
  const totalCredits = plan.includedCredits + bonus;
  const priceLabel = plan.priceCents > 0 ? formatCurrencyBRL(plan.priceCents / 100) : 'Gratuito';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 ${
        isCurrent ? 'border-emerald-500 shadow-lg shadow-emerald-100' : theme.border
      } bg-white p-6 transition hover:shadow-xl`}
    >
      {/* Badge de Plano Ativo */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Plano Ativo
          </span>
        </div>
      )}

      {/* Cabeçalho do Card */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
        <div className="mt-3">
          <span className="text-4xl font-bold text-gray-900">{priceLabel}</span>
          {plan.priceCents > 0 && <span className="text-sm text-gray-500 ml-1">/mês</span>}
        </div>
        <p className="mt-2 text-sm font-medium text-gray-600">
          {totalCredits.toLocaleString('pt-BR')} créditos
        </p>
      </div>

      {/* Divisor */}
      <div className="my-6 border-t border-gray-200"></div>

      {/* Lista de Recursos */}
      <ul className="flex-1 space-y-3 text-sm text-gray-700">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5">
            <CheckIcon />
            <span className="leading-relaxed">{perk}</span>
          </li>
        ))}
      </ul>

      {/* Botão de Ação */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => onCheckout(plan.id)}
          disabled={plan.priceCents === 0 || isCurrent || isLoading}
          className={`w-full rounded-lg px-5 py-3 text-sm font-semibold transition ${
            plan.priceCents === 0 || isCurrent
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : `${theme.button} ${theme.buttonHover} shadow-sm`
          } ${isLoading ? 'opacity-70' : ''}`}
        >
          {isCurrent 
            ? '✓ Plano Atual' 
            : plan.priceCents === 0 
            ? 'Gratuito' 
            : isLoading 
            ? 'Carregando...' 
            : 'Selecionar Plano'}
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function AlertBanner({ state, message }: { state: 'success' | 'error'; message: string }) {
  const isSuccess = state === 'success';
  return (
    <div
      className={`rounded-xl border p-4 text-sm font-medium ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <div className="flex items-center gap-3">
        {isSuccess ? (
          <svg className="h-5 w-5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}


