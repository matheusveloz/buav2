# 🛡️ SISTEMA DE MODERAÇÃO - BUUA 1.0 vs 2.0

## 📋 **VISÃO GERAL**

O Buua implementa **moderação de conteúdo diferenciada** por versão:

- **Buua 1.0 (Legado)**: Apenas desenhos e objetos
- **Buua 2.0 (High)**: Pessoas permitidas (com restrições)

---

## 🎯 **REGRAS DE MODERAÇÃO**

### **Buua 1.0 - Legado** 
*Apenas desenhos, cartoons e objetos*

#### ❌ BLOQUEIOS:
1. **Rostos Reais** - Fotos de pessoas reais
2. **Nudez** - Conteúdo sexual ou nudez
3. **Obsceno** - Violência, gore, conteúdo gráfico

#### ✅ PERMITIDO:
- Desenhos e cartoons
- Ilustrações e arte digital
- Avatares estilizados (não-realistas)
- Objetos e cenários
- Arte conceitual

---

### **Buua 2.0 - High**
*Pessoas permitidas (com proteções)*

#### ❌ BLOQUEIOS:
1. **Crianças** - Menores de 16 anos
2. **Celebridades** - Pessoas famosas
3. **Nudez** - Conteúdo sexual ou nudez
4. **Obsceno** - Violência, gore, conteúdo gráfico

#### ✅ PERMITIDO:
- Fotos de pessoas reais (adultos 16+)
- Avatares IA realistas
- Pessoas anônimas
- Fotos pessoais do próprio usuário

---

## 🔍 **TECNOLOGIA DE DETECÇÃO**

### **GPT-4o Vision API**

O sistema usa GPT-4o Vision (mini) para analisar imagens e detectar:

```typescript
interface CelebrityDetectionResult {
  isCelebrity: boolean;      // Pessoa famosa?
  isChild: boolean;          // Menor de 16 anos?
  hasRealFace: boolean;      // 🆕 Rosto real (não desenho)?
  hasNudity: boolean;        // 🆕 Nudez ou conteúdo sexual?
  hasObscene: boolean;       // 🆕 Violência ou obscenidade?
  name?: string;             // Nome da celebridade (se detectada)
  estimatedAge?: number;     // Idade estimada
  confidence: 'high' | 'medium' | 'low';
}
```

### **OpenAI Moderation API**

Modera prompts de texto detectando:
- Conteúdo sexual/adulto
- Violência explícita
- Discurso de ódio
- Assédio/bullying
- Automutilação

---

## 📁 **IMPLEMENTAÇÃO**

### **1. Biblioteca Principal**

```typescript
// lib/celebrity-detection-gpt.ts
export async function detectCelebrityWithGPT(imageBase64: string)
export function shouldBlockBuua10(result: CelebrityDetectionResult)
export function shouldBlockBuua20(result: CelebrityDetectionResult)
export function getBlockMessageBuua10(result: CelebrityDetectionResult)
export function getBlockMessageBuua20(result: CelebrityDetectionResult)
```

### **2. Moderação Completa**

```typescript
// lib/content-moderation.ts
export async function moderateContent(
  prompt: string,
  imageBase64?: string,
  version: '1.0' | '2.0' = '2.0'
): Promise<{
  blocked: boolean;
  reason?: string;
  details?: string;
}>
```

---

## 🎬 **INTEGRAÇÃO NAS APIs**

### **API de Vídeo - Buua 1.0**
```typescript
// app/api/generate-video/route.ts (LEGADO)
const moderationResult = await moderateContent(prompt, imageBase64, '1.0');
```

**Bloqueia:**
- ❌ Rostos reais
- ❌ Nudez
- ❌ Obscenidades

### **API de Vídeo - Buua 2.0**
```typescript
// app/api/generate-video/veo/route.ts (HIGH)
const moderationResult = await moderateContent(prompt, imageBase64, '2.0');
```

**Bloqueia:**
- ❌ Crianças
- ❌ Celebridades
- ❌ Nudez
- ❌ Obscenidades

### **API de Imagem**
```typescript
// app/api/generate-image/route.ts
const moderationResult = await moderateContent(prompt, imageBase64, '2.0');
```

**Aplica regras do Buua 2.0** (permite pessoas, bloqueia crianças/famosos)

---

## 💰 **CUSTOS**

| Serviço | Custo | Uso |
|---------|-------|-----|
| **OpenAI Moderation** | GRÁTIS | Moderação de texto |
| **GPT-4o-mini Vision** | $0.0004/imagem | Análise de imagens |

