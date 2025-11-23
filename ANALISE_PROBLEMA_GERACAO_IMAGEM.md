# 🔍 ANÁLISE: Problema na Geração de Imagem com Referência

## 📋 Sintomas Relatados

1. **Clica em "Criar" e não consome créditos na API**
   - Botão não responde
   - Créditos não são deduzidos
   - Nenhuma imagem gerada

2. **Algumas consomem créditos mas não geram imagem**
   - Créditos são deduzidos
   - Imagem não aparece na galeria
   - Loading infinito ou nada acontece

## 🧠 ANÁLISE LÓGICA DO FLUXO

### Fluxo Esperado (Normal):

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (image-generator-client.tsx)                   │
├─────────────────────────────────────────────────────────┤
│ 1. User clica "Criar"                                   │
│ 2. handleGenerate() é chamado                           │
│ 3. Validações frontend:                                 │
│    ✓ Prompt não vazio?                                  │
│    ✓ < 4 gerações simultâneas?                          │
│    ✓ Créditos suficientes?                              │
│ 4. Deduz créditos localmente (otimista)                 │
│ 5. Cria placeholders (loading skeletons)                │
│ 6. Envia POST /api/generate-image                       │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND (app/api/generate-image/route.ts)               │
├─────────────────────────────────────────────────────────┤
│ 7. Validações backend:                                  │
│    ✓ Usuário autenticado?                               │
│    ✓ API Keys configuradas?                             │
│    ✓ Prompt válido?                                     │
│    ✓ Dimensões válidas?                                 │
│    ✓ Créditos suficientes no DB?                        │
│    ✓ Limite diário não excedido? (FREE)                 │
│    ✓ < 4 gerações simultâneas no DB?                    │
│ 8. ✅ DEDUZ CRÉDITOS DO DB                              │
│ 9. Inicia geração (assíncrona)                          │
│ 10. Retorna 200 OK { taskId, status: "processing" }     │
└─────────────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (recebe resposta)                              │
├─────────────────────────────────────────────────────────┤
│ 11. Adiciona taskId ao polling                          │
│ 12. Poll a cada 3s (check status)                       │
│ 13. Quando completar: remove placeholder                │
│ 14. Adiciona imagem real na galeria                     │
│ 15. ✅ SUCESSO!                                          │
└─────────────────────────────────────────────────────────┘
```

## 🔴 PROBLEMA 1: Clica e Não Consome Créditos

### Possíveis Causas:

#### A. **Validação Frontend Falhando ANTES do Request**

Checklist de validações que param o request:

```typescript
// LINHA 1080-1087: Prompt vazio?
if (!prompt.trim()) {
  Swal.fire({ title: 'Prompt vazio' });
  return; // ❌ PARA AQUI!
}

// LINHA 1090-1102: Limite de gerações simultâneas no frontend?
if (activeTasks.length >= 4) {
  Swal.fire({ title: 'Limite de gerações simultâneas' });
  return; // ❌ PARA AQUI!
}

// LINHA 1123-1133: Créditos insuficientes?
if (totalCredits < creditsNeeded) {
  Swal.fire({ title: 'Créditos insuficientes' });
  return; // ❌ PARA AQUI!
}
```

**Hipótese 1**: `activeTasks.length >= 4` está impedindo nova geração
- **Verificação**: Tem 4 ou mais imagens com loading (placeholders)?
- **Causa raiz**: Polling não está limpando tasks completadas
- **Solução**: Limpar activeTasks ao completar

**Hipótese 2**: `totalCredits < creditsNeeded` está bloqueando
- **Verificação**: Créditos mostrados no header < 10 (para V3)?
- **Causa raiz**: Créditos desatualizados no frontend
- **Solução**: Recarregar página ou revalidar créditos

#### B. **Request Falhando Silenciosamente**

```typescript
// LINHA 1189-1207: Request enviado
const response = await fetch('/api/generate-image', {
  method: 'POST',
  body: JSON.stringify({
    prompt, num, referenceImages, model, ...
  })
});
```

**Hipótese 3**: Request está dando erro 400/500 no backend
- **Causa**: Validação backend falhando ANTES de deduzir créditos
- **Verificação**: Verificar console do navegador (Network tab)
- **Logs**: Ver resposta da API no DevTools

**Possíveis erros backend que NÃO deduzem créditos:**

```typescript
// app/api/generate-image/route.ts

