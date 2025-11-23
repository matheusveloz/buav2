import { redirect } from 'next/navigation';
import ImageGeneratorClient from './image-generator-client';
import { buildInitialProfile } from '@/lib/profile';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ImageGeneratorPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('Erro ao obter usuário autenticado:', userError.message);
  }

  if (!user?.email) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('emails')
    .select('plano, creditos, creditos_extras')
    .eq('email', user.email)
    .maybeSingle();

  if (profileError) {
    console.error('Erro ao carregar perfil do usuário:', profileError.message);
  }

  const initialProfile = buildInitialProfile(profile);

  return (
    <ImageGeneratorClient
      initialProfile={initialProfile}
      userEmail={user.email}
    />
  );
}

