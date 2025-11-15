export type PlanId = 'free' | 'pro' | 'premium' | 'unlimited';

export type BillingPlan = {
  id: PlanId;
  name: string;
  tagline: string;
  description: string;
  priceLabel: string;
  priceCents: number;
  mode: 'free' | 'paid';
  baseCredits: number;
  bonusCredits: number;
  bonusPercentage: number;
  creditSummary: string;
  featureHighlights: string[];
  extraCreditPrice: number | null;
  videoDurationSeconds: number;
  avatarUploadLimit: number | null;
  simultaneousProcesses: number;
  priorityProcessing: boolean;
  includesDefaultAvatars: boolean;
  highlightLabel?: string;
};

export const BILLING_PLANS: Record<PlanId, BillingPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Teste completo sem pagar nada',
    description: 'Ideal para começar e validar fluxos com 90 créditos iniciais.',
    priceLabel: 'R$ 0,00',
    priceCents: 0,
    mode: 'free',
    baseCredits: 90,
    bonusCredits: 0,
    bonusPercentage: 0,
    creditSummary: '90 créditos iniciais',
    featureHighlights: [
      'Vídeos de até 30 segundos',
      'Máximo 3 uploads de avatares',
      '1 processamento por vez',
      'Acesso a avatares padrões',
    ],
    extraCreditPrice: null,
    videoDurationSeconds: 30,
    avatarUploadLimit: 3,
    simultaneousProcesses: 1,
    priorityProcessing: false,
    includesDefaultAvatars: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para quem produz com frequência',
    description: 'Receba 500 créditos com bônus imediato e acelere seus fluxos.',
    priceLabel: 'R$ 49,90',
    priceCents: 4_990,
    mode: 'paid',
    baseCredits: 500,
    bonusCredits: 50,
    bonusPercentage: 0.1,
    creditSummary: '500 créditos + 10% bônus (550 no total)',
    featureHighlights: [
      'Recarga extra R$0,30 por crédito',
      'Vídeos de até 3 minutos',
      'Uploads de avatares ilimitados',
      '4 processamentos simultâneos',
      'Acesso a avatares padrões',
    ],
    extraCreditPrice: 0.3,
    videoDurationSeconds: 180,
    avatarUploadLimit: null,
    simultaneousProcesses: 4,
    priorityProcessing: false,
    includesDefaultAvatars: true,
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Escala profissional com prioridade',
    description: 'Volume elevado com prioridade de processamento para a sua equipe.',
    priceLabel: 'R$ 249,90',
    priceCents: 24_990,
    mode: 'paid',
    baseCredits: 1500,
    bonusCredits: 150,
    bonusPercentage: 0.1,
    creditSummary: '1500 créditos + 10% bônus (1650 no total)',
    featureHighlights: [
      'Recarga extra R$0,25 por crédito',
      'Vídeos de até 10 minutos',
      'Uploads de avatares ilimitados',
      '8 processamentos simultâneos',
      'Processamento prioritário',
      'Acesso a avatares padrões',
    ],
    extraCreditPrice: 0.25,
    videoDurationSeconds: 600,
    avatarUploadLimit: null,
    simultaneousProcesses: 8,
    priorityProcessing: true,
    includesDefaultAvatars: true,
    highlightLabel: 'Mais popular',
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    tagline: 'Máxima capacidade e prioridade total',
    description: 'Projetos intensos com 4000 créditos e suporte prioritário.',
    priceLabel: 'R$ 449,90',
    priceCents: 44_990,
    mode: 'paid',
    baseCredits: 4000,
    bonusCredits: 400,
    bonusPercentage: 0.1,
    creditSummary: '4000 créditos + 10% bônus (4400 no total)',
    featureHighlights: [
      'Recarga extra R$0,10 por crédito',
      'Vídeos de até 10 minutos',
      'Uploads de avatares ilimitados',
      '12 processamentos simultâneos',
      'Processamento prioritário',
      'Acesso a avatares padrões',
    ],
    extraCreditPrice: 0.1,
    videoDurationSeconds: 600,
    avatarUploadLimit: null,
    simultaneousProcesses: 12,
    priorityProcessing: true,
    includesDefaultAvatars: true,
    highlightLabel: 'Máximo desempenho',
  },
} as const;

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'premium', 'unlimited'];

export const PAID_PLAN_IDS = ['pro', 'premium', 'unlimited'] as const;

export type PaidPlanId = (typeof PAID_PLAN_IDS)[number];

export function isPaidPlanId(planId: string): planId is PaidPlanId {
  return PAID_PLAN_IDS.includes(planId as PaidPlanId);
}

export function isPlanId(planId: string | null | undefined): planId is PlanId {
  if (!planId) {
    return false;
  }

  return PLAN_ORDER.includes(planId as PlanId);
}

