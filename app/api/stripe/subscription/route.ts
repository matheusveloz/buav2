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

// POST - Cancelar assinatura
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Buscar assinatura ativa
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('user_email', user.email)
      .eq('status', 'ativa')
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: 'Nenhuma assinatura ativa encontrada' }, { status: 404 });
    }

    // CANCELAR NA STRIPE IMEDIATAMENTE (não espera fim do período)
    const canceledSubscription = await stripe.subscriptions.cancel(
      subscription.stripe_subscription_id
    );

    console.log('✅ Assinatura cancelada na Stripe:', {
      subscriptionId: canceledSubscription.id,
      canceledAt: new Date(canceledSubscription.canceled_at! * 1000).toISOString(),
    });

    // Atualizar no banco
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelada',
        data_cancelamento: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.stripe_subscription_id);

    // Voltar usuário para free
    await supabaseAdmin
      .from('emails')
      .update({ plano: 'free' })
      .eq('email', user.email);

    return NextResponse.json({
      success: true,
      message: 'Assinatura cancelada com sucesso',
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
export async function GET() {
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

    // Buscar detalhes na Stripe
    let stripeSubscription = null;
    if (subscription.stripe_subscription_id && subscription.status === 'ativa') {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      } catch (err) {
        console.error('Erro ao buscar assinatura na Stripe:', err);
      }
    }

    return NextResponse.json({
      hasSubscription: subscription.status === 'ativa',
      subscription: {
        ...subscription,
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

