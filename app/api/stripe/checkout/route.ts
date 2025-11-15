import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const PLAN_CONFIGS = {
  pro: {
    name: 'Plano Pro',
    price: 4990, // R$ 49,90 em centavos
    credits: 500,
    bonusCredits: 50, // 10% bônus
    description: '500 créditos + 10% bônus',
    features: [
      'Recarga extra R$0,30 por crédito',
      'Vídeos de até 3 minutos',
      'Uploads avatares ilimitados',
      '4 processamentos simultâneos',
      'Geração de audio ilimitado',
      'Clonar voz ilimitado',
      'Acesso a avatares padrões',
    ],
  },
  premium: {
    name: 'Plano Premium',
    price: 24990, // R$ 249,90 em centavos
    credits: 1500,
    bonusCredits: 150, // 10% bônus
    description: '1500 créditos + 10% bônus',
    features: [
      'Recarga extra R$0,25 por crédito',
      'Vídeos de até 10 minutos',
      'Uploads avatares ilimitados',
      '8 processamentos simultâneos',
      'Processamento prioritário',
      'Geração de audio ilimitado',
      'Clonar voz ilimitado',
      'Acesso a avatares padrões',
    ],
  },
  unlimited: {
    name: 'Plano Unlimited',
    price: 44990, // R$ 449,90 em centavos
    credits: 4000,
    bonusCredits: 400, // 10% bônus
    description: '4000 créditos + 10% bônus',
    features: [
      'Recarga extra R$0,10 por crédito',
      'Vídeos de até 10 minutos',
      'Uploads avatares ilimitados',
      '12 processamentos simultâneos',
      'Processamento prioritário',
      'Geração de audio ilimitado',
      'Clonar voz ilimitado',
      'Acesso a avatares padrões',
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const plan = body.plan || body.planId; // Aceita ambos: plan e planId

    if (!plan || !PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS]) {
      return NextResponse.json({ error: 'Plano inválido' }, { status: 400 });
    }

    const planConfig = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS];

    // Criar sessão de checkout da Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: planConfig.name,
              description: planConfig.description,
            },
            unit_amount: planConfig.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/upgrade?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/upgrade?canceled=true`,
      metadata: {
        userId: user.id,
        userEmail: user.email,
        plan: plan,
        credits: planConfig.credits,
        bonusCredits: planConfig.bonusCredits,
        totalCredits: planConfig.credits + planConfig.bonusCredits,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar checkout session:', error);
    return NextResponse.json(
      { error: 'Erro ao criar sessão de pagamento' },
      { status: 500 }
    );
  }
}
