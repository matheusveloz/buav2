import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
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

  switch (event.type) {
    case 'checkout.session.completed': {
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

      console.log('🔍 ANTES DE BUSCAR USUÁRIO:', { userEmail, plan, totalCredits });

      // Buscar créditos atuais do usuário
      const { data: currentUser, error: fetchError } = await supabaseAdmin
        .from('emails')
        .select('creditos, creditos_extras, plano')
        .eq('email', userEmail)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar usuário:', fetchError);
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      const creditosAntes = currentUser.creditos || 0;
      const planoAntes = currentUser.plano;

      console.log('📊 CRÉDITOS ANTES:', {
        userEmail,
        planoAntes,
        creditosAntes,
        creditos_extras: currentUser.creditos_extras,
        totalAntes: creditosAntes + (currentUser.creditos_extras || 0),
      });

      // 🚨 IMPORTANTE: SOMAR créditos aos existentes (NÃO SUBSTITUIR!)
      const creditsToAdd = parseInt(totalCredits);
      const newCredits = creditosAntes + creditsToAdd;

      console.log('➕ CALCULANDO SOMA:', {
        creditosAntes,
        '+': creditsToAdd,
        '=': newCredits,
        formula: `${creditosAntes} + ${creditsToAdd} = ${newCredits}`,
      });

      // Atualizar banco com créditos SOMADOS
      const { error: updateError } = await supabaseAdmin
        .from('emails')
        .update({
          plano: plan,
          creditos: newCredits, // SOMA, não substitui!
        })
        .eq('email', userEmail);

      if (updateError) {
        console.error('❌ Erro ao atualizar usuário:', updateError);
        return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
      }

      console.log('✅ BANCO ATUALIZADO! Verificando...');

      // Verificar se realmente atualizou
      const { data: verificacao } = await supabaseAdmin
        .from('emails')
        .select('creditos, plano')
        .eq('email', userEmail)
        .single();

      console.log('🔎 VERIFICAÇÃO FINAL:', {
        userEmail,
        planoNovo: verificacao?.plano,
        creditosDepois: verificacao?.creditos,
        esperado: newCredits,
        somouCorreto: verificacao?.creditos === newCredits ? '✅ SIM' : '❌ NÃO',
      });

      // Registrar/atualizar assinatura
      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_email: userEmail,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: session.customer as string,
          plano: plan,
          status: 'ativa',
          preco_mensal: session.amount_total ? session.amount_total / 100 : 0,
          data_inicio: new Date().toISOString(),
        }, {
          onConflict: 'user_email',
        });

      // Registrar transação
      await supabaseAdmin.from('transactions').insert({
        user_email: userEmail,
        type: 'upgrade',
        plan: plan,
        credits_added: creditsToAdd,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        stripe_session_id: session.id,
        status: 'completed',
      });

      console.log('🎉 UPGRADE COMPLETO:', {
        userEmail,
        planoAnterior: planoAntes,
        planoNovo: plan,
        creditosAntes: creditosAntes,
        creditosAdicionados: creditsToAdd,
        creditosDepois: newCredits,
        diferenca: `+${creditsToAdd} créditos`,
      });

      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log('🔄 Renovação mensal paga:', { invoiceId: invoice.id, subscriptionId });

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const { plan, totalCredits, userEmail } = subscription.metadata;

      if (!plan || !totalCredits || !userEmail) {
        console.error('❌ Metadata incompleto na assinatura');
        break;
      }

      // SOMAR créditos mensais (renovação)
      const { data: currentUser } = await supabaseAdmin
        .from('emails')
        .select('creditos')
        .eq('email', userEmail)
        .single();

      if (!currentUser) {
        console.error('❌ Usuário não encontrado:', userEmail);
        break;
      }

      const newCredits = (currentUser.creditos || 0) + parseInt(totalCredits);

      await supabaseAdmin
        .from('emails')
        .update({ creditos: newCredits })
        .eq('email', userEmail);

      // Atualizar próxima cobrança
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'ativa',
          status_pagamento: 'ok',
          proxima_cobranca: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);

      // Registrar renovação
      await supabaseAdmin.from('transactions').insert({
        user_email: userEmail,
        type: 'upgrade',
        plan: plan,
        credits_added: parseInt(totalCredits),
        amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
        stripe_session_id: invoice.id,
        status: 'completed',
      });

      console.log('✅ Renovação: créditos SOMADOS:', {
        userEmail,
        creditsAdded: totalCredits,
        newTotal: newCredits,
      });

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log('❌ Falha no pagamento:', { invoiceId: invoice.id });

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
      const subscription = event.data.object as Stripe.Subscription;
      const userEmail = subscription.metadata?.userEmail;

      console.log('🚫 Assinatura cancelada:', { subscriptionId: subscription.id });

      if (!userEmail) {
        console.error('❌ Email não encontrado no metadata');
        break;
      }

      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'cancelada',
          data_cancelamento: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

      // Voltar para plano free
      await supabaseAdmin
        .from('emails')
        .update({ plano: 'free' })
        .eq('email', userEmail);

      console.log('✅ Usuário voltou para plano free:', userEmail);
      break;
    }

    default:
      console.log(`Evento não tratado: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
