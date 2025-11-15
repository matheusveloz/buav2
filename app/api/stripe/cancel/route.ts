import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar assinatura ativa do usuário
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_email', user.email)
      .eq('status', 'ativa')
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada' }, { status: 404 });
    }

    // Cancelar assinatura na Stripe (no final do período)
    const canceledSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    console.log('✅ Assinatura marcada para cancelamento:', {
      subscriptionId: canceledSubscription.id,
      cancelAt: new Date(canceledSubscription.cancel_at! * 1000).toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Assinatura será cancelada no final do período atual',
      cancelAt: new Date(canceledSubscription.cancel_at! * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    return NextResponse.json(
      { error: 'Erro ao cancelar assinatura' },
      { status: 500 }
    );
  }
}

// GET - Verificar status da assinatura
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar assinatura do usuário
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_email', user.email)
      .order('data_inicio', { ascending: false })
      .limit(1)
      .single();

    if (!subscription) {
      return NextResponse.json({ hasSubscription: false });
    }

    // Buscar detalhes da assinatura na Stripe
    let stripeSubscription = null;
    if (subscription.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      } catch (err) {
        console.error('Erro ao buscar assinatura na Stripe:', err);
      }
    }

    return NextResponse.json({
      hasSubscription: true,
      subscription: {
        ...subscription,
        cancel_at_period_end: stripeSubscription?.cancel_at_period_end || false,
        current_period_end: stripeSubscription?.current_period_end 
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : subscription.proxima_cobranca,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar assinatura' },
      { status: 500 }
    );
  }
}

