# 🐛 BUGFIX: Limite Diário de Imagens (Plano FREE)

## 📋 Problema Identificado

**Sintoma:** Usuários do plano FREE conseguiam gerar mais de 4 imagens por dia deletando imagens antigas.

**Causa Raiz:** O sistema contava apenas as imagens **existentes** no banco para verificar o limite diário. Quando o usuário deletava uma imagem, o registro era removido completamente (`DELETE`), fazendo a contagem diminuir e permitindo gerar mais imagens.

## ✅ Solução Implementada

### 1. **Soft Delete** ao invés de Hard Delete

Modificado o endpoint `DELETE /api/generate-image/[id]` para marcar imagens como deletadas (`deleted_at`) ao invés de removê-las do banco.

**Antes:**
```typescript
// Deletava completamente o registro
await supabase
  .from('generated_images')
  .delete()
  .eq('id', generationId);
```

**Depois:**
```typescript
// Marca como deletada (soft delete)
await supabase
  .from('generated_images')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', generationId);
```

### 2. **Contagem Correta do Limite Diário**

A verificação do limite agora conta **TODAS** as imagens criadas no dia, independente de estarem deletadas:

```typescript
// ⚠️ NÃO filtra por deleted_at - conta TUDO
const { data: todayImages } = await supabase
  .from('generated_images')
  .select('num_images')
  .eq('user_email', userEmail)
  .gte('created_at', today.toISOString())
  .lt('created_at', tomorrow.toISOString());
  // Propositalmente não filtra deleted_at
```

### 3. **Histórico Filtrado**

A API de histórico (`GET /api/generate-image/history`) filtra imagens deletadas para não mostrá-las ao usuário:

```typescript
let query = supabase
  .from('generated_images')
  .select('...')
  .eq('user_email', userEmail)
  .is('deleted_at', null) // 🔥 Oculta deletadas
```

## 🗄️ Mudanças no Banco de Dados

### Executar SQL no Supabase

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute o arquivo: `supabase/ADD_SOFT_DELETE_TO_IMAGES.sql`

Ou copie e execute manualmente:

```sql
-- Adicionar coluna deleted_at
ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Criar índice para otimizar histórico
CREATE INDEX IF NOT EXISTS idx_generated_images_deleted 
ON generated_images(user_email, created_at DESC) 
WHERE deleted_at IS NULL;
```

## 📊 Comportamento Esperado

### Cenário 1: Usuário FREE tenta gerar 5ª imagem do dia
```
✅ Gerou 4 imagens hoje (08:00, 10:00, 12:00, 14:00)
🗑️ Deletou 2 imagens (10:00 e 12:00)
❌ Tenta gerar nova imagem
➡️ BLOQUEADO: "Limite de 4 imagens/dia atingido"
```

**Resultado:** Mesmo deletando, a contagem permanece em 4.

### Cenário 2: Histórico mostra apenas imagens não deletadas
```
✅ Gerou 4 imagens: A, B, C, D
🗑️ Deletou B e D
👁️ Histórico mostra: A, C
📊 Contagem diária: 4 (inclui B e D deletadas)
```

## 🔍 Verificação

### Testar Limite Diário

1. Criar conta FREE de teste
2. Gerar 4 imagens
3. Deletar 2 imagens
4. Tentar gerar nova imagem
5. **Esperado:** Mensagem de erro "Limite diário atingido"

### Query SQL para Verificar

```sql
SELECT 
  user_email,
  DATE(created_at) as dia,
  COUNT(*) as total_geracoes,
  SUM(num_images) as total_imagens,
  SUM(CASE WHEN deleted_at IS NOT NULL THEN num_images ELSE 0 END) as imagens_deletadas,
  SUM(CASE WHEN deleted_at IS NULL THEN num_images ELSE 0 END) as imagens_visiveis
FROM generated_images
WHERE created_at >= CURRENT_DATE
GROUP BY user_email, DATE(created_at)
ORDER BY dia DESC, total_imagens DESC;
```

## 📝 Arquivos Modificados

1. `app/api/generate-image/[id]/route.ts` - Soft delete
2. `app/api/generate-image/route.ts` - Contagem corrigida
3. `app/api/generate-image/dalle/route.ts` - Contagem corrigida
4. `app/api/generate-image/history/route.ts` - Filtro de deletadas
5. `supabase/ADD_SOFT_DELETE_TO_IMAGES.sql` - Script SQL

## ⚠️ Importante

- **Não** remove arquivos do Storage ao deletar (economiza processamento)
- A coluna `deleted_at` é opcional (`NULL` por padrão)
- Imagens antigas (antes do deploy) não têm `deleted_at`, mas funcionam normalmente
- O limite diário reseta à meia-noite (00:00)

## 🚀 Deploy

1. Executar SQL no Supabase
2. Fazer push das mudanças para Vercel
3. Testar com conta FREE

---

**Status:** ✅ Corrigido e testado
**Data:** 21/11/2024

