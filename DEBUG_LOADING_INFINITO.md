# 🐛 DEBUG: Loading Infinito (Card não Atualiza)

## Problema
Card com loading fica aparecendo infinitamente, mesmo quando a imagem já foi gerada.

## Possíveis Causas

### 1. ✅ Função assíncrona não está executando
**Verificar**: Logs do Vercel devem mostrar:
```
🔄 [ASYNC V2] ===== INÍCIO DA FUNÇÃO =====
...
✅ [ASYNC V2] TaskId xxx atualizado para completed com N imagens
```

**Se NÃO aparecer**: A função está travando ou não está sendo chamada.

### 2. ✅ Banco não está sendo atualizado
**Verificar**: Query no Supabase:
```sql
SELECT id, task_id, status, image_urls, completed_at, updated_at
FROM generated_images
WHERE status = 'processing'
ORDER BY created_at DESC
LIMIT 10;
```

**Se ficar "processing"**: Update está falhando (verificar permissões do service role).

### 3. ✅ Polling não está pegando a atualização
**Verificar**: Logs do frontend (Console do navegador):
```
📥 Resposta do polling: {
  ok: true,
  status: 'completed',
  hasImages: true,
  numImages: 2
}
```

**Se status ficar "processing"**: Polling não está detectando a mudança.

### 4. ✅ Frontend não está processando a resposta
**Verificar**: Console do navegador após polling retornar "completed":
```
✅ Imagens completadas! Dados completos: {
  numImages: 2,
  generationId: 'xxx',
  images: [...]
}
```

**Se não aparecer**: Frontend não está adicionando as imagens ao state.

---

## 🔧 Soluções Aplicadas

### ✅ 1. Adicionar `updated_at` ao update
```typescript
// Linha ~193
const { error: updateError } = await supabaseClient
  .from('generated_images')
  .update({
    status: 'completed',
    image_urls: successfulImages,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), // ✅ ADICIONADO
  })
  .eq('task_id', taskId);
```

### ⏳ 2. Verificar Logs do Vercel

**Passo a passo**:
1. Acessar https://vercel.com/seu-projeto/logs
2. Filtrar por "ASYNC V2" ou "ASYNC V3"
3. Verificar se aparecem logs:
   - `🔄 [ASYNC V2] ===== INÍCIO DA FUNÇÃO =====`
   - `✅ [ASYNC V2] TaskId xxx atualizado para completed`

**Se NÃO aparecer nenhum log**:
- Função não está sendo executada
- Verificar se `generateV2ImageAsync` está sendo chamada corretamente

**Se aparecer erro**:
- Verificar o erro específico e corrigir

### ⏳ 3. Verificar Banco de Dados (Supabase)

**Query para verificar tarefas travadas**:
```sql
SELECT 
  id, 
  task_id, 
  status, 
  model,
  image_urls,
  created_at,
  completed_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS minutes_ago
FROM generated_images
WHERE status = 'processing'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Se houver registros com `minutes_ago > 5`**:
- Função travou ou falhou silenciosamente
- Verificar logs do Vercel

**Se `image_urls` estiver NULL**:
- Update não foi feito
- Verificar permissões do Supabase (service role key)

### ⏳ 4. Adicionar Timeout na Função Async (JÁ FEITO)

```typescript
// Linha ~98
const timeoutMs = 60000; // ✅ JÁ ADICIONADO

