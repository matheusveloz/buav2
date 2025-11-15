import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildInitialProfile } from '@/lib/profile';
import ConfiguracoesClient from './configuracoes-client';

export const metadata = {
  title: 'Configurações - BUUA',
  description: 'Gerencie sua assinatura e configurações da conta',
};

export default async function ConfiguracoesPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('emails')
    .select('*')
    .eq('email', user.email)
    .single();

  const initialProfile = profile ? buildInitialProfile(profile) : buildInitialProfile({ email: user.email });

  return <ConfiguracoesClient initialProfile={initialProfile} userEmail={user.email} />;
}
