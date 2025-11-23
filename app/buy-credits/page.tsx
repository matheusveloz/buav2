import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import BuyCreditsClient from './buy-credits-client';
import { buildInitialProfile } from '@/lib/profile';

export const metadata = {
  title: 'Comprar Créditos | BUUA',
  description: 'Compre créditos extras para continuar criando',
};

export default async function BuyCreditsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login');
  }

  const { data: profileData } = await supabase
    .from('emails')
    .select('plano, creditos, creditos_extras')
    .eq('email', user.email)
    .maybeSingle();

  const profile = buildInitialProfile(profileData);

  if (profile.plan === 'free') {
    redirect('/upgrade');
  }

  return <BuyCreditsClient initialProfile={profile} userEmail={user.email} />;
}

