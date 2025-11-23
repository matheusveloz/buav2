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
    isPopular?: boolean;
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
    border: 'border-blue-200',
    background: 'bg-gradient-to-br from-blue-50/90 to-cyan-50/90',
    badge: 'bg-blue-100 text-blue-700',
    button: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white',
    buttonHover: 'hover:from-blue-600 hover:to-cyan-600',
  },
  premium: {
    border: 'border-purple-200',
    background: 'bg-gradient-to-br from-purple-50/90 to-pink-50/90',
    badge: 'bg-purple-100 text-purple-700',
    button: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    buttonHover: 'hover:from-purple-600 hover:to-pink-600',
    isPopular: true,
  },
  unlimited: {
    border: 'border-amber-400',
    background: 'bg-gradient-to-br from-amber-50/90 to-yellow-50/90',
    badge: 'bg-amber-100 text-amber-700',
    button: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white',
    buttonHover: 'hover:from-amber-600 hover:to-yellow-600',
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
        message: 'Pagamento concluído! Seu plano foi atualizado e os créditos já estão disponíveis.',
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
      <section className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Header Minimalista */}
        <div className="text-center px-4 lg:px-0">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Seu plano atual: <span className="text-gray-900 capitalize">{currentPlanSlug}</span>
          </p>
          <h1 className="mt-3 text-2xl lg:text-3xl font-bold text-gray-900">
            Escolha seu Plano
          </h1>
        </div>

        {alertFromQuery && (
          <AlertBanner state={alertFromQuery.type} message={alertFromQuery.message} />
        )}

        {feedback && !alertFromQuery && <AlertBanner state={feedback.type} message={feedback.message} />}

        {/* Cards de Planos */}
        <div className="px-4 lg:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-5 xl:gap-4">
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
        </div>

        {/* Tabela de Comparação de Planos */}
        <div className="mt-8 md:mt-12 lg:mt-16">
          <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 text-center mb-4 md:mb-5 lg:mb-8 px-4">
            Comparação de Planos
          </h2>
          
          {/* Aviso de scroll em mobile */}
          <p className="text-center text-xs md:hidden text-gray-500 mb-3 font-medium px-4">
            ← Deslize para ver todos os planos →
          </p>
          
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle px-4 lg:px-0">
              <div className="overflow-hidden rounded-lg border-2 border-gray-200 shadow-xl bg-white">
                <table className="min-w-full w-full table-auto">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-900 sticky left-0 bg-gray-50 sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Recursos
                  </th>
                  {orderedPlans.map((plan) => (
                    <th key={plan.id} className="px-2 py-2 text-center text-[11px] font-semibold text-gray-900 sm:px-3 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Créditos */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-900 sticky left-0 bg-white sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Créditos iniciais
                  </td>
                  {orderedPlans.map((plan) => {
                    const bonus = getBonusCredits(plan);
                    return (
                      <td key={plan.id} className="px-2 py-2 text-center text-[11px] text-gray-700 font-semibold sm:px-3 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                        {(plan.includedCredits + bonus).toLocaleString('pt-BR')}
                      </td>
                    );
                  })}
                </tr>

                {/* Bônus */}
                <tr className="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-900 sticky left-0 bg-gray-50 sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Bônus
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-2 py-2 text-center text-[11px] text-gray-600 sm:px-3 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                      {plan.bonusPercentage > 0 ? `+${plan.bonusPercentage * 100}%` : '—'}
                    </td>
                  ))}
                </tr>

                {/* Duração de vídeo */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-900 sticky left-0 bg-white sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Duração máxima de vídeo
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-2 py-2 text-center text-[11px] text-gray-700 sm:px-3 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                      {plan.videoLimitMinutes < 1 
                        ? `${Math.round(plan.videoLimitMinutes * 60)} seg`
                        : `${plan.videoLimitMinutes} min`
                      }
                    </td>
                  ))}
                </tr>

                {/* Uploads de avatares */}
                <tr className="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-900 sticky left-0 bg-gray-50 sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Uploads de avatares
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-2 py-2 text-center text-[11px] text-gray-700 sm:px-3 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                      {plan.avatarUploadsLimit === null ? 'Ilimitado' : `Máx ${plan.avatarUploadsLimit}`}
                    </td>
                  ))}
                </tr>

                {/* Processamentos simultâneos */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-900 sticky left-0 bg-white sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Processamentos simultâneos
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-2 py-2 text-center text-[11px] text-gray-700 font-semibold sm:px-3 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                      {plan.concurrentProcesses}
                    </td>
                  ))}
                </tr>

                {/* Processamento prioritário */}
                <tr className="bg-gray-50 hover:bg-gray-100 transition-colors">
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-900 sticky left-0 bg-gray-50 sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Processamento prioritário
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-2 py-2 text-center sm:px-3 sm:py-3 lg:px-6 lg:py-4">
                      {plan.priorityProcessing ? (
                        <svg className="w-3.5 h-3.5 text-emerald-500 mx-auto sm:w-4 sm:h-4 lg:w-5 lg:h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-300 mx-auto sm:w-4 sm:h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Recarga extra */}
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-[11px] font-medium text-gray-900 sticky left-0 bg-white sm:px-4 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
                    Recarga extra por crédito
                  </td>
                  {orderedPlans.map((plan) => (
                    <td key={plan.id} className="px-2 py-2 text-center text-[11px] text-gray-700 sm:px-3 sm:py-3 lg:px-6 lg:py-4 sm:text-xs lg:text-sm">
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
  
  // Formatação customizada do preço
  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Gratuito';
    const value = (cents / 100).toFixed(2).replace('.', ',');
    return (
      <>
        <span className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">R$</span>
        <span className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">&nbsp;</span>
        <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">{value}</span>
      </>
    );
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 ${
        isCurrent ? 'border-emerald-500 shadow-xl shadow-emerald-100/50' : theme.border
      } bg-white p-6 lg:p-5 transition-all hover:shadow-2xl`}
    >
      {/* Badge "Mais Popular" ou "Plano Ativo" */}
      {theme.isPopular && !isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg">
            ⭐ Mais Popular
          </span>
        </div>
      )}

      {isCurrent && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
            ✓ Plano Ativo
          </span>
        </div>
      )}

      {/* Cabeçalho do Card */}
      <div className="text-center space-y-3 pt-2">
        <h3 className="text-xl lg:text-lg font-bold text-gray-900">{plan.name}</h3>
        
        <div className="py-2">
          {plan.priceCents > 0 ? (
            <div className="space-y-1">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-xl font-bold text-gray-900">R$</span>
                <span className="text-4xl lg:text-3xl font-bold text-gray-900">
                  {(plan.priceCents / 100).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <p className="text-sm text-gray-500">por mês</p>
            </div>
          ) : (
            <p className="text-3xl font-bold text-gray-900">Gratuito</p>
          )}
        </div>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100">
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-semibold text-gray-700">
            {totalCredits.toLocaleString('pt-BR')} créditos
          </span>
        </div>
      </div>

      {/* Divisor */}
      <div className="my-5 lg:my-4 border-t border-gray-200"></div>

      {/* Lista de Recursos */}
      <ul className="flex-1 space-y-3 lg:space-y-2">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5">
            <svg className="w-5 h-5 lg:w-4 lg:h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm lg:text-xs text-gray-700 leading-relaxed">{perk}</span>
          </li>
        ))}
      </ul>

      {/* Botão de Ação */}
      <div className="mt-6 lg:mt-5">
        <button
          type="button"
          onClick={() => onCheckout(plan.id)}
          disabled={plan.priceCents === 0 || isCurrent || isLoading}
          className={`w-full rounded-xl px-6 py-4 lg:px-4 lg:py-3 text-base lg:text-sm font-bold transition-all ${
            plan.priceCents === 0 || isCurrent
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : `${theme.button} ${theme.buttonHover} shadow-lg hover:shadow-xl transform hover:scale-105`
          } ${isLoading ? 'opacity-70' : ''}`}
        >
          {isCurrent 
            ? '✓ Seu Plano Atual' 
            : plan.priceCents === 0 
            ? 'Plano Gratuito' 
            : isLoading 
            ? 'Processando...' 
            : 'Escolher Este Plano'}
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="mt-[3px] md:mt-[2px] h-4 w-4 md:h-3 md:w-3 lg:h-4 lg:w-4 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function AlertBanner({ state, message }: { state: 'success' | 'error'; message: string }) {
  const isSuccess = state === 'success';
  return (
    <div
      className={`rounded-lg sm:rounded-xl border p-3 sm:p-4 text-xs sm:text-sm font-medium ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
        {isSuccess ? (
          <svg className="h-5 w-5 sm:h-5 sm:w-5 text-emerald-500 flex-shrink-0 mt-0.5 sm:mt-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="h-5 w-5 sm:h-5 sm:w-5 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
        <span className="leading-relaxed">{message}</span>
      </div>
    </div>
  );
}


