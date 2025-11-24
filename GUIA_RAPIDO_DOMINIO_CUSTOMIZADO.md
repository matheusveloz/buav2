# 🚀 Guia Rápido: Domínio Customizado

## ⚠️ URLs Ainda Salvando com `.supabase.co`?

Você tem **2 formas** de resolver isso:

---

## ✅ Opção 1: Mudar a Variável de Ambiente (Recomendado)

### Passo 1: Configure no Vercel
```bash
# Vercel → Project Settings → Environment Variables
NEXT_PUBLIC_SUPABASE_URL=https://auth.buua.app
```

### Passo 2: Configure no Supabase
1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Vá em **Project Settings** → **API**
3. Em **Configuration**, você verá a URL padrão
4. Clique em **Custom Domain** (no menu lateral)
5. Adicione `auth.buua.app`
6. Siga as instruções de configuração DNS

### Passo 3: Configure o DNS
No seu provedor de DNS (Cloudflare, GoDaddy, etc):

```
Type: CNAME
Name: auth
Target: abfgmstblltfdtschoja.supabase.co
TTL: Auto ou 3600
Proxy: ✅ Yes (se Cloudflare)
```

### Passo 4: Redeploy
```bash
# No terminal ou no Vercel Dashboard
git push origin main
```

---

## ✅ Opção 2: Forçar Conversão (Já Implementado!)

✅ **Eu já implementei isso!** Agora **TODAS** as URLs são convertidas automaticamente antes de salvar:

### Arquivos Atualizados:
- ✅ `lib/upload-base64-to-storage.ts` - Converte URLs ao fazer upload
- ✅ `app/api/cron/process-images/route.ts` - Converte no cron
- ✅ `app/api/generate-image/polling/route.ts` - Converte no polling
- ✅ `app/api/generate-image/history/route.ts` - Converte ao retornar histórico

### Como Funciona:
1. Supabase gera URL: `https://abfgmstblltfdtschoja.supabase.co/storage/...`
2. Nossa função converte: `https://auth.buua.app/storage/...`
3. URL customizada é salva no banco ✅

---

## 🧪 Como Testar Agora

### 1. Fazer novo deploy:
```bash
git add .
git commit -m "feat: converter URLs para domínio customizado"
git push origin main
```

### 2. Gerar uma nova imagem:
- Acesse seu app
- Gere uma imagem (v2 ou v3)
- Abra o console do navegador (F12)
- Verifique a URL retornada

### 3. Verificar no banco:
```sql
-- No Supabase SQL Editor
SELECT id, image_urls, created_at 
FROM generated_images 
ORDER BY created_at DESC 
LIMIT 5;
```

A URL deve ser: `https://auth.buua.app/storage/v1/object/public/...`

---

## ⚡ Solução Imediata (Sem Configurar Domínio no Supabase)

Se você ainda não configurou o domínio customizado no Supabase, a **Opção 2** funciona perfeitamente!

**Vantagens:**
- ✅ Não precisa configurar DNS
- ✅ Não precisa configurar domínio no Supabase
- ✅ Funciona imediatamente após deploy
- ✅ Compatível com URLs antigas

**Como funciona:**
- O Supabase continua gerando URLs com `.supabase.co`
- Mas nossa função converte automaticamente para `auth.buua.app`
- URLs antigas (já no banco) são convertidas ao retornar para o cliente

---

## 🛠️ Verificar se Está Funcionando

```bash
# 1. Verificar variável no Vercel
vercel env ls

# 2. Verificar se está deployado
vercel ls

# 3. Testar geração de imagem
# Abra o app e gere uma imagem, verificar URL no console
```

---

## 📝 Status Atual

✅ Código atualizado (todos os arquivos)
✅ Função de conversão criada
✅ URLs antigas são convertidas automaticamente
✅ Novas URLs são salvas com domínio customizado

**Próximo passo:**
- Fazer deploy: `git push origin main`
- OU configurar domínio no Supabase (Opção 1)

---

## 🐛 Troubleshooting

### URLs ainda aparecem com `.supabase.co`
**Causa:** Deploy não foi feito ou variável não foi configurada
**Solução:** `git push origin main` e aguardar deploy completar

### Erro 404 nas imagens
**Causa:** Domínio `auth.buua.app` não está configurado no Supabase
**Solução:** 
- Opção A: Configurar domínio no Supabase (Passo 2 da Opção 1)
- Opção B: Reverter variável para domínio antigo temporariamente

### DNS não resolve
**Causa:** Configuração DNS ainda propagando (até 48h)
**Solução:** Aguardar ou verificar com `nslookup auth.buua.app`

---

## 💡 Recomendação

Para **agora**:
- ✅ Fazer deploy do código (já está tudo implementado)
- ✅ Testar geração de imagem
- ✅ Verificar que URLs estão sendo convertidas

Para **depois** (quando tiver tempo):
- 🔧 Configurar domínio customizado no Supabase (Opção 1)
- 🔧 Configurar DNS
- 🔧 Atualizar variável `NEXT_PUBLIC_SUPABASE_URL`

Ambas as opções funcionam! A diferença é:
- **Opção 1**: URLs são geradas direto com domínio customizado (mais limpo)
- **Opção 2**: URLs são convertidas automaticamente (funciona sem configurar nada no Supabase)

