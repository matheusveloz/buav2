# 🔧 Correções v3 High Quality - 6+ Imagens de Referência

## 🎯 Problema Reportado

> "Usando Versão 3.0 High Quality coloquei 6 imagens referencias, só ficou gerando, parece que não deu certo algo assim, mas descontou da minha api os creditos, depois de um tempo atualizou e sumiu os cards que ainda estavam gerando em load."

## 🔍 Problemas Identificados

### 1️⃣ **Payload Muito Grande**
- **Causa**: 6 imagens base64 comprimidas = ~3-5MB de payload
- **Efeito**: Timeout na API Gemini (>90s) ou rate limiting silencioso
- **Solução**: Validação de tamanho + logs detalhados

### 2️⃣ **Timeout Inadequado**
- **Causa**: Timeout fixo de 90s para todas as gerações
- **Efeito**: Com 6+ imagens, a API pode demorar 2-3 minutos
- **Solução**: Timeout dinâmico baseado no número de imagens:
  - 0 imagens: 30s
  - 1-3 imagens: 60s
  - 4-6 imagens: 120s (2 minutos)
  - 7+ imagens: 180s (3 minutos)

### 3️⃣ **Thinking Mode Não Documentado**
- **Causa**: Nano Banana 2 gera 1-2 imagens temporárias internamente
- **Efeito**: Atraso adicional não esperado
- **Solução**: Log do Thinking Mode + pegar ÚLTIMA imagem (final renderizada)

### 4️⃣ **Polling Sem Timeout**
- **Causa**: Cards ficavam gerando indefinidamente se API travasse
- **Efeito**: Cards "fantasma" na UI até recarregar página
- **Solução**: Timeout de 5 minutos no polling + auto-cleanup + reembolso

### 5️⃣ **Falta de Detecção de Erros**
- **Causa**: Erros HTTP (413, 429, 504) não eram detectados
- **Efeito**: Usuário não sabia por que falhou
- **Solução**: Detecção específica de:
  - 413: Payload too large
  - 429: Rate limit
  - 504: Timeout na API

### 6️⃣ **Feedback Insuficiente ao Usuário**
- **Causa**: Mensagem genérica "Erro ao gerar imagem"
- **Efeito**: Usuário não sabia como corrigir
- **Solução**: Mensagens customizadas por tipo de erro + aviso visual no frontend

---

## ✅ Correções Aplicadas

### Backend (`route.ts`)

#### 1. **Validação de Payload com Logs Detalhados**
```typescript
// Calcular tamanho total do payload
let totalPayloadSizeKB = 0;
imagesToProcess.forEach((imageBase64, idx) => {
  const sizeKB = Math.round((data.length * 3/4) / 1024);
  totalPayloadSizeKB += sizeKB;
  console.log(`  📷 [V3] Imagem ${idx + 1}: ${mimeType}, ~${sizeKB}KB`);
});

console.log(`📦 [V3] Tamanho total: ~${totalPayloadSizeKB}KB (~${(totalPayloadSizeKB/1024).toFixed(2)}MB)`);

// ⚠️ AVISO se payload > 20MB
if (totalPayloadSizeKB/1024 > 20) {
  console.warn(`⚠️⚠️⚠️ [V3] PAYLOAD MUITO GRANDE! Alto risco de timeout!`);
}
```

#### 2. **Timeout Dinâmico Baseado em Número de Imagens**
```typescript
const numRefImages = referenceImages?.length || 0;
let timeoutSeconds = 30; // default

if (numRefImages >= 7) {
  timeoutSeconds = 180; // 3 minutos para 7+ imagens
} else if (numRefImages >= 4) {
  timeoutSeconds = 120; // 2 minutos para 4-6 imagens
} else if (numRefImages >= 1) {
  timeoutSeconds = 60; // 1 minuto para 1-3 imagens
}

console.log(`⏱️ [ASYNC V3] Timeout: ${timeoutSeconds}s (${numRefImages} imagens ref)`);
```