// LINHA 258-260: Usuário não autenticado?
if (userError || !user?.email) {
  return 401; // ❌ Sem deduzir créditos
}

// LINHA 313: Prompt vazio?
if (!prompt || prompt.trim().length === 0) {
  return 400; // ❌ Sem deduzir créditos
}

// LINHA 382-391: Limite simultâneo no DB?
if (processingCount >= 4) {
  return 429; // ❌ Sem deduzir créditos
}

// LINHA 395-399: Dimensões inválidas?
if (width % 16 !== 0 || height % 16 !== 0) {
  return 400; // ❌ Sem deduzir créditos
}

// LINHA 493-502: Créditos insuficientes no DB?
if (totalCredits < creditsNeeded) {
  return 402; // ❌ Sem deduzir créditos
}

// LINHA 539-548: Limite diário atingido (FREE)?
if (totalImagesGenerated >= dailyLimit) {
  return 429; // ❌ Sem deduzir créditos
}
```

#### C. **maxDuration = 300s Incompatível com Vercel Free**

**CRÍTICO**: 

```typescript
// app/api/generate-image/route.ts - LINHA 16
export const maxDuration = 300; // 5 minutos
```

**Problema**: 
- **Vercel Free Plan**: máximo 10s de execução
- **Vercel Hobby Plan**: máximo 10s de execução
- **Vercel Pro Plan**: máximo 300s de execução

**Se você está no Vercel Free/Hobby:**
- ❌ Request falha com erro 504 (Gateway Timeout)
- ❌ Função é terminada após 10s
- ❌ Créditos NÃO são deduzidos (request nem chega ao código)
- ❌ Nada é salvo no banco

**Verificação**:
1. Abra Vercel Dashboard
2. Vá em Settings → General → Plan
3. Se for "Hobby" ou "Free": **ESTE É O PROBLEMA!**

**Solução**:
```typescript
export const maxDuration = 10; // ⚠️ Para Vercel Free/Hobby
// OU
export const maxDuration = 60; // Para Vercel Pro (sem Edge Runtime)
```

## 🟡 PROBLEMA 2: Consome Créditos Mas Não Gera Imagem

### Análise:

**Se créditos foram deduzidos** = Request chegou no backend após LINHA 566-582

```typescript
// LINHA 566-582: Dedução de créditos
const { error: updateError } = await supabase
  .from('emails')
  .update({
    creditos: newCreditos,
    creditos_extras: newCreditosExtras,
  })
  .eq('email', userEmail);

// ✅ Se chegou aqui, créditos foram deduzidos!
```

### Possíveis Causas:

#### A. **Função Vercel Morre Antes de Completar (maxDuration)**

**Cenário**:
1. Request chega → Créditos deduzidos (linha 566-582)
2. Geração inicia em background (linha 615-877)
3. **Vercel mata função em 10s** (Hobby/Free) ou 60s (Pro sem configuração)
4. Promise assíncrona **nunca completa**
5. DB fica "processing" para sempre
6. Frontend faz polling infinitamente

**Sintoma**: Imagem fica "processando" indefinidamente

**Verificação**:
- Ver logs da Vercel (Dashboard → Logs)
- Procurar por: "Function execution timeout" ou "504"

**Solução**:
1. **Se Vercel Free/Hobby**: Reduzir `maxDuration` para 10s
2. **Se Vercel Pro**: Manter 300s (OK)
3. **Alternativa**: Usar Edge Runtime (sem maxDuration, mas sem Node APIs)

#### B. **Geração Falhando Silenciosamente**

**Cenário**:
1. Geração inicia (linha 615)
2. API externa (Gemini/Laozhang) falha
3. Catch block (linha 828-876) marca como "failed"
4. **MAS** polling pode não detectar

**Verificação**:
```sql
-- Ver gerações que falharam
SELECT * FROM generated_images 
WHERE user_email = 'seu@email.com' 
  AND status = 'failed'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Causas comuns de falha**:
- Timeout na API (>180s)
- API Key inválida
- Safety filter bloqueou conteúdo
- Payload muito grande (imagens de ref)

