import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Assinatura ausente' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('⚠️ Erro na verificação do webhook:', err);
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  // Handle diferentes eventos de assinatura
  switch (event.type) {
    case 'checkout.session.completed': {
      // Quando a primeira assinatura é criada
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('💰 Checkout de assinatura concluído:', {
        sessionId: session.id,
        subscriptionId: session.subscription,
        metadata: session.metadata,
      });

      const { userEmail, plan, totalCredits } = session.metadata || {};

      if (!userEmail || !plan || !totalCredits) {
        console.error('❌ Metadata incompleto no webhook:', session.metadata);
        return NextResponse.json({ error: 'Metadata incompleto' }, { status: 400 });
      }

      // Buscar usuário atual
      const { data: currentUser, error: fetchError } = await supabaseAdmin
        .from('emails')
        .select('creditos, creditos_extras, plano')
        .eq('email', userEmail)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar usuário:', fetchError);
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      // Adicionar créditos da primeira cobrança
      const newCredits = (currentUser.creditos || 0) + parseInt(totalCredits);

      // Atualizar plano e adicionar subscription_id
      const { error: updateError } = await supabaseAdmin
        .from('emails')
        .update({
          plano: plan,
          creditos: newCredits,
        })
        .eq('email', userEmail);

      if (updateError) {
        console.error('❌ Erro ao atualizar usuário:', updateError);
        return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
      }

      // Criar/atualizar registro de assinatura
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_email: userEmail,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: session.customer as string,
          plano: plan,
          status: 'ativa',
          preco_mensal: session.amount_total ? session.amount_total / 100 : 0,
          data_inicio: new Date().toISOString(),
          proxima_cobranca: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 dias
        }, {
          onConflict: 'stripe_subscription_id',
        });

      if (subError) {
        console.error('⚠️ Erro ao registrar assinatura:', subError);
      }

      // Registrar transação
      await supabaseAdmin.from('transactions').insert({
        user_email: userEmail,
        type: 'upgrade',
        plan: plan,
        credits_added: parseInt(totalCredits),
        amount: session.amount_total ? session.amount_total / 100 : 0,
        stripe_session_id: session.id,
        status: 'completed',
      });

      console.log('✅ Assinatura criada com sucesso:', { userEmail, plan, creditsAdded: totalCredits });
      break;
    }

    case 'invoice.payment_succeeded': {
      // Renovação mensal - adicionar créditos
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log('🔄 Renovação de assinatura paga:', {
        invoiceId: invoice.id,
        subscriptionId,
      });

      // Buscar assinatura
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const metadata = subscription.metadata;
      const { plan, totalCredits } = metadata;

      if (!plan || !totalCredits) {
        console.error('❌ Metadata incompleto na assinatura');
        break;
      }

      const customerEmail = invoice.customer_email;
      if (!customerEmail) {
        console.error('❌ Email do cliente não encontrado');
        break;
      }

      // Buscar usuário
      const { data: currentUser } = await supabaseAdmin
        .from('emails')
        .select('creditos')
        .eq('email', customerEmail)
        .single();

      if (!currentUser) {
        console.error('❌ Usuário não encontrado:', customerEmail);
        break;
      }

      // Adicionar créditos da renovação
      const newCredits = (currentUser.creditos || 0) + parseInt(totalCredits);

      await supabaseAdmin
        .from('emails')
        .update({ creditos: newCredits })
        .eq('email', customerEmail);

      // Atualizar status da assinatura
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'ativa',
          status_pagamento: 'ok',
          proxima_cobranca: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);

      // Registrar transação de renovação
      await supabaseAdmin.from('transactions').insert({
        user_email: customerEmail,
        type: 'upgrade',
        plan: plan,
        credits_added: parseInt(totalCredits),
        amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
        stripe_session_id: invoice.id,
        status: 'completed',
      });

      console.log('✅ Créditos renovados:', { customerEmail, creditsAdded: totalCredits, newTotal: newCredits });
      break;
    }

    case 'invoice.payment_failed': {
      // Falha no pagamento
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log('❌ Falha no pagamento da assinatura:', {
        invoiceId: invoice.id,
        subscriptionId,
      });

      // Atualizar status da assinatura
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status_pagamento: 'falhou',
          mensagem_erro: 'Falha no pagamento. Atualize seu método de pagamento.',
        })
        .eq('stripe_subscription_id', subscriptionId);

      break;
    }

    case 'customer.subscription.deleted': {
      // Assinatura cancelada
      const subscription = event.data.object as Stripe.Subscription;

      console.log('🚫 Assinatura cancelada:', {
        subscriptionId: subscription.id,
      });

      const customerEmail = subscription.metadata?.userEmail;
      if (!customerEmail) {
        console.error('❌ Email não encontrado no metadata da assinatura');
        break;
      }

      // Atualizar status da assinatura
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'cancelada',
          data_cancelamento: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

      // Voltar usuário para plano free
      await supabaseAdmin
        .from('emails')
        .update({ plano: 'free' })
        .eq('email', customerEmail);

      console.log('✅ Usuário voltou para plano free:', customerEmail);
      break;
    }

    default:
      console.log(`Evento não tratado: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
