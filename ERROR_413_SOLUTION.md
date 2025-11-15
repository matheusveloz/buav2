# 🚨 ERRO 413: Payload Too Large - SOLUÇÃO DEFINITIVA

## ❌ O Problema

```
Failed to load resource: the server responded with a status of 413 ()
```

**Erro 413 = "Payload Too Large"** - O Next.js está bloqueando o upload antes mesmo de chegar na API.

---

## 🔍 Por que acontece?

O **Next.js 14 com App Router** tem um limite padrão de **4.5MB** para requisições.

Para API Routes (`/app/api/`), o limite de body NÃO pode ser configurado diretamente no `next.config.ts` como no Pages Router.

---

## ✅ SOLUÇÃO: Upload Direto para Supabase Storage

A melhor solução é fazer **upload direto** do cliente para o Supabase Storage, sem passar pelo Next.js:

### **Vantagens:**
- ✅ Sem limite de tamanho
- ✅ Sem timeout
- ✅ Mais rápido
- ✅ Menos carga no servidor

### **Implementação:**

Vou modificar o código para usar upload direto.

---

## 🛠️ Alternativa Temporária (Desenvolvimento Local)

Se você está rodando **localmente** (não no Vercel), você pode aumentar o limite:

### 1. Instalar dependência:

```bash
npm install busboy
```

### 2. Processar manualmente o FormData na route

Mas isso **NÃO funciona no Vercel** por limitações da plataforma.

---

## 🚀 SOLUÇÃO RECOMENDADA: Implementar Upload Direto

Vou implementar agora:

1. Cliente faz upload diretamente para Supabase Storage
2. Depois registra no banco de dados
3. Sem passar pelo Next.js
4. Sem limite de tamanho!

---

Implementando agora...

