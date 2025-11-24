/**
 * Utilidade para substituir URLs do Supabase pelo domínio customizado
 * 
 * Troca automaticamente:
 * - https://abfgmstblltfdtschoja.supabase.co → https://auth.buua.app
 * - Mantém o resto do path inalterado
 */

const SUPABASE_DOMAIN = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const CUSTOM_DOMAIN = 'https://auth.buua.app';

/**
 * Substitui o domínio padrão do Supabase pelo domínio customizado
 * @param url - URL original do Supabase
 * @returns URL com domínio customizado
 */
export function replaceSupabaseDomain(url: string): string {
  if (!url) return url;
  
  // Se a URL já usa o domínio customizado, retornar como está
  if (url.startsWith(CUSTOM_DOMAIN)) {
    return url;
  }
  
  // Se a URL usa o domínio do Supabase, substituir
  if (SUPABASE_DOMAIN && url.startsWith(SUPABASE_DOMAIN)) {
    return url.replace(SUPABASE_DOMAIN, CUSTOM_DOMAIN);
  }
  
  // Se contém .supabase.co (formato genérico), substituir
  const supabaseRegex = /https:\/\/[a-z0-9]+\.supabase\.co/i;
  if (supabaseRegex.test(url)) {
    return url.replace(supabaseRegex, CUSTOM_DOMAIN);
  }
  
  // Se não é URL do Supabase, retornar original
  return url;
}

/**
 * Substitui domínios em array de URLs
 */
export function replaceSupabaseDomainsInArray(urls: string[]): string[] {
  return urls.map(replaceSupabaseDomain);
}

/**
 * Substitui domínios em objeto com propriedades de URL
 */
export function replaceSupabaseDomainsInObject<T extends Record<string, unknown>>(
  obj: T,
  urlKeys: string[] = ['imageUrl', 'videoUrl', 'audioUrl', 'publicUrl', 'url']
): T {
  const result: Record<string, unknown> = { ...obj };
  
  for (const key of urlKeys) {
    if (typeof result[key] === 'string') {
      result[key] = replaceSupabaseDomain(result[key] as string);
    }
  }
  
  return result as T;
}

