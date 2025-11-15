# ✅ Checklist de Deploy - BUUA v2

## 🔧 Configurações do Supabase

### 1. Buckets de Storage (criar se não existirem)
- [ ] `audio` - Para arquivos de áudio
- [ ] `avatars` - Para vídeos de avatar personalizados
- [ ] `videos` - Para vídeos gerados pela IA

### 2. Policies de Storage
Execute no SQL Editor:

```sql
-- BUCKET: audio
CREATE POLICY "audio_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audio');

CREATE POLICY "audio_bucket_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio');

CREATE POLICY "audio_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'audio');

-- BUCKET: avatars
CREATE POLICY "avatars_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_bucket_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');

-- BUCKET: videos
CREATE POLICY "videos_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos');

CREATE POLICY "videos_bucket_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'videos');

CREATE POLICY "videos_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos');
```

### 3. Policies das Tabelas
Execute no SQL Editor:

```sql
-- TABELA: user_avatars
CREATE POLICY "user_avatars_insert_own"
  ON public.user_avatars FOR INSERT TO authenticated
  WITH CHECK (auth.email() = user_email);

CREATE POLICY "user_avatars_select_own"
  ON public.user_avatars FOR SELECT TO authenticated
  USING (auth.email() = user_email);

CREATE POLICY "user_avatars_delete_own"
  ON public.user_avatars FOR DELETE TO authenticated
  USING (auth.email() = user_email);

-- TABELA: user_audios
CREATE POLICY "user_audios_insert_own"
  ON public.user_audios FOR INSERT TO authenticated
  WITH CHECK (auth.email() = user_email);

CREATE POLICY "user_audios_select_own"
  ON public.user_audios FOR SELECT TO authenticated
  USING (auth.email() = user_email);

CREATE POLICY "user_audios_delete_own"
  ON public.user_audios FOR DELETE TO authenticated
  USING (auth.email() = user_email);

-- TABELA: videos
CREATE POLICY "videos_insert_own"
  ON public.videos FOR INSERT TO authenticated
  WITH CHECK (auth.email() = user_email);

CREATE POLICY "videos_select_own"
  ON public.videos FOR SELECT TO authenticated
  USING (auth.email() = user_email);

CREATE POLICY "videos_delete_own"
  ON public.videos FOR DELETE TO authenticated
  USING (auth.email() = user_email);

CREATE POLICY "videos_update_own"
  ON public.videos FOR UPDATE TO authenticated
  USING (auth.email() = user_email);
```

### 4. Verificar se RLS está ativo
```sql
-- Verificar se RLS está ativo nas tabelas
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('user_avatars', 'user_audios', 'videos');

-- Se alguma tabela estiver com rowsecurity = false, ative:
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
```

## 🌐 Variáveis de Ambiente no Vercel

Vá em **Settings → Environment Variables** e adicione:

### Obrigatórias:
```
NEXT_PUBLIC_NEWPORT_API_KEY=459d9c6987fd4e16ab7901015af48651
NEXT_PUBLIC_SUPABASE_URL=<sua-url-do-supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-chave-anonima>
NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET=audio
NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET=avatars
NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET=videos
NEXT_PUBLIC_APP_URL=https://buav2.vercel.app
```

### Cloudinary (Opcional - Recomendado):
Se configurado, vídeos serão padronizados para **25 FPS** (codec H264/AAC):
```
CLOUDINARY_CLOUD_NAME=<seu-cloud-name>
CLOUDINARY_API_KEY=<sua-api-key>
CLOUDINARY_API_SECRET=<seu-api-secret>
```

**Como obter:**
1. Crie conta em https://cloudinary.com
2. Vá no Dashboard
3. Copie: Cloud Name, API Key, API Secret

**Marque em todos os ambientes**: Production, Preview, Development

## ✅ Após configurar

1. Faça **Redeploy** (sem cache)
2. Acesse `/debug` para verificar se tudo está ✓
3. Teste as funcionalidades:
   - Upload de avatar
   - Upload de áudio
   - Gerar vídeo
   - Deletar avatar/áudio/vídeo

## ⚠️ Solução de Problemas

### Erro 413 (Payload Too Large) em uploads:

Se ainda ocorrer erro 413 após configurar `vercel.json` e `next.config.ts`:

1. **Verifique o plano do Vercel**:
   - Hobby: Limite de 4.5MB por request
   - Pro: Limite de 4.5MB (mesma limitação)
   - Enterprise: Limite configurável

2. **Solução alternativa**:
   - Comprimir vídeos antes do upload (frontend)
   - Usar upload direto para Supabase Storage (client-side)
   - Upload em chunks (multipart)

3. **Verificar nos logs**:
   - Se erro 413 vem do Vercel → Limite de infraestrutura
   - Se erro 500 depois → Problema de Storage/Policies

### ReferenceError: document is not defined:

- ✅ Corrigido com checagem `typeof document !== 'undefined'`
- ✅ Portais só renderizam no cliente (`isMounted`)

### Failed to parse cookie string:

- ⚠️ Warning benigno do Supabase Auth
- Não afeta funcionalidade
- Pode ser ignorado

## 🔍 Debugging

Se algo não funcionar:
- Acesse `https://buav2.vercel.app/debug`
- Veja o que está em vermelho (✗)
- Verifique os logs no Vercel (Functions → Logs)

