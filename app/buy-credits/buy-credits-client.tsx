'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import { formatCurrencyBRL } from '@/lib/plans';
import type { Profile } from '@/lib/profile';

type PlanId = 'pro' | 'premium' | 'unlimited';

interface BuyCreditsClientProps {
  initialProfile: Profile;
  userEmail: string;
}

const CREDIT_PRICES: Record<PlanId, number> = {
  pro: 0.30,
  premium: 0.25,
  unlimited: 0.10,
};

const PLAN_NAMES: Record<PlanId, string> = {
  pro: 'Pro',
  premium: 'Premium',
  unlimited: 'Unlimited',
};

type FeedbackState = {
  type: 'success' | 'error';
  message: string;
} | null;

export default function BuyCreditsClient({ initialProfile, userEmail }: BuyCreditsClientProps) {
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const alertFromQuery = useMemo<FeedbackState>(() => {
    if (searchParams.get('credits_success')) {
      return {
        type: 'success',
        message: 'Créditos adicionados com sucesso! Eles já estão disponíveis na sua conta.',
      };
    }
    if (searchParams.get('canceled')) {
      return {
        type: 'error',
        message: 'Compra cancelada. Você pode tentar novamente quando quiser.',
      };
    }
    return null;
  }, [searchParams]);

  const planId = initialProfile.plan?.toLowerCase() as PlanId;
  const pricePerCredit = CREDIT_PRICES[planId] || 0.30;
  const totalPrice = credits * pricePerCredit;
  const totalCredits = initialProfile.credits + initialProfile.extraCredits;

  const handleBuyCredits = async () => {
    try {
      setIsLoading(true);
      setFeedback(null);

      const response = await fetch('/api/stripe/buy-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits,
          email: userEmail,
          planId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Erro ao comprar créditos:', err);
      setFeedback({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Erro ao processar pagamento' 
      });
      setIsLoading(false);
    }
  };

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <section className="space-y-8 max-w-3xl mx-auto pb-12">
        {/* Header Minimalista */}
        <div className="text-center px-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Plano {PLAN_NAMES[planId]} • {formatCurrencyBRL(pricePerCredit)}/crédito
          </p>
          <h1 className="mt-3 text-2xl lg:text-3xl font-bold text-gray-900">
            Comprar Créditos Extras
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Seu saldo atual: <span className="font-semibold text-gray-900">{totalCredits.toLocaleString('pt-BR')}</span> créditos
          </p>
        </div>

        {/* Alertas */}
        {alertFromQuery && <AlertBanner state={alertFromQuery.type} message={alertFromQuery.message} />}
        {feedback && !alertFromQuery && <AlertBanner state={feedback.type} message={feedback.message} />}

        {/* Card Principal */}
        <div className="px-4">
          <div className="bg-white rounded-lg border-2 border-gray-200 shadow-lg p-6 lg:p-8">
            {/* Seletor de quantidade */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Quantidade de créditos
              </label>
              
              {/* Botões rápidos */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[100, 500, 1000, 2000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setCredits(amount)}
                    className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      credits === amount
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>

              {/* Input numérico */}
              <input
                type="number"
                value={credits}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 100) {
                    setCredits(value);
                  }
                }}
                min={100}
                step={10}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-center text-xl font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              <p className="text-xs text-gray-500 text-center mt-2">Mínimo: 100 créditos</p>
            </div>

            {/* Resumo */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Quantidade:</span>
                <span className="font-semibold text-gray-900">{credits.toLocaleString('pt-BR')} créditos</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Preço unitário:</span>
                <span className="font-semibold text-gray-900">{formatCurrencyBRL(pricePerCredit)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {formatCurrencyBRL(totalPrice)}
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de compra */}
            <button
              onClick={handleBuyCredits}
              disabled={isLoading || credits < 100}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processando...' : `Comprar por ${formatCurrencyBRL(totalPrice)}`}
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              Pagamento seguro via Stripe
            </p>
          </div>
        </div>

        {/* Informações */}
        <div className="px-4">
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
            <h3 className="font-semibold text-emerald-900 mb-2 text-sm">Informações importantes</h3>
            <ul className="space-y-1 text-xs text-emerald-800">
              <li>• Créditos extras não expiram enquanto sua assinatura estiver ativa</li>
              <li>• Os créditos são adicionados imediatamente após confirmação do pagamento</li>
              <li>• Preço exclusivo do seu plano: {formatCurrencyBRL(pricePerCredit)} por crédito</li>
            </ul>
          </div>
        </div>
      </section>
    </AuthenticatedShell>
  );
}

function AlertBanner({ state, message }: { state: 'success' | 'error'; message: string }) {
  const isSuccess = state === 'success';
  return (
    <div className="px-4">
      <div
        className={`rounded-lg border-2 p-4 ${
          isSuccess
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}
      >
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

