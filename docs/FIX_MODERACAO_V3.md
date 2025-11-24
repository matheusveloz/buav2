# 🔧 FIX: Moderação Versão 3.0 para v3-high-quality

## 🐛 Problema Identificado

O image generator client estava enviando `version: '3.0'` ao usar o modelo `v3-high-quality`, mas a API `/api/moderate-image` só aceitava versões `'1.0'` ou `'2.0'`, causando erro **400 Bad Request** e bloqueando completamente o upload de imagens de referência para o modelo v3.

### Erro Original:
```
POST /api/moderate-image
Body: { imageBase64: "...", version: "3.0" }
Response: 400 - "Versão inválida"
```

---

## ✅ Solução Implementada

### 1. **Adicionada Função `shouldBlockBuua30()`**
Arquivo: `lib/celebrity-detection-gpt.ts`

```typescript
export function shouldBlockBuua30(result: CelebrityDetectionResult): boolean {
  // 🚫 APENAS bloquear nudez explícita (genitais expostos, nudez completa)
  if (result.hasNudity) {
    console.log(`🚫 BUUA 3.0: Bloqueando nudez explícita`);
    return true;
  }

  // 🚫 Bloquear conteúdo obsceno/violento extremo
  if (result.hasObscene) {
    console.log(`🚫 BUUA 3.0: Bloqueando conteúdo obsceno/violento`);
    return true;
  }

  // ✅ Permitir tudo o resto
  console.log(`✅ BUUA 3.0: Conteúdo permitido (regras flexíveis)`);
  return false;
}
```

### 2. **Adicionada Função `getBlockMessageBuua30()`**
Arquivo: `lib/celebrity-detection-gpt.ts`

Retorna mensagens amigáveis específicas para a versão 3.0, explicando o que é permitido e o que não é.

### 3. **API Atualizada para Aceitar '3.0'**
Arquivo: `app/api/moderate-image/route.ts`

**Antes:**
```typescript
version: '1.0' | '2.0'
if (version !== '1.0' && version !== '2.0') {
  return NextResponse.json({ error: 'Versão inválida' }, { status: 400 });
}
```

**Depois:**
```typescript
version: '1.0' | '2.0' | '3.0'
if (version !== '1.0' && version !== '2.0' && version !== '3.0') {
  return NextResponse.json({ error: 'Versão inválida (aceito: 1.0, 2.0, 3.0)' }, { status: 400 });
}
```

### 4. **Lógica de Moderação para v3.0**
Arquivo: `app/api/moderate-image/route.ts`

```typescript
else if (version === '3.0') {
  // Versão 3.0: Mais flexível - apenas bloqueia nudez explícita e conteúdo obsceno
  isBlocked = shouldBlockBuua30(detectionResult);
  blockMessage = getBlockMessageBuua30(detectionResult);
  
  if (detectionResult.hasNudity) {
    blockReason = 'nudity';
  } else if (detectionResult.hasObscene) {
    blockReason = 'obscene';
  }
}
```

---

## 📊 Comparação de Versões

| Feature | v1.0 (Legado) | v2.0 (High) | v3.0 (v2/v3 Quality) |
|---------|---------------|-------------|----------------------|
| **Rostos reais** | 🚫 Bloqueado | ✅ Permitido | ✅ Permitido |
| **Pessoas comuns** | 🚫 Bloqueado | ✅ Permitido | ✅ Permitido |
| **Crianças (vestidas)** | 🚫 Bloqueado | 🚫 Bloqueado | ✅ **PERMITIDO** |
| **Celebridades (vestidas)** | 🚫 Bloqueado | 🚫 Bloqueado | ✅ **PERMITIDO** |
| **Biquini/Maiô** | 🚫 Bloqueado | 🚫 Bloqueado | ✅ **PERMITIDO** |
| **Nudez explícita** | 🚫 Bloqueado | 🚫 Bloqueado | 🚫 Bloqueado |
| **Conteúdo obsceno** | 🚫 Bloqueado | 🚫 Bloqueado | 🚫 Bloqueado |

---

## 🎯 Regras de Moderação v3.0

### ✅ **Permitido:**
- Pessoas comuns (adultos e crianças)
- Celebridades **com roupas**
- Crianças **com roupas**
- Roupas de banho (biquini, maiô, sunga)
- Roupas esportivas
- Fotos de família
- Selfies
- Avatares realistas

### 🚫 **Bloqueado:**
- **Nudez explícita** (genitais expostos, nudez completa)
- **Conteúdo obsceno/violento** (gore, sangue extremo, violência gráfica)

---

## 🚀 Impacto

### Antes da Correção:
- ❌ Usuários **não conseguiam** fazer upload de imagens para v2-quality e v3-high-quality
- ❌ Erro 400 bloqueava completamente a feature
- ❌ Logs mostravam: "Versão inválida"

### Depois da Correção:
- ✅ Upload de imagens funciona normalmente para v2/v3 models
- ✅ Moderação mais flexível e adequada para modelos high-quality
- ✅ Usuários podem usar referências com pessoas, crianças (vestidas), celebridades (vestidas)
- ✅ Apenas nudez explícita e conteúdo obsceno são bloqueados

---

## 🧪 Como Testar

### Teste 1: Upload de Imagem Permitida (v3.0)
```bash
POST /api/moderate-image
Body: {
  "imageBase64": "data:image/jpeg;base64,...", // Foto de pessoa com roupa
  "version": "3.0"
}

Esperado: 
{
  "allowed": true,
  "blocked": false,
  "message": "✅ Imagem aprovada! Pode continuar."
}
```

### Teste 2: Upload de Nudez (v3.0 - Deve Bloquear)
```bash
POST /api/moderate-image
Body: {
  "imageBase64": "data:image/jpeg;base64,...", // Imagem com nudez
  "version": "3.0"
}

Esperado: 
{
  "allowed": false,
  "blocked": true,
  "reason": "nudity",
  "message": "🚫 Nudez Explícita Detectada..."
}
```

### Teste 3: Upload no Image Generator (v3-high-quality)
1. Abrir image generator
2. Selecionar modelo `v3-high-quality`
3. Fazer upload de uma foto de pessoa (com roupa)
4. ✅ **Esperado:** Imagem aprovada, upload bem-sucedido
5. ❌ **Antes:** Erro 400 - "Versão inválida"

---

## 📝 Arquivos Modificados

1. ✅ `lib/celebrity-detection-gpt.ts`
   - Adicionado `shouldBlockBuua30()`
   - Adicionado `getBlockMessageBuua30()`

2. ✅ `app/api/moderate-image/route.ts`
   - Tipo atualizado para aceitar `'3.0'`
   - Validação atualizada
   - Lógica de moderação para v3.0 adicionada

---

## 🎉 Status

✅ **BUG CORRIGIDO**

Usuários agora podem fazer upload de imagens de referência para os modelos `v2-quality` e `v3-high-quality` sem erros!

---

**Data:** 24/11/2025  
**Issue:** v3.0 moderation version não era suportada pela API  
**Fix:** Adicionadas funções de moderação v3.0 e atualizada validação da API


