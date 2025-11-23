# 🐛 PROBLEMA: Vídeo gerando trava geração de imagem

## 📋 **Problema Reportado:**

Quando um vídeo está gerando, a geração de imagem também fica travada/demorando.

---

## 🔍 **Possíveis Causas:**

### **1. Moderação de Conteúdo Sequencial** ⚠️ PROVÁVEL
```typescript
// ANTES (problema):
Vídeo: moderação (2s) + geração (30s) = 32s
Imagem: espera vídeo terminar moderação...

// O que acontece:
1. Usuário gera vídeo → Moderação GPT-4o (2s)
2. Usuário gera imagem → Moderação ESPERA?
```

**Solução:** As APIs são independentes, não deveriam esperar!

### **2. Rate Limit Compartilhado** ❌ NÃO É
```typescript
Rate limiters são separados:
- 'sora-2': 120 req/min (vídeo)
- 'gpt-image-1': 45 req/min (imagem)

✅ São independentes! Não é rate limit.
```

### **3. API Key OpenAI Compartilhada** ⚠️ POSSÍVEL
```typescript
// TODAS as requisições usam a mesma OPENAI_API_KEY:
- Moderação de vídeo
- Moderação de imagem  
- Geração de imagem (v2-quality)
- GPT-4o Vision (celebridades)

Se OpenAI tem rate limit interno → pode travar!
```

### **4. Servidor Sobrecarregado** ❌ IMPROVÁVEL
Vídeo e imagem são APIs externas, não deveria sobrecarregar.

---

## 🎯 **CAUSA MAIS PROVÁVEL:**

**OpenAI está processando múltiplas requisições simultâneas:**
```
1. Vídeo inicia → Chama moderação API
2. Imagem inicia → Chama moderação API
3. OpenAI processa sequencialmente por conta (não por modelo)
4. Imagem espera vídeo terminar
```

---

## ✅ **SOLUÇÕES:**

### **Solução 1: Remover moderação de conteúdo (mais rápido)**
```typescript
// Vantagem: Sem delays
// Desvantagem: Perde proteção contra conteúdo explícito
```

### **Solução 2: Fazer moderação em paralelo (assíncrona)**
```typescript
// Não esperar a moderação terminar
// Gera o vídeo/imagem e modera depois
// Se detectar problema, cancela
```

### **Solução 3: Cache de moderação**
```typescript
// Se mesmo prompt já foi moderado, usar cache
// Evita chamadas repetidas à API
```

### **Solução 4: Aumentar timeout da moderação**
```typescript
// Se moderação demorar > 5s, continuar sem bloquear
// Fail-safe: não travar a experiência do usuário
```

---

## 🚀 **SOLUÇÃO RECOMENDADA: Timeout + Fail-Safe**

Vou adicionar timeout na moderação:

```typescript
// Se moderação demorar > 3 segundos, continuar
const moderationPromise = moderatePrompt(prompt);
const timeoutPromise = new Promise((resolve) => 
  setTimeout(() => resolve({ flagged: false }), 3000)
);

const result = await Promise.race([moderationPromise, timeoutPromise]);
```

---

## 💡 **O QUE FAZER AGORA:**

Quer que eu:
1. ✅ **Adicione timeout na moderação** (3s máximo)
2. ✅ **Torne moderação opcional** (se falhar, continua)
3. ❌ **Remova moderação** (volta como antes)

Qual opção você prefere?