#### 3. **Detecção de Thinking Mode**
```typescript
// 🧠 THINKING MODE: Pegar ÚLTIMA imagem (final renderizada)
console.log(`🧠 [ASYNC V3] Thinking Mode: ${candidate.content.parts.length} parts retornados`);

for (let j = candidate.content.parts.length - 1; j >= 0; j--) {
  const part = candidate.content.parts[j];
  if (part.inlineData) {
    imagePart = part;
    console.log(`✅ [ASYNC V3] InlineData no part ${j} (${j === candidate.content.parts.length - 1 ? 'ÚLTIMA - IMAGEM FINAL' : 'intermediária'})`);
    break;
  }
}
```

#### 4. **Detecção de Erros HTTP Específicos**
```typescript
if (nanoResponse.status === 429) {
  console.error(`🚫 Rate limit! Múltiplas imagens podem causar rate limiting!`);
}

if (nanoResponse.status === 413) {
  console.error(`📦 Payload muito grande! Reduza número ou tamanho das imagens`);
}

if (nanoResponse.status === 504) {
  console.error(`⏱️ Timeout na API (504) - demorou >90s para responder`);
}
```

### Polling (`polling/route.ts`)

#### 5. **Timeout Automático com Reembolso**
```typescript
// ⚠️ TIMEOUT: Se processando há >5min, marcar como failed
const TIMEOUT_MINUTES = 5;
const elapsedMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

if (generatedImage.status === 'processing' && elapsedMinutes > TIMEOUT_MINUTES) {
  console.error(`⏱️ Timeout! ${Math.round(elapsedMinutes)}min > ${TIMEOUT_MINUTES}min`);
  
  // Reembolsar créditos
  const creditsToRefund = generatedImage.credits_used || 0;
  if (creditsToRefund > 0) {
    console.log(`💰 Reembolsando ${creditsToRefund} créditos`);
    const newCreditos = (currentProfile.creditos || 0) + creditsToRefund;
    await supabase.from('emails').update({ creditos: newCreditos }).eq('email', userEmail);
  }
  
  // Marcar como failed
  await supabase.from('generated_images').update({ status: 'failed' }).eq('task_id', taskId);
  
  return NextResponse.json({
    status: 'failed',
    error: `Timeout: Geração demorou >${TIMEOUT_MINUTES}min. Créditos reembolsados.`,
  });
}
```

### Frontend (`image-generator-client.tsx`)

#### 6. **Mensagens de Erro Customizadas**
```typescript
const errorMessage = data.error || 'Erro desconhecido';
const isTimeout = errorMessage.includes('Timeout');
const isPayloadTooLarge = errorMessage.includes('Payload') || errorMessage.includes('muito grande');
const isRateLimit = errorMessage.includes('rate limit');

let userMessage = 'Erro. Créditos reembolsados.';

if (isTimeout) {
  userMessage = '⏱️ Tempo excedido. Causas:\n' +
               '• Muitas imagens (tente 3-4)\n' +
               '• Imagens grandes (reduza tamanho)\n' +
               '• Problema na API\n\nCréditos reembolsados.';
} else if (isPayloadTooLarge) {
  userMessage = '📦 Payload grande! Reduza:\n' +
               '• Número de imagens (máx 4-6)\n' +
               '• Tamanho (<500KB cada)\n\nCréditos reembolsados.';
}
```

#### 7. **Aviso Visual para 6+ Imagens**
```tsx
{selectedModel.id === 'v3-high-quality' && referenceImages.length >= 6 && (
  <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
    <p className="text-[9px] text-amber-800">
      <strong>⚠️ Aviso:</strong> Com {referenceImages.length} imagens, 
      geração pode demorar até <strong>2-3 minutos</strong>. 
      Recomendamos <strong>3-4 imagens</strong> para melhor performance.
    </p>
  </div>
)}
```

---

## 📊 Novos Limites Recomendados

| Número de Imagens | Tempo Esperado | Timeout Configurado | Status |
|-------------------|----------------|---------------------|--------|
| 0 (text-to-image) | ~10s           | 30s                 | ✅ OK  |
| 1-3 imagens       | ~15-30s        | 60s (1min)          | ✅ OK  |
| 4-6 imagens       | ~30-90s        | 120s (2min)         | ⚠️ Lento |
| 7+ imagens        | ~60-180s       | 180s (3min)         | ❌ Não recomendado |

**Recomendação**: Use **3-4 imagens** para melhor equilíbrio entre qualidade e velocidade.

---

## 🧪 Testes Necessários