**Economia:**
- Bloquear antes da geração economiza $0.15-$0.40 por tentativa
- ROI: 99.9% de economia vs gerar primeiro e descobrir depois

---

## 🧪 **EXEMPLOS DE USO**

### **Exemplo 1: Desenho no Buua 1.0** ✅
```
Imagem: Cartoon de um gato
Resultado: APROVADO
Motivo: É um desenho, não rosto real
```

### **Exemplo 2: Foto de pessoa no Buua 1.0** ❌
```
Imagem: Foto de uma pessoa
Resultado: BLOQUEADO
Motivo: "Rosto Real Detectado - Buua 1.0 só permite desenhos"
Sugestão: Use Buua 2.0 para animar pessoas
```

### **Exemplo 3: Foto de pessoa no Buua 2.0** ✅
```
Imagem: Foto de adulto anônimo
Resultado: APROVADO
Motivo: Pessoa adulta, não famosa
```

### **Exemplo 4: Celebridade no Buua 2.0** ❌
```
Imagem: Elon Musk
Resultado: BLOQUEADO
Motivo: "Celebridade detectada: Elon Musk"
```

### **Exemplo 5: Criança no Buua 2.0** ❌
```
Imagem: Criança de 10 anos
Resultado: BLOQUEADO
Motivo: "Proteção Infantil - menor de 16 anos detectado"
```

### **Exemplo 6: Nudez em qualquer versão** ❌
```
Prompt/Imagem: Conteúdo adulto
Resultado: BLOQUEADO
Motivo: "Conteúdo Impróprio - Nudez detectada"
```

---

## 📊 **FLUXO DE MODERAÇÃO**

```
Usuário envia: prompt + imagem (opcional)
         ↓
1. 🛡️ MODERA PROMPT (GRÁTIS - OpenAI Moderation)
   ↓
   Explícito/violento? → 🚫 BLOQUEIA
   ↓
2. 🔍 ANALISA IMAGEM ($0.0004 - GPT-4o-mini)
   ↓
   BUUA 1.0:
   - Rosto real? → 🚫 BLOQUEIA
   - Nudez? → 🚫 BLOQUEIA
   - Obsceno? → 🚫 BLOQUEIA
   ↓
   BUUA 2.0:
   - Criança? → 🚫 BLOQUEIA
   - Celebridade? → 🚫 BLOQUEIA
   - Nudez? → 🚫 BLOQUEIA
   - Obsceno? → 🚫 BLOQUEIA
   ↓
3. ✅ APROVADO
   ↓
4. 🎬 Gera vídeo/imagem
```

---

## ⚙️ **CONFIGURAÇÃO**

### **Variáveis de Ambiente**
```bash
OPENAI_API_KEY=sk-...  # Para Moderation e GPT-4o Vision
```

### **Fail-Safe**
- Se a moderação falhar (erro técnico), **não bloqueia** o usuário
- Logs de erro são registrados
- Sistema continua funcionando

---

## 🔄 **VERSÃO**

- **Implementado:** 23/11/2025
- **Versão:** 2.0
- **Status:** ✅ Ativo em produção

---

## 📝 **NOTAS IMPORTANTES**

1. **Falsos Positivos**: Sistema é conservador com idade - adultos jovens (18-25) são aprovados
2. **Confiança Baixa**: Detecções com baixa confiança são aprovadas para evitar bloqueios incorretos
3. **Crianças**: Apenas menores de 16 são bloqueados (16-17 são permitidos)
4. **Celebridades**: Bloqueio estrito - mesmo 10% de similaridade resulta em bloqueio
5. **Desenhos**: Cartoons, anime, arte digital = `hasRealFace: false` (permitido no 1.0)

---

## ✅ **VANTAGENS DO SISTEMA**

1. **Proteção Dupla** - Texto + Imagem
2. **Econômico** - Moderação antes da geração
3. **Diferenciado** - Regras específicas por versão
4. **Preciso** - GPT-4o Vision tem alta acurácia
5. **Rápido** - Análise em ~1-2 segundos
6. **Fail-safe** - Não bloqueia em caso de erro técnico
7. **Transparente** - Mensagens claras para o usuário

---

## 🎯 **PRÓXIMOS PASSOS**

- [ ] Adicionar moderação nas APIs v3 e v3-async (se necessário)
- [ ] Implementar cache de análises para imagens recorrentes
- [ ] Dashboard de métricas de moderação
- [ ] Testes A/B de sensibilidade de detecção

