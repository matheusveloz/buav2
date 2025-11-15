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

    if (searchParams.get('canceled')) {
      return {
        type: 'error',
        message: 'Checkout cancelado. Você pode tentar novamente quando quiser.',
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
      <section className="space-y-8 px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-500">Assinaturas BUUA</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-4xl">Faça upgrade para desbloquear tudo</h1>
              <p className="mt-3 max-w-2xl text-base text-gray-600">
                Checkout dinâmico via Stripe (modo teste). Os planos pagos liberam créditos automaticamente e ajustam
                seus limites de minutos, uploads e prioridade de processamento.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-inner">
              <p className="text-sm text-emerald-600">Plano atual</p>
              <p className="text-2xl font-semibold text-emerald-800 capitalize">{currentPlanSlug}</p>
              <p className="text-sm text-emerald-700">
                Créditos disponíveis: {initialProfile.credits + initialProfile.extraCredits}
              </p>
            </div>
          </div>
        </div>

        {alertFromQuery && (
          <AlertBanner state={alertFromQuery.type} message={alertFromQuery.message} />
        )}

        {feedback && !alertFromQuery && <AlertBanner state={feedback.type} message={feedback.message} />}

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

        <div className="rounded-3xl border border-gray-200/80 bg-white/80 p-6 shadow-xl backdrop-blur-md sm:p-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Checkout dinâmico</p>
              <h2 className="text-2xl font-bold text-gray-900">Como funciona</h2>
              <p className="mt-2 text-sm text-gray-600">
                Toda compra cria uma sessão instantânea no modo teste da Stripe. Após o pagamento, o webhook confirma o
                evento e credita seu saldo automaticamente.
              </p>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>1. Escolha o plano desejado e clique em “Fazer upgrade”.</p>
              <p>2. Finalize o checkout seguro da Stripe.</p>
              <p>3. Aguarde o processamento do webhook (alguns segundos).</p>
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
  const priceLabel = plan.priceCents > 0 ? formatCurrencyBRL(plan.priceCents / 100) : 'Gratuito';

  return (
    <div
      className={`flex flex-col rounded-3xl border ${theme.border} ${theme.background} p-6 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500">Plano</p>
          <h3 className="text-2xl font-semibold text-gray-900">{plan.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{priceLabel}</p>
          {plan.priceCents > 0 ? (
            <p className="text-xs text-gray-500">Pagamento único</p>
          ) : (
            <p className="text-xs text-gray-500">Já incluído</p>
          )}
        </div>
      </div>

      {plan.badges && (
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.badges.map((badge) => (
            <span key={badge} className={`rounded-full px-3 py-1 text-xs font-medium ${theme.badge}`}>
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/50 bg-white/70 p-4 text-sm text-gray-700 shadow-inner">
        <p className="font-semibold text-gray-900">{plan.includedCredits} créditos</p>
        <p className="text-gray-600">Bônus de {bonus} créditos ({plan.bonusPercentage * 100}%)</p>
        <p className="mt-1 text-gray-500">Total liberado: {totalCredits} créditos</p>
      </div>

      <p className="mt-6 text-sm text-gray-600">{plan.description}</p>

      <ul className="mt-6 space-y-3 text-sm text-gray-700">
        {plan.perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <CheckIcon />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => onCheckout(plan.id)}
          disabled={plan.priceCents === 0 || isCurrent || isLoading}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
            plan.priceCents === 0 || isCurrent
              ? 'cursor-not-allowed bg-gray-200/80 text-gray-500'
              : `${theme.button} ${theme.buttonHover}`
          } ${isLoading ? 'opacity-80' : ''}`}
        >
          {isCurrent ? 'Plano ativo' : plan.priceCents === 0 ? 'Incluído' : isLoading ? 'Abrindo checkout...' : 'Fazer upgrade'}
          {!isCurrent && plan.priceCents > 0 && !isLoading && (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {isCurrent && (
        <p className="mt-3 text-center text-xs text-emerald-600">Você já está neste plano.</p>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AlertBanner({ state, message }: { state: 'success' | 'error'; message: string }) {
  const isSuccess = state === 'success';
  return (
    <div
      className={`rounded-2xl border p-4 text-sm ${
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      {message}
    </div>
  );
}


