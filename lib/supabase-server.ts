import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(_name: string, _value: string, _options: CookieOptions) {
          void _name;
          void _value;
          void _options;
          // noop on server component (handled via middleware/route handlers)
        },
        remove(_name: string, _options: CookieOptions) {
          void _name;
          void _options;
          // noop on server component
        },
      },
    }
  );
}

