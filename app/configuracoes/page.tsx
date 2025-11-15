import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import ConfiguracoesClient from './configuracoes-client';

export default async function ConfiguracoesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Buscar perfil do usuário
  const { data: profile } = await supabase
    .from('emails')
    .select('*')
    .eq('email', user.email!)
    .single();

  return <ConfiguracoesClient initialProfile={profile} />;
}