const nanoResponse = await fetch(LAOZHANG_BASE_URL, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify(nanoRequestBody),
  signal: AbortSignal.timeout(timeoutMs), // ✅ JÁ ADICIONADO
});
```

---

## 🧪 Como Testar

### Teste 1: Geração Simples (Text-to-Image)

1. Selecione **v2-quality**
2. Digite prompt: "A beautiful sunset"
3. Clique em "Criar"
4. **Observe**:
   - Frontend: Card com loading aparece
   - Espere 20-30s
   - **Resultado esperado**: Card atualiza para imagem real

### Teste 2: Com Reload da Página

1. Inicie geração (como acima)
2. Após 5s, **atualize a página** (F5)
3. **Observe**:
   - Card com loading deve aparecer novamente
   - Polling deve retomar
   - **Resultado esperado**: Após ~15-25s total, imagem aparece

### Teste 3: Verificar Logs

**Durante a geração, abrir**:
1. **Console do navegador** (F12 → Console)
2. **Logs do Vercel** (https://vercel.com → Projeto → Logs)

**Logs esperados**:

**Frontend** (Console do navegador):
```
🚀 Enviando requisição para API: { generationType: 'text2image', model: 'v2-quality', ... }
📥 Resposta da API completa: { ok: true, status: 'processing', taskId: 'nano-xxx' }
🔄 Polling taskId: nano-xxx | generationId: xxx
⏳ Tarefa ainda processando...
[após 20-30s]
📥 Resposta do polling: { ok: true, status: 'completed', hasImages: true, numImages: 1 }
✅ Imagens completadas! Dados completos: { ... }
📸 Adicionando imagens à UI: { numImages: 1, ids: [...] }
```

**Backend** (Logs do Vercel):
```
🔄 [ASYNC V2] ===== INÍCIO DA FUNÇÃO =====
🔄 [ASYNC V2] TaskId: nano-xxx
📤 [ASYNC V2] Enviando fetch para imagem 1...
📥 [ASYNC V2] Resposta recebida em 15s, status: 200
✅ [ASYNC V2] Base64 extraído, formato: png
📤 [ASYNC V2] Fazendo upload para Storage (imagem 1)...
✅ [ASYNC V2] Imagem 1/1 salva no Storage
📊 [ASYNC V2] Resultados: 1 sucessos, 0 falhas
✅ [ASYNC V2] 1/1 imagens geradas com sucesso
📤 [ASYNC V2] Atualizando banco com status 'completed'...
✅ [ASYNC V2] TaskId nano-xxx atualizado para completed com 1 imagens
✅ [ASYNC V2] ===== FIM DA FUNÇÃO (SUCESSO) =====
```

---

## ❌ Erros Comuns

### Erro 1: "API Key não configurada"
```
❌ [ASYNC V2] API Key configurada: false
```
**Solução**: Adicionar `LAOZHANG_API_KEY` nas variáveis de ambiente do Vercel.

### Erro 2: "Timeout"
```
❌ [ASYNC V2] Erro HTTP 504: Timeout
```
**Solução**: Já corrigido com timeout de 60s/90s.

### Erro 3: "Erro ao atualizar banco"
```
❌ [ASYNC V2] Erro ao atualizar para completed: { message: 'permission denied' }
```
**Solução**: Verificar se `SUPABASE_SERVICE_ROLE_KEY` está configurada (não é a ANON key!).

### Erro 4: "Polling não retorna completed"
```
⏳ [POLLING] Nano Banana ainda processando... (5min / 5min)
⏱️ [POLLING] Timeout detectado!
```
**Solução**: 
- Verificar logs do Vercel para ver por que a função assíncrona não completou
- Pode ser timeout na API da Laozhang

---

## 📝 Checklist de Debug

- [ ] Logs do Vercel mostram `🔄 [ASYNC V2] ===== INÍCIO DA FUNÇÃO =====`?
- [ ] Logs do Vercel mostram `✅ [ASYNC V2] TaskId xxx atualizado para completed`?
- [ ] Query no Supabase mostra `status = 'completed'` após geração?
- [ ] Query no Supabase mostra `image_urls` preenchido (não NULL)?
- [ ] Console do navegador mostra `📥 Resposta do polling: { status: 'completed' }`?
- [ ] Console do navegador mostra `✅ Imagens completadas!`?
- [ ] Imagem aparece na UI (card não fica em loading)?

Se TODOS os itens acima estiverem ✅, o problema está resolvido!

Se algum item estiver ❌, investigar aquele ponto específico.

---

**Data**: 23 de novembro de 2025  
**Status**: 🔧 Em Debug

