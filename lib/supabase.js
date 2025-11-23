'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey, {
  cookies: {
    get(name) {
      if (typeof document === 'undefined') return undefined;
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) {
          return decodeURIComponent(value);
        }
      }
      return undefined;
    },
    set(name, value, options) {
      if (typeof document === 'undefined') return;
      let cookie = `${name}=${encodeURIComponent(value)}`;
      
      if (options?.maxAge) {
        cookie += `; max-age=${options.maxAge}`;
      }
      if (options?.domain) {
        cookie += `; domain=${options.domain}`;
      }
      if (options?.path) {
        cookie += `; path=${options.path}`;
      } else {
        cookie += '; path=/';
      }
      if (options?.sameSite) {
        cookie += `; samesite=${options.sameSite}`;
      } else {
        cookie += '; samesite=lax';
      }
      
      document.cookie = cookie;
    },
    remove(name, options) {
      if (typeof document === 'undefined') return;
      this.set(name, '', { ...options, maxAge: 0 });
    },
  },
});
