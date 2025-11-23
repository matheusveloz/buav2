import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com Service Role Key
 * Usado para operações administrativas como upload de arquivos no Storage
 * 
 * IMPORTANTE: Usar apenas no servidor! Nunca expor no cliente.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não está configurada');
  }

  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY não está configurada!');
    console.error('📝 Isso é necessário para upload de imagens no Storage.');
    console.error('🔧 Adicione no Vercel: Settings → Environment Variables');
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada. Upload para Storage não funcionará!'
    );
  }

  // Cliente com privilégios administrativos
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}