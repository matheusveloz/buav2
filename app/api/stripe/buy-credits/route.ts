import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const CREDIT_PRICES: Record<string, number> = {
  pro: 0.30,
  premium: 0.25,
  unlimited: 0.10,
};

const PLAN_NAMES: Record<string, string> = {
  pro: 'Pro',
  premium: 'Premium',
  unlimited: 'Unlimited',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { credits, email, planId } = body;

    if (!credits || !email || !planId) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    if (credits < 100) {
      return NextResponse.json(
        { error: 'Mínimo de 100 créditos' },
        { status: 400 }
      );
    }

    if (!CREDIT_PRICES[planId]) {
      return NextResponse.json(
        { error: 'Plano inválido' },
        { status: 400 }
      );
    }

    // Verificar se o usuário tem permissão
    const supabase = await createSupabaseServerClient();
    const { data: profile } = await supabase
      .from('emails')
      .select('plano')
      .eq('email', email)
      .single();

    if (!profile || profile.plano !== planId) {
      return NextResponse.json(
        { error: 'Plano não corresponde ao usuário' },
        { status: 403 }
      );
    }

    const pricePerCredit = CREDIT_PRICES[planId];
    const totalPrice = credits * pricePerCredit;
    const amountInCents = Math.round(totalPrice * 100);

    // Obter URL base do request
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/buy-credits')[0] || process.env.NEXT_PUBLIC_SITE_URL || 'https://buua.app';

    // Criar sessão de checkout do Stripe (pagamento único)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment', // Pagamento único, não recorrente
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${credits} Créditos Extras - Plano ${PLAN_NAMES[planId]}`,
              description: `Compra de ${credits} créditos extras para sua conta BUUA`,
              images: ['https://buua.com.br/logo.png'],
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      customer_email: email,
      success_url: `${origin}/buy-credits?credits_success=true`,
      cancel_url: `${origin}/buy-credits?canceled=true`,
      payment_intent_data: {
        setup_future_usage: 'off_session', // Ativa verificação do cartão
      },
      metadata: {
        type: 'credits_purchase',
        email: email,
        credits: credits.toString(),
        planId: planId,
        pricePerCredit: pricePerCredit.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Erro ao criar sessão de checkout para créditos:', error);
    return NextResponse.json(
      { error: 'Erro ao processar pagamento' },
      { status: 500 }
    );
  }
}

