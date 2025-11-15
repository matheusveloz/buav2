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

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('💰 Pagamento concluído:', {
        sessionId: session.id,
        metadata: session.metadata,
      });

      // Extrair dados do metadata
      const { userEmail, plan, credits, bonusCredits, totalCredits } = session.metadata || {};

      if (!userEmail || !plan || !totalCredits) {
        console.error('❌ Metadata incompleto no webhook:', session.metadata);
        return NextResponse.json({ error: 'Metadata incompleto' }, { status: 400 });
      }

      // Atualizar plano e créditos do usuário
      const supabaseAdmin = getSupabaseAdmin();
      const { data: currentUser, error: fetchError } = await supabaseAdmin
        .from('emails')
        .select('creditos, creditos_extras')
        .eq('email', userEmail)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar usuário:', fetchError);
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      }

      // Adicionar créditos aos existentes
      const newCredits = (currentUser.creditos || 0) + parseInt(totalCredits);

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

      console.log('✅ Plano atualizado com sucesso:', {
        userEmail,
        plan,
        creditsAdded: totalCredits,
        newTotal: newCredits,
      });

      // Registrar transação
      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_email: userEmail,
          type: 'upgrade',
          plan: plan,
          credits_added: parseInt(totalCredits),
          amount: session.amount_total ? session.amount_total / 100 : 0,
          stripe_session_id: session.id,
          status: 'completed',
        });

      if (transactionError) {
        console.error('⚠️ Erro ao registrar transação (não crítico):', transactionError);
        // Não retornar erro, pois o plano já foi atualizado
      }

      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      console.log('❌ Pagamento falhou:', paymentIntent.id);
      break;
    }

    default:
      console.log(`Evento não tratado: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
