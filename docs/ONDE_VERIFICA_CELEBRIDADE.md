# 📍 ONDE A VERIFICAÇÃO ACONTECE

## 🔍 **Localização Exata:**

### **Arquivo:** `app/api/generate-video/veo/route.ts`
### **Linhas:** 145-179
### **Momento:** ANTES de chamar a API de vídeo

---

## 📊 **FLUXO COMPLETO:**

```
1. Usuário faz upload de imagem
   ↓
2. Frontend envia para: POST /api/generate-video/veo
   ↓
3. ✅ Usuário autenticado?
   ↓
4. 📋 Parse do body (prompt + imageBase64)
   ↓
5. 🔍 TEM IMAGEM? (linha 146)
   ↓
   SIM → VERIFICAÇÃO GPT-4o (linhas 145-179) ⭐ AQUI!
   |      ↓
   |      GPT-4o analisa imagem (~2 segundos)
   |      ↓
   |      É celebridade/criança?
   |      ↓
   |      SIM → 🚫 BLOQUEIA e retorna erro (linha 162)
   |      NÃO → ✅ Continua
   ↓
6. ✅ Verifica créditos
   ↓
7. 💰 Deduz créditos
   ↓
8. 🎬 Chama API Veo (gasta $0.25)
   ↓
9. ✅ Retorna vídeo
```

---

## 💡 **Por que ANTES da API?**

### **❌ Se verificasse DEPOIS:**
```
Usuário → API Veo ($0.25 gasto) → Erro → Reembolso
Prejuízo: $0.25
```

### **✅ Verificando ANTES (atual):**
```
Usuário → GPT-4o ($0.0004) → Detecta → Bloqueia
Economia: $0.2496 (99.8%)
```

---

## 📝 **CÓDIGO EXATO:**

### **app/api/generate-video/veo/route.ts (linha 145-179)**

```typescript
// Parse do body
const body: GenerateVideoVeoRequest = await request.json();
const { prompt, imageBase64 } = body;

// 🔍 VERIFICAR CELEBRIDADES/CRIANÇAS NA IMAGEM (se houver imagem)
if (imageBase64) {
  try {
    console.log('🔍 Analisando imagem com GPT-4o Vision...');
    
    // Importa funções de detecção
    const { 
      detectCelebrityWithGPT,    // Chama GPT-4o
      shouldBlockGeneration,      // Decide se bloqueia
      getBlockMessage             // Mensagem de erro
    } = await import('@/lib/celebrity-detection-gpt');
    
    // Chama GPT-4o para analisar a imagem
    const detectionResult = await detectCelebrityWithGPT(imageBase64);
    
    // Se detectou celebridade/criança, BLOQUEIA
    if (shouldBlockGeneration(detectionResult)) {
      console.warn(`🚫 BLOQUEIO ATIVADO por GPT-4o:`, {
        isCelebrity: detectionResult.isCelebrity,
        isChild: detectionResult.isChild,
        name: detectionResult.name,
      });
      
      // RETORNA ERRO 400 (não continua!)
      return NextResponse.json({
        error: '🚫 Celebridade Detectada',
        details: getBlockMessage(detectionResult),
        celebrity: detectionResult.name,
        prohibited: true,
      }, { status: 400 });
    }
    
    console.log(`✅ Imagem aprovada por GPT-4o`);
  } catch (error) {
    console.error('⚠️ Erro na detecção GPT-4o (continuando):', error);
  }
}

// Se chegou aqui, imagem foi aprovada!
// Continua para verificação de créditos...
```

---

## 🎯 **Função de Detecção:**

### **Arquivo:** `lib/celebrity-detection-gpt.ts`

```typescript
export async function detectCelebrityWithGPT(imageBase64: string) {
  // 1. Pega API Key do OpenAI
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  // 2. Chama GPT-4o Vision
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Analyze if this is a celebrity or child...' 
            },
            { 
              type: 'image_url', 
              image_url: { url: imageBase64 } 
            }
          ]
        }
      ]
    })
  });
  
  // 3. Parse resultado
  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  
  // 4. Retorna: { isCelebrity: true, name: "Elon Musk", ... }
  return result;
}
```

---

## 🧪 **Como Testar:**

### **1. Com celebridade (deve bloquear):**
```bash
# Logs esperados:
🔍 Analisando imagem com GPT-4o Vision...
🎭 GPT-4o: Celebridade detectada: Elon Musk (high confiança)
🚫 BLOQUEIO ATIVADO por GPT-4o
❌ Retorna erro 400 (NÃO chama API Veo)
```

### **2. Com avatar fictício (deve aprovar):**
```bash
# Logs esperados:
🔍 Analisando imagem com GPT-4o Vision...
✅ GPT-4o: Imagem aprovada
✅ Continua para verificação de créditos
🎬 Chama API Veo
```

---

## 📊 **Ordem Cronológica:**

| Ordem | Ação | Arquivo | Linha |
|-------|------|---------|-------|
| 1 | Recebe requisição | `veo/route.ts` | 107 |
| 2 | Autentica usuário | `veo/route.ts` | 128-138 |
| 3 | Parse body | `veo/route.ts` | 140-143 |
| 4 | **🔍 VERIFICA IMAGEM** | **`veo/route.ts`** | **145-179** |
| 5 | Verifica créditos | `veo/route.ts` | 215+ |
| 6 | Deduz créditos | `veo/route.ts` | ~300 |
| 7 | Chama API Veo | `veo/route.ts` | ~450 |

---

## ✅ **RESUMO:**

- **Onde:** `app/api/generate-video/veo/route.ts` linha 145
- **Quando:** Logo após receber a imagem, ANTES de tudo
- **Como:** Chama GPT-4o Vision via `lib/celebrity-detection-gpt.ts`
- **Custo:** $0.0004 por verificação
- **Economia:** Evita gastar $0.25 na API Veo

---

**Agora você sabe exatamente onde acontece! 🎯**

