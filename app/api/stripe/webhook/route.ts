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
      try {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log('💰 Checkout concluído:', {
          sessionId: session.id,
          subscriptionId: session.subscription,
          metadata: session.metadata,
        });

        // Verificar se é compra de créditos
        if (session.metadata?.type === 'credits_purchase') {
          console.log('🔋 Compra de créditos detectada');
          
          const { email, credits, planId, pricePerCredit } = session.metadata;

          if (!email || !credits) {
            console.error('❌ Metadata incompleto para compra de créditos:', session.metadata);
            return NextResponse.json({ error: 'Metadata incompleto' }, { status: 400 });
          }

          const creditsToAdd = parseInt(credits);

          console.log('💳 Processando compra de créditos:', {
            email,
            creditsToAdd,
            planId,
            pricePerCredit,
          });

          // Buscar créditos atuais
          const { data: currentUser, error: fetchError } = await supabaseAdmin
            .from('emails')
            .select('creditos_extras, creditos, plano')
            .eq('email', email)
            .single();

          if (fetchError) {
            console.error('❌ Erro ao buscar usuário:', fetchError);
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
          }

          const creditosExtrasAntes = currentUser.creditos_extras || 0;
          const novosCreditosExtras = creditosExtrasAntes + creditsToAdd;

          console.log('📊 Atualizando créditos extras:', {
            email,
            creditosExtrasAntes,
            creditosComprados: creditsToAdd,
            novosCreditosExtras,
          });

          // Adicionar créditos na coluna creditos_extras
          const { error: updateError } = await supabaseAdmin
            .from('emails')
            .update({
              creditos_extras: novosCreditosExtras,
            })
            .eq('email', email);

          if (updateError) {
            console.error('❌ Erro ao atualizar créditos extras:', updateError);
            return NextResponse.json({ 
              error: 'Erro ao atualizar créditos',
              details: updateError.message 
            }, { status: 500 });
          }

          // Registrar transação
          await supabaseAdmin.from('transactions').insert({
            user_email: email,
            type: 'credits_purchase',
            plan: planId,
            credits_added: creditsToAdd,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            stripe_session_id: session.id,
            status: 'completed',
          });

          console.log('✅ Créditos extras adicionados com sucesso:', {
            email,
            creditosAdicionados: creditsToAdd,
            totalCreditos: currentUser.creditos + novosCreditosExtras,
          });

          break;
        }

        // Checkout de assinatura
        const { userEmail, plan, totalCredits } = session.metadata || {};

        if (!userEmail || !plan || !totalCredits) {
          console.error('❌ Metadata incompleto no webhook:', session.metadata);
          return NextResponse.json({ error: 'Metadata incompleto' }, { status: 400 });
        }

        console.log('🔍 PASSO 0 - DADOS RECEBIDOS:', { userEmail, plan, totalCredits });

      // 🔥 PASSO 1: Buscar assinatura ativa antiga e cancelar na Stripe
      const { data: oldSubscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id, plano, status')
        .eq('user_email', userEmail)
        .eq('status', 'ativa')
        .single();

      if (oldSubscription && oldSubscription.stripe_subscription_id) {
        // Cancelar assinatura antiga NA STRIPE
        try {
          await stripe.subscriptions.cancel(oldSubscription.stripe_subscription_id);
          console.log('🗑️ Assinatura antiga CANCELADA na Stripe:', {
            oldSubscriptionId: oldSubscription.stripe_subscription_id,
            oldPlan: oldSubscription.plano,
          });

          // Marcar como cancelada no banco
          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'cancelada',
              data_cancelamento: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', oldSubscription.stripe_subscription_id);
        } catch (cancelError) {
          console.error('⚠️ Erro ao cancelar assinatura antiga:', cancelError);
          // Continuar mesmo se falhar (pode já estar cancelada)
        }
      }

      // 🔥 PASSO 2: Buscar créditos atuais do usuário
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

      // ⚠️ IMPORTANTE: SUBSTITUIR créditos do plano (não somar!)
      // Quando muda de plano, recebe os créditos do NOVO plano apenas
      const creditsToSet = parseInt(totalCredits);

      console.log('🔄 SUBSTITUINDO CRÉDITOS:', {
        creditosAntes,
        '→': creditsToSet,
        planoAnterior: planoAntes,
        planoNovo: plan,
      });

      // Atualizar banco SUBSTITUINDO os créditos E O PLANO
      console.log('📝 PASSO 3 - ATUALIZANDO BANCO:', {
        email: userEmail,
        novoPlano: plan,
        novosCreditos: creditsToSet,
      });

      // Verificar se o plano existe na tabela plans ANTES de tentar atualizar
      const { data: planExists } = await supabaseAdmin
        .from('plans')
        .select('slug, nome')
        .eq('slug', plan)
        .single();

      if (!planExists) {
        console.error('❌ ERRO CRÍTICO: Plano não existe na tabela plans!', {
          planoSolicitado: plan,
          mensagem: 'É necessário popular a tabela plans com os slugs: free, pro, premium, unlimited'
        });
        return NextResponse.json({ 
          error: 'Plano não cadastrado no sistema',
          details: `O plano "${plan}" não existe na tabela plans. Execute o script FIX_PLANS_TABLE.sql`
        }, { status: 500 });
      }

      console.log('✅ Plano validado:', planExists);

      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('emails')
        .update({
          plano: plan,
          creditos: creditsToSet, // Substitui pelos créditos do novo plano
        })
        .eq('email', userEmail)
        .select('plano, creditos');

      if (updateError) {
        console.error('❌ ERRO CRÍTICO ao atualizar usuário:', updateError);
        console.error('❌ Detalhes do erro:', JSON.stringify(updateError, null, 2));
        console.error('❌ Código do erro:', updateError.code);
        console.error('❌ Mensagem:', updateError.message);
        
        // Se for erro de Foreign Key
        if (updateError.code === '23503') {
          console.error('❌ ERRO DE FOREIGN KEY: O plano não existe na tabela plans!');
          console.error('❌ SOLUÇÃO: Execute o script supabase/FIX_PLANS_TABLE.sql');
        }
        
        return NextResponse.json({ 
          error: 'Erro ao atualizar usuário',
          details: updateError.message,
          code: updateError.code
        }, { status: 500 });
      }

      console.log('✅ BANCO ATUALIZADO! Resultado:', updateData);

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
        esperado: creditsToSet,
        substituiuCorreto: verificacao?.creditos === creditsToSet ? '✅ SIM' : '❌ NÃO',
      });

      // Registrar/atualizar assinatura NOVA
      // Como cancelamos a antiga, criamos uma nova entrada
      await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_email: userEmail,
          stripe_subscription_id: session.subscription as string,
          stripe_customer_id: session.customer as string,
          plano: plan,
          status: 'ativa',
          preco_mensal: session.amount_total ? session.amount_total / 100 : 0,
          data_inicio: new Date().toISOString(),
          proxima_cobranca: session.subscription 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 dias
            : null,
        });

      // Registrar transação
      await supabaseAdmin.from('transactions').insert({
        user_email: userEmail,
        type: 'upgrade',
        plan: plan,
        credits_added: creditsToSet,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        stripe_session_id: session.id,
        status: 'completed',
      });

      console.log('🎉 UPGRADE COMPLETO:', {
        userEmail,
        planoAnterior: planoAntes,
        planoNovo: plan,
        assinaturaAntigaCancelada: oldSubscription ? '✅ SIM' : '❌ Não tinha',
        oldSubscriptionId: oldSubscription?.stripe_subscription_id || 'N/A',
        newSubscriptionId: session.subscription,
        creditosAntigos: creditosAntes,
        creditosNovos: creditsToSet,
        acao: 'SUBSTITUIU (não somou)',
      });
      } catch (error) {
        console.error('❌ ERRO CRÍTICO no processamento do checkout:', error);
        console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
        return NextResponse.json({ 
          error: 'Erro ao processar checkout',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
      }

      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log('🔄 Renovação mensal paga:', { invoiceId: invoice.id, subscriptionId });

      // Verificar se a invoice tem uma assinatura associada
      if (!subscriptionId) {
        console.log('⚠️ Invoice sem assinatura associada (provavelmente pagamento único) - ignorando');
        break;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const { plan, totalCredits, userEmail } = subscription.metadata;

      if (!plan || !totalCredits || !userEmail) {
        console.error('❌ Metadata incompleto na assinatura');
        break;
      }

      // Verificar se assinatura está cancelada no banco
      const { data: dbSubscription } = await supabaseAdmin
        .from('subscriptions')
        .select('status')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (dbSubscription?.status === 'cancelada') {
        console.log('⚠️ Assinatura cancelada - NÃO renovar créditos:', {
          userEmail,
          subscriptionId,
        });
        break;
      }

      // ⚠️ IMPORTANTE: SUBSTITUIR créditos (não somar!)
      // Renovação mensal = resetar para os créditos do plano
      const creditsToSet = parseInt(totalCredits);

      console.log('🔄 RENOVAÇÃO MENSAL - SUBSTITUINDO créditos:', {
        userEmail,
        plan,
        creditosNovos: creditsToSet,
        acao: 'SUBSTITUIR (resetar para créditos do plano)',
      });

      await supabaseAdmin
        .from('emails')
        .update({ creditos: creditsToSet })
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
        type: 'renewal',
        plan: plan,
        credits_added: parseInt(totalCredits),
        amount: invoice.amount_paid ? invoice.amount_paid / 100 : 0,
        stripe_session_id: invoice.id,
        status: 'completed',
      });

      console.log('✅ Renovação: créditos SUBSTITUÍDOS (resetados):', {
        userEmail,
        creditosResetados: creditsToSet,
      });

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      const attemptCount = invoice.attempt_count || 0;

      console.log('❌ Falha no pagamento:', { 
        invoiceId: invoice.id,
        subscriptionId,
        attemptCount,
      });

      // Buscar informações da assinatura
      const { data: dbSubscription } = await supabaseAdmin
        .from('subscriptions')
        .select('user_email, plano')
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (!dbSubscription) {
        console.error('❌ Assinatura não encontrada no banco');
        break;
      }

      const { user_email: userEmail, plano } = dbSubscription;

      console.log('🚨 PAGAMENTO FALHOU - Cancelando assinatura IMEDIATAMENTE:', {
        userEmail,
        plano,
        mensagem: 'Período pago já expirou, assinatura cancelada agora',
      });

      // Cancelar assinatura na Stripe IMEDIATAMENTE (não no fim do período)
      try {
        await stripe.subscriptions.cancel(subscriptionId);
        console.log('✅ Assinatura cancelada imediatamente na Stripe');
      } catch (cancelError) {
        console.error('Erro ao cancelar assinatura:', cancelError);
      }

      // Marcar assinatura como "expirada" no banco
      // Usuário MANTÉM o plano mas sem assinatura ativa
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'expirada',
          status_pagamento: 'falhou',
          mensagem_erro: 'Pagamento falhou. Assine novamente para continuar usando.',
          tentativas_falha: attemptCount,
          data_cancelamento: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscriptionId);

      // Registrar a falha
      await supabaseAdmin.from('transactions').insert({
        user_email: userEmail,
        type: 'payment_failed',
        plan: plano,
        credits_added: 0,
        amount: invoice.amount_due ? invoice.amount_due / 100 : 0,
        stripe_session_id: invoice.id,
        status: 'failed',
      });

      console.log('✅ Assinatura cancelada e marcada como expirada - usuário mantém plano mas precisa assinar novamente');

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userEmail = subscription.metadata?.userEmail;

      console.log('🚫 Assinatura cancelada na Stripe:', { 
        subscriptionId: subscription.id,
        userEmail,
        canceledAt: subscription.canceled_at,
      });

      if (!userEmail) {
        console.error('❌ Email não encontrado no metadata da assinatura');
        break;
      }

      // Verificar status atual da assinatura
      const { data: dbSubscription } = await supabaseAdmin
        .from('subscriptions')
        .select('status, plano')
        .eq('stripe_subscription_id', subscription.id)
        .single();

      // Se for upgrade (status já está "cancelada"), não fazer nada
      if (dbSubscription?.status === 'cancelada') {
        console.log('⚠️ Assinatura já cancelada (upgrade em andamento) - mantendo plano');
        break;
      }

      // Se já está marcada como expirada (veio do invoice.payment_failed), 
      // apenas confirmar o cancelamento
      if (dbSubscription?.status === 'expirada') {
        console.log('✅ Confirmando cancelamento de assinatura já expirada:', {
          userEmail,
          plano: dbSubscription.plano,
        });
        
        // Já foi marcada como expirada no invoice.payment_failed
        // Usuário já mantém o plano e precisa reativar
        break;
      }

      // Para outros casos (cancelamento manual pelo usuário), marcar como cancelada
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'cancelada',
          data_cancelamento: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

      console.log('✅ Assinatura marcada como cancelada no banco (cancelamento manual)');
      break;
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = dispute.charge;
      
      console.log('🚨 CHARGEBACK DETECTADO:', {
        disputeId: dispute.id,
        chargeId,
        amount: dispute.amount,
        reason: dispute.reason,
      });

      // Buscar pagamento pelo charge ID
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('user_email')
        .eq('stripe_payment_id', chargeId)
        .single();

      if (!payment?.user_email) {
        console.error('❌ Usuário não encontrado para o chargeback');
        break;
      }

      // BLOQUEAR CONTA IMEDIATAMENTE
      await supabaseAdmin
        .from('emails')
        .update({
          ativo: 0,
          motivo_bloqueio: `Chargeback detectado. Dispute ID: ${dispute.id}. Motivo: ${dispute.reason}`,
          data_bloqueio: new Date().toISOString(),
        })
        .eq('email', payment.user_email);

      // Cancelar assinatura se houver
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_email', payment.user_email)
        .eq('status', 'ativa')
        .single();

      if (subscription?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'cancelada', data_cancelamento: new Date().toISOString() })
            .eq('stripe_subscription_id', subscription.stripe_subscription_id);
        } catch (err) {
          console.error('Erro ao cancelar assinatura do chargeback:', err);
        }
      }

      console.log('🔒 CONTA BLOQUEADA por chargeback:', payment.user_email);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      
      console.log('💸 REEMBOLSO DETECTADO (charge.refunded):', {
        chargeId: charge.id,
        amount: charge.amount_refunded,
        refunded: charge.refunded,
      });

      // Buscar pagamento pelo charge ID
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('user_email')
        .eq('stripe_payment_id', charge.id)
        .single();

      if (!payment?.user_email) {
        console.error('❌ Usuário não encontrado para o reembolso');
        break;
      }

      // BLOQUEAR CONTA IMEDIATAMENTE
      await supabaseAdmin
        .from('emails')
        .update({
          ativo: 0,
          motivo_bloqueio: `Reembolso processado. Charge ID: ${charge.id}. Valor: R$ ${(charge.amount_refunded / 100).toFixed(2)}`,
          data_bloqueio: new Date().toISOString(),
        })
        .eq('email', payment.user_email);

      // Cancelar assinatura se houver
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_email', payment.user_email)
        .eq('status', 'ativa')
        .single();

      if (subscription?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'cancelada', data_cancelamento: new Date().toISOString() })
            .eq('stripe_subscription_id', subscription.stripe_subscription_id);
        } catch (err) {
          console.error('Erro ao cancelar assinatura do reembolso:', err);
        }
      }

      console.log('🔒 CONTA BLOQUEADA por reembolso:', payment.user_email);
      break;
    }

    case 'refund.created': {
      const refund = event.data.object as Stripe.Refund;
      const chargeId = refund.charge as string;
      
      console.log('💸 REEMBOLSO DETECTADO (refund.created):', {
        refundId: refund.id,
        chargeId,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
      });

      // Buscar o charge para obter o customer e email
      let userEmail: string | null = null;

      try {
        const charge = await stripe.charges.retrieve(chargeId);
        console.log('📋 Charge recuperado:', {
          chargeId: charge.id,
          customer: charge.customer,
          email: charge.billing_details?.email,
        });

        // Tentar obter email do billing_details
        if (charge.billing_details?.email) {
          userEmail = charge.billing_details.email;
        }
        // Se não, buscar do customer
        else if (charge.customer) {
          const customer = await stripe.customers.retrieve(charge.customer as string);
          if (!customer.deleted && customer.email) {
            userEmail = customer.email;
          }
        }
      } catch (err) {
        console.error('Erro ao buscar charge:', err);
      }

      // Fallback: buscar na tabela payments
      if (!userEmail) {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('user_email')
          .eq('stripe_payment_id', chargeId)
          .single();

        if (payment?.user_email) {
          userEmail = payment.user_email;
        }
      }

      // Fallback 2: buscar na tabela transactions pelo charge
      if (!userEmail) {
        const { data: transaction } = await supabaseAdmin
          .from('transactions')
          .select('user_email')
          .eq('stripe_session_id', chargeId)
          .single();

        if (transaction?.user_email) {
          userEmail = transaction.user_email;
        }
      }

      if (!userEmail) {
        console.error('❌ CRÍTICO: Usuário não encontrado para o reembolso!', {
          refundId: refund.id,
          chargeId,
        });
        break;
      }

      console.log('✅ Email do usuário identificado:', userEmail);

      // BLOQUEAR CONTA IMEDIATAMENTE
      const { error: blockError } = await supabaseAdmin
        .from('emails')
        .update({
          ativo: 0,
          motivo_bloqueio: `Reembolso processado. Refund ID: ${refund.id}. Motivo: ${refund.reason || 'não especificado'}. Valor: R$ ${(refund.amount / 100).toFixed(2)}`,
          data_bloqueio: new Date().toISOString(),
        })
        .eq('email', userEmail);

      if (blockError) {
        console.error('❌ Erro ao bloquear conta:', blockError);
      } else {
        console.log('🔒 CONTA BLOQUEADA por reembolso:', userEmail);
      }

      // Cancelar assinatura se houver
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_email', userEmail)
        .eq('status', 'ativa')
        .single();

      if (subscription?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'cancelada', data_cancelamento: new Date().toISOString() })
            .eq('stripe_subscription_id', subscription.stripe_subscription_id);
          console.log('🚫 Assinatura cancelada:', subscription.stripe_subscription_id);
        } catch (err) {
          console.error('Erro ao cancelar assinatura do reembolso:', err);
        }
      }

      break;
    }

    default:
      console.log(`Evento não tratado: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