#### C. **Polling Não Está Funcionando**

**Cenário**:
1. Geração completa com sucesso
2. DB atualizado para "completed"
3. **MAS** frontend não faz polling OU polling falha

**Verificação frontend**:
```typescript
// LINHA 263: pollTaskStatus é chamado?
const pollTaskStatus = useCallback(async (taskId, generationId, placeholderIds) => {
  // ...
});

// LINHA 670-690: useEffect de polling
useEffect(() => {
  if (activeTasks.length === 0) return; // ❌ Se activeTasks vazio, não faz polling!
  
  const interval = setInterval(() => {
    activeTasks.forEach((task) => {
      pollTaskStatus(task.taskId, task.generationId, task.placeholderIds);
    });
  }, 3000);
  
  return () => clearInterval(interval);
}, [activeTasks, pollTaskStatus]);
```

**Problema**: Se `activeTasks` estiver vazio, polling não roda!

**Causa**: Task não foi adicionada ao `activeTasks` (linha 1349-1357)

#### D. **Imagem Gerada Mas Não Aparece na UI**

**Cenário**:
1. Geração OK
2. Polling OK
3. **MAS** imagem não é adicionada à galeria

**Verificação**:
```typescript
// LINHA 279-327: pollTaskStatus quando completa
if (data.status === 'completed' && data.images) {
  // Adicionar imagens
  const newImages = data.images.map(...);
  setImages((prev) => [...newImages, ...prev]); // ✅ Aqui adiciona na UI
  
  // Remove placeholders
  setImages((prev) => prev.filter((img) => !placeholderIds.includes(img.id)));
}
```

**Possível bug**: Se `data.images` estiver vazio ou undefined, não adiciona nada!

## 🎯 SOLUÇÃO ESTRUTURADA

### Passo 1: Verificar Plano da Vercel

```bash
# Verificar no dashboard ou via CLI
vercel project ls
```

**Se for Free/Hobby**:
```typescript
// app/api/generate-image/route.ts
export const maxDuration = 10; // Máximo para Free/Hobby
```

**Impacto**: Gerações V2/V3 **não funcionarão** (demoram 30-180s)

**Alternativa**: 
- Fazer upgrade para Vercel Pro ($20/mês)
- OU usar apenas V1 Fast (<10s)

### Passo 2: Adicionar Logs Detalhados

```typescript
// app/image-generator/image-generator-client.tsx - LINHA 1079
const handleGenerate = async () => {
  console.log('🚀 [GENERATE] Iniciando geração:', {
    prompt: prompt.substring(0, 50),
    model: selectedModel.id,
    numImages,
    referenceImages: referenceImages.length,
    totalCredits: profile.credits + profile.extraCredits,
    activeTasks: activeTasks.length,
  });
  
  // ... resto do código ...
  
  // ANTES do fetch
  console.log('📤 [GENERATE] Enviando request...');
  const response = await fetch('/api/generate-image', ...);
  
  console.log('📥 [GENERATE] Resposta recebida:', {
    ok: response.ok,
    status: response.status,
    data: await response.clone().json(),
  });
};
```

### Passo 3: Verificar activeTasks

```typescript
// Adicionar log no useEffect de polling
useEffect(() => {
  console.log('🔄 [POLLING] activeTasks:', {
    count: activeTasks.length,
    tasks: activeTasks.map(t => ({ taskId: t.taskId, status: t.status })),
  });
  
  if (activeTasks.length === 0) {
    console.log('⚠️ [POLLING] Nenhuma task ativa - polling desabilitado');
    return;
  }
  
  // ... resto do código ...
}, [activeTasks, pollTaskStatus]);
```

### Passo 4: Adicionar Timeout de Segurança

```typescript
// app/api/generate-image/polling/route.ts - LINHA 96
// Reduzir de 3.5min para 2min (mais seguro)
const TIMEOUT_MINUTES = 2; // 2 minutos (para Vercel Pro)

// OU para Free/Hobby:
const TIMEOUT_MINUTES = 0.5; // 30 segundos
```

## 🧪 CHECKLIST DE VERIFICAÇÃO

### Frontend (Navegador):