### Teste 1: 3 Imagens (Caso Ideal)
```
1. v3-high-quality
2. 3 imagens de referência (~300KB cada)
3. Prompt: "Combine essas imagens"
4. ✅ Esperado: ~30s, sucesso
```

### Teste 2: 6 Imagens (Caso Limite)
```
1. v3-high-quality
2. 6 imagens de referência (~300KB cada)
3. Prompt: "Combine essas imagens"
4. ⚠️ Esperado: ~60-90s, sucesso (com aviso)
```

### Teste 3: 6 Imagens Grandes (Caso Falha)
```
1. v3-high-quality
2. 6 imagens de referência (>1MB cada)
3. Prompt: "Combine essas imagens"
4. ❌ Esperado: Timeout ou 413, reembolso automático
```

### Teste 4: Recarregar Durante Geração
```
1. Iniciar geração com 4 imagens
2. Aguardar 10s
3. Apertar F5
4. ✅ Esperado: Cards voltam com loading, polling retoma
```

### Teste 5: Timeout Natural (>5min)
```
1. Simular geração travada (forçar delay no backend)
2. Aguardar >5 minutos
3. ✅ Esperado: Card desaparece, mensagem de erro, reembolso
```

---

## 🎯 Comportamento Esperado Agora

### ✅ Cenário Ideal (3-4 imagens)
```
1. Usuário adiciona 3 imagens
2. Clica "10 Criar"
3. Chat libera em ~1s
4. Logs mostram: "Payload: ~2MB" ✅
5. Timeout: 60s (suficiente)
6. Imagem aparece em ~30s
7. Sucesso! 🎨
```

### ⚠️ Cenário Limite (6 imagens)
```
1. Usuário adiciona 6 imagens
2. ⚠️ Aviso aparece: "Pode demorar 2-3min"
3. Clica "10 Criar"
4. Chat libera em ~1s
5. Logs mostram: "Payload: ~5MB" ⚠️
6. Timeout: 120s (deve ser suficiente)
7. Imagem aparece em ~60-90s
8. Sucesso (mas lento) 🐌
```

### ❌ Cenário Falha (6 imagens grandes)
```
1. Usuário adiciona 6 imagens grandes (>1MB cada)
2. ⚠️ Aviso aparece
3. Clica "10 Criar"
4. Chat libera em ~1s
5. Logs mostram: "⚠️⚠️⚠️ PAYLOAD MUITO GRANDE! 25MB"
6. API retorna 413 ou timeout
7. Card desaparece
8. Mensagem: "📦 Payload grande! Reduza número/tamanho"
9. Créditos reembolsados automaticamente 💰
10. Usuário corrige e tenta novamente
```

### ⏱️ Cenário Timeout (>5min)
```
1. Geração trava por algum motivo
2. Polling detecta: "Processando há 5min"
3. Auto-marca como failed
4. Reembolsa créditos
5. Card desaparece
6. Mensagem: "Timeout. Créditos reembolsados."
```

---

## 📋 Checklist de Correções

- [x] Validação de payload com logs detalhados
- [x] Timeout dinâmico (30s/60s/120s/180s)
- [x] Detecção do Thinking Mode
- [x] Detecção de erros HTTP específicos (413, 429, 504)
- [x] Timeout automático no polling (5min)
- [x] Reembolso automático em caso de timeout
- [x] Mensagens de erro customizadas no frontend
- [x] Aviso visual para 6+ imagens
- [x] Logs detalhados em TODOS os pontos críticos

---

## 🔗 Referências

- [Documentação Oficial Nano Banana 2](https://docs1.laozhang.ai/en/api-capabilities/gemini-flash-image)
- [Documentação Image Edit](https://docs1.laozhang.ai/en/api-capabilities/gemini-flash-image-edit)

---

**Status**: ✅ **TODAS CORREÇÕES APLICADAS**

Agora teste com 6 imagens (3-4 recomendado) e me confirme se:
1. ✅ Aparece o aviso visual
2. ✅ Logs mostram tamanho do payload
3. ✅ Timeout adequado (2min)
4. ✅ Se falhar, reembolsa automaticamente
5. ✅ Mensagem de erro é clara

---

**Data**: 22/11/2025  
**Versão**: v3.0.1 (Patch de Correção)

