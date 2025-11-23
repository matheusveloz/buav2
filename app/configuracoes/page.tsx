import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import { buildInitialProfile } from '@/lib/profile';
import ConfiguracoesClient from './configuracoes-client';

export default async function ConfiguracoesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login');
  }

  // Buscar perfil do usuário
  const { data: profile } = await supabase
    .from('emails')
    .select('plano, creditos, creditos_extras')
    .eq('email', user.email)
    .maybeSingle();

  const initialProfile = buildInitialProfile(profile);

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={user.email}>
      <ConfiguracoesClient userEmail={user.email} />
    </AuthenticatedShell>
  );
}

