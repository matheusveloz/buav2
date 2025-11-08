## BUUA v2 – Landing Page & Autenticação

Este projeto Next.js entrega:

- Landing page escura anunciando a nova versão BUUA v2 (`app/page.tsx`);
- Fluxo de autenticação via Google com Supabase (`/login`, `/signup`, `/auth/callback`);
- Dashboard autenticada (página `home`) que exibe o email do usuário logado (`/home`, `/dashboard` redireciona).

### Requisitos de ambiente

Configure um arquivo `env.local` com as chaves do Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

No painel do Supabase, adicione as URLs de redirecionamento permitidas (por exemplo `http://localhost:3000/auth/callback` e a versão em produção).

### Tabela de emails no Supabase

Crie uma tabela simples para armazenar os emails autenticados. Execute no SQL editor do Supabase:

```sql
create table if not exists public.emails (
  email text primary key
);
```

A página de callback (`/auth/callback`) fará um `upsert` nessa tabela sempre que um usuário concluir o login via Google.

### Rodando localmente

```bash
npm install
npm run dev
```

O app ficará disponível em [http://localhost:3000](http://localhost:3000).
