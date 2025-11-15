export type PlanId = 'free' | 'pro' | 'premium' | 'unlimited';

export type PlanConfig = {
  id: PlanId;
  name: string;
  description: string;
  priceCents: number;
  currency: 'brl';
  includedCredits: number;
  bonusPercentage: number;
  extraCreditPrice: number;
  videoLimitMinutes: number;
  avatarUploadsLimit: number | null;
  concurrentProcesses: number;
  priorityProcessing: boolean;
  perks: string[];
  badges?: string[];
  highlight?: boolean;
};

export const FREE_INITIAL_CREDITS = 150;

const PERCENTAGE_BONUS = 0.1;

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Ideal para iniciar seus testes com o BUUA.',
    priceCents: 0,
    currency: 'brl',
    includedCredits: FREE_INITIAL_CREDITS,
    bonusPercentage: 0,
    extraCreditPrice: 0,
    videoLimitMinutes: 0.5,
    avatarUploadsLimit: 3,
    concurrentProcesses: 1,
    priorityProcessing: false,
    perks: [
      '150 créditos iniciais',
      'Vídeos de até 30 segundos',
      'Máximo de 3 uploads de avatares',
      '1 processamento por vez',
      'Gerar até 3 áudios por dia',
      'Acesso a avatares padrões',
    ],
    badges: ['Plano atual da maioria'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Perfeito para criadores que precisam de escala moderada.',
    priceCents: 4990,
    currency: 'brl',
    includedCredits: 500,
    bonusPercentage: PERCENTAGE_BONUS,
    extraCreditPrice: 0.3,
    videoLimitMinutes: 3,
    avatarUploadsLimit: null,
    concurrentProcesses: 4,
    priorityProcessing: false,
    perks: [
      '500 créditos + 10% bônus (550 no total)',
      'Recarga extra R$0,30 por crédito',
      'Vídeos de até 3 minutos',
      'Uploads de avatares ilimitados',
      '4 processamentos simultâneos',
      'Geração de audio ilimitado',
      'Clonar voz ilimitado',
      'Acesso a avatares padrões',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    description: 'Para equipes e produtores que exigem prioridade.',
    priceCents: 24990,
    currency: 'brl',
    includedCredits: 1500,
    bonusPercentage: PERCENTAGE_BONUS,
    extraCreditPrice: 0.25,
    videoLimitMinutes: 10,
    avatarUploadsLimit: null,
    concurrentProcesses: 8,
    priorityProcessing: true,
    perks: [
      '1500 créditos + 10% bônus (1650 no total)',
      'Recarga extra R$0,25 por crédito',
      'Vídeos de até 10 minutos',
      'Uploads de avatares ilimitados',
      '8 processamentos simultâneos',
      'Processamento prioritário',
      'Geração de audio ilimitado',
      'Clonar voz ilimitado',
      'Acesso a avatares padrões',
    ],
    badges: ['Mais Popular'],
    highlight: true,
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Máximo de créditos e processamento para operações críticas.',
    priceCents: 44990,
    currency: 'brl',
    includedCredits: 4000,
    bonusPercentage: PERCENTAGE_BONUS,
    extraCreditPrice: 0.1,
    videoLimitMinutes: 10,
    avatarUploadsLimit: null,
    concurrentProcesses: 12,
    priorityProcessing: true,
    perks: [
      '4000 créditos + 10% bônus (4400 no total)',
      'Recarga extra R$0,10 por crédito',
      'Vídeos de até 10 minutos',
      'Uploads de avatares ilimitados',
      '12 processamentos simultâneos',
      'Processamento prioritário',
      'Geração de audio ilimitado',
      'Clonar voz ilimitado',
      'Acesso a avatares padrões',
    ],
    badges: ['Melhor desempenho'],
  },
};

export const ORDERED_PLAN_IDS: PlanId[] = ['free', 'pro', 'premium', 'unlimited'];
export const PAID_PLAN_IDS: PlanId[] = ORDERED_PLAN_IDS.filter((plan) => plan !== 'free');

export function getPlanConfig(planId: string | null | undefined): PlanConfig | null {
  if (!planId) {
    return null;
  }
  return PLAN_CONFIGS[planId as PlanId] ?? null;
}

export function getBonusCredits(plan: PlanConfig): number {
  if (!plan.bonusPercentage) {
    return 0;
  }
  return Math.round(plan.includedCredits * plan.bonusPercentage);
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}


