# Implementação de Domínio Customizado

## 📋 Resumo

Todas as URLs do Supabase Storage foram configuradas para usar o domínio customizado `https://auth.buua.app` ao invés do domínio padrão `https://abfgmstblltfdtschoja.supabase.co`.

## 🔧 Alterações Realizadas

### 1. **Função Utilitária Centralizada** (`lib/custom-domain.ts`)

Criado novo arquivo com funções para substituir automaticamente as URLs:

```typescript
/**
 * Substitui o domínio padrão do Supabase pelo domínio customizado
 * - https://abfgmstblltfdtschoja.supabase.co → https://auth.buua.app
 * - https://[qualquer].supabase.co → https://auth.buua.app
 */
export function replaceSupabaseDomain(url: string): string

/**
 * Substitui domínios em array de URLs
 */
export function replaceSupabaseDomainsInArray(urls: string[]): string[]

/**
 * Substitui domínios em objeto com propriedades de URL
 */
export function replaceSupabaseDomainsInObject<T>(obj: T, urlKeys?: string[]): T
```

### 2. **Arquivos de Imagens Atualizados**

#### ✅ `lib/supabase-storage.ts`
- Função `uploadImageToStorage()` agora retorna URLs com domínio customizado
- Função `uploadMultipleImages()` também usa domínio customizado

#### ✅ `app/api/upload-temp-image/route.ts`
- Upload de imagens de referência temporárias agora usa domínio customizado

#### ✅ `app/api/generate-image/route.ts`
- Importa `replaceSupabaseDomain` para uso futuro

#### ✅ `app/api/generate-image/polling/route.ts`
- Polling de imagens geradas retorna URLs com domínio customizado
- Upload para Storage gera URLs customizadas

#### ✅ `app/api/generate-image/history/route.ts`
- Histórico de imagens retorna URLs com domínio customizado
- Substitui URLs em todos os objetos `image_urls` antes de retornar

### 3. **Arquivos de Vídeos Atualizados**

#### ✅ `app/api/generate-video/veo/route.ts`
- Vídeos gerados com Veo 3.1 usam domínio customizado

#### ✅ `app/api/generate-video/polling/route.ts`
- Polling de vídeos Sora retorna URLs com domínio customizado

#### ✅ `app/api/generate-video/v3/route.ts`
- Vídeos v3 usam domínio customizado

#### ✅ `app/api/generate-video/status-async/route.ts`
- Status assíncrono de vídeos retorna URLs customizadas

## 🎯 Como Funciona

1. **Detecção Automática**: A função detecta se a URL é do Supabase (`.supabase.co`)
2. **Substituição Inteligente**: Substitui o domínio mantendo o path completo
3. **Já Customizado?**: Se a URL já usa `auth.buua.app`, retorna sem alterações
4. **Fallback**: Se não é URL do Supabase, retorna original

## 📝 Configuração Necessária

### 1. **Variável de Ambiente**

Certifique-se de que `NEXT_PUBLIC_SUPABASE_URL` está configurada no `.env.local` ou Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://auth.buua.app
```

### 2. **Configuração do Supabase**

No painel do Supabase, você precisa configurar o domínio customizado:

1. Acesse: **Project Settings** → **Custom Domains**
2. Adicione `auth.buua.app` como domínio customizado
3. Configure o DNS conforme instruções do Supabase

### 3. **Configuração DNS**

No seu provedor de DNS (ex: Cloudflare), adicione:

```
Type: CNAME
Name: auth
Value: [seu-projeto].supabase.co
Proxy: Yes (se Cloudflare)
```

## ✅ Benefícios

1. **✨ Branding**: URLs profissionais com seu domínio
2. **🔒 Controle**: Total controle sobre o domínio
3. **🚀 Performance**: Pode usar CDN customizado (Cloudflare)
4. **📊 Analytics**: Melhor rastreamento de assets
5. **🛡️ Segurança**: Proteção adicional com WAF do Cloudflare

## 🧪 Testando

Para verificar se está funcionando:

```bash
# 1. Gerar uma imagem
# 2. Verificar no console do navegador a URL retornada
# Deve ser: https://auth.buua.app/storage/v1/object/public/...

# 3. Verificar no banco de dados
# As URLs salvas devem usar auth.buua.app
```

## 📦 Arquivos Alterados

### Novos:
- ✅ `lib/custom-domain.ts` (novo arquivo)

### Modificados:
- ✅ `lib/supabase-storage.ts`
- ✅ `app/api/upload-temp-image/route.ts`
- ✅ `app/api/generate-image/route.ts`
- ✅ `app/api/generate-image/polling/route.ts`
- ✅ `app/api/generate-image/history/route.ts`
- ✅ `app/api/generate-video/veo/route.ts`
- ✅ `app/api/generate-video/polling/route.ts`
- ✅ `app/api/generate-video/v3/route.ts`
- ✅ `app/api/generate-video/status-async/route.ts`

## 🔄 Compatibilidade

✅ **Retrocompatível**: URLs antigas do Supabase continuam funcionando
✅ **Novos uploads**: Usam domínio customizado automaticamente
✅ **Histórico**: URLs antigas são convertidas ao buscar histórico

## 🚀 Deploy

1. Commit das alterações
2. Deploy no Vercel
3. Configurar variável `NEXT_PUBLIC_SUPABASE_URL=https://auth.buua.app` no Vercel
4. Testar gerações de imagem/vídeo

## 📝 Notas

- **URLs no banco**: URLs antigas (`.supabase.co`) continuam funcionando mas são convertidas ao retornar para o cliente
- **Performance**: Zero impacto - conversão é apenas string replace
- **Cache**: URLs customizadas podem ser cacheadas pelo Cloudflare CDN

## 🐛 Troubleshooting

### Problema: URLs ainda retornam `.supabase.co`

**Solução**: 
1. Verificar variável `NEXT_PUBLIC_SUPABASE_URL` no Vercel
2. Fazer rebuild/redeploy após adicionar variável

### Problema: Domínio customizado não resolve

**Solução**:
1. Verificar configuração DNS (pode levar até 48h)
2. Confirmar domínio no painel do Supabase
3. Testar com `nslookup auth.buua.app`

### Problema: CORS errors

**Solução**:
1. Adicionar `auth.buua.app` nas URLs permitidas do Supabase
2. **Project Settings** → **API** → **URL Configuration**