- [ ] Console mostra `🚀 [GENERATE] Iniciando geração`?
  - ❌ NÃO: Validação frontend está bloqueando
  - ✅ SIM: Request está sendo enviado

- [ ] Console mostra `📤 [GENERATE] Enviando request...`?
  - ❌ NÃO: Erro antes do fetch
  - ✅ SIM: Fetch foi chamado

- [ ] Console mostra `📥 [GENERATE] Resposta recebida`?
  - ❌ NÃO: Request falhou (ver Network tab)
  - ✅ SIM: Response chegou

- [ ] Network tab mostra status 200?
  - ❌ NÃO: Ver status (400/401/429/500/504)
  - ✅ SIM: Backend processou OK

- [ ] Response tem `taskId` e `status: "processing"`?
  - ❌ NÃO: Problema no backend
  - ✅ SIM: Geração iniciada

- [ ] `activeTasks.length > 0` após request?
  - ❌ NÃO: Task não foi adicionada ao polling
  - ✅ SIM: Polling ativo

- [ ] Console mostra `🔄 [POLLING] activeTasks`?
  - ❌ NÃO: useEffect de polling não está rodando
  - ✅ SIM: Polling funcionando

### Backend (Vercel Logs):

- [ ] Logs mostram `📸 [POST /api/generate-image] Iniciando geração`?
  - ❌ NÃO: Request não chegou no backend
  - ✅ SIM: Backend recebeu request

- [ ] Logs mostram `✅ Créditos deduzidos`?
  - ❌ NÃO: Falhou antes de deduzir (validação)
  - ✅ SIM: Créditos foram deduzidos

- [ ] Logs mostram `🔄 [V3 ASYNC] Gerando...`?
  - ❌ NÃO: Geração não iniciou
  - ✅ SIM: Geração em andamento

- [ ] Logs mostram `✅ [V3 ASYNC] TODAS X imagens geradas`?
  - ❌ NÃO: Geração falhou ou timeout
  - ✅ SIM: Geração completou

- [ ] Logs mostram `Function execution timeout` ou `504`?
  - ✅ SIM: **maxDuration incompatível!** (Problema encontrado!)
  - ❌ NÃO: maxDuration OK

### Banco de Dados:

```sql
-- Ver última geração do usuário
SELECT 
  id,
  task_id,
  status,
  model,
  num_images,
  credits_used,
  created_at,
  completed_at,
  updated_at
FROM generated_images
WHERE user_email = 'seu@email.com'
ORDER BY created_at DESC
LIMIT 5;
```

**Status esperado**:
- `processing` → Em andamento (< 3min)
- `completed` → Sucesso
- `failed` → Erro (créditos reembolsados)

**Se ficar `processing` > 5min**: 
- Geração travou (timeout da Vercel)
- Polling vai marcar como `failed` automaticamente

## 🎯 DIAGNÓSTICO MAIS PROVÁVEL

Baseado nos sintomas:

### 🔴 Problema 1: "Clica e não consome créditos"

**Causa mais provável**: 
- `maxDuration = 300` incompatível com Vercel Free/Hobby
- Request retorna 504 antes de chegar ao código
- Créditos não são deduzidos

**Solução**:
1. Reduzir `maxDuration` para 10s
2. OU fazer upgrade para Vercel Pro

### 🟡 Problema 2: "Consome mas não gera"

**Causa mais provável**:
- Função Vercel morre após deduzir créditos mas antes de completar
- DB fica "processing"
- Polling detecta timeout após 2-3.5min e reembolsa

**Solução**:
1. Mesma do problema 1 (maxDuration)
2. Reduzir timeout do polling para 2min

## 📝 PRÓXIMOS PASSOS

1. **URGENTE**: Verificar plano da Vercel
2. **CRÍTICO**: Ajustar maxDuration baseado no plano
3. **IMPORTANTE**: Adicionar logs detalhados
4. **RECOMENDADO**: Testar com V1 Fast (<10s) primeiro
5. **OPCIONAL**: Fazer upgrade para Vercel Pro se precisar V2/V3

---

**Data**: 23 de novembro de 2025  
**Status**: 🔍 **ANÁLISE COMPLETA**  
**Próximo**: Verificar plano Vercel + Ajustar maxDuration

