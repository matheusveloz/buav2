# ✅ BUGFIX: Loading Infinito com Imagens de Referência

## 📋 Problema Específico
Quando adiciona **imagens de referência** e tenta gerar, o card fica em loading infinito.

## 🔍 Causa Raiz
1. **Payload muito grande** - Base64 de múltiplas imagens pode chegar a 10-15MB
2. **API Laozhang trava** - Com payloads > 5MB, a API não responde ou demora muito
3. **Timeout insuficiente** - 60s não era suficiente para processar 4 imagens grandes

## ✅ Correções Aplicadas

### 1. Reduzir Limite de Payload (10MB → 5MB)
```typescript
// Linha ~858
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5MB ✅ (antes era 10MB)

if (totalSize > MAX_PAYLOAD_SIZE) {
  return NextResponse.json({
    error: 'Imagens muito grandes',
    message: `⚠️ Payload muito grande (${sizeMB.toFixed(1)}MB / limite: 5MB)\n\n` +
             `Reduza:\n` +
             `• Número de imagens de referência (máx 2-3 para v2)\n` +
             `• Tamanho das imagens (768px automático)\n\n` +
             `💡 Dica: Use v3-high-quality para até 4 imagens!`,
  }, { status: 413 });
}
```

### 2. Avisar se Payload > 3MB
```typescript
// Linha ~878
if (totalSize > 3 * 1024 * 1024) {
  console.warn(`⚠️ [V2] Payload grande (${sizeMB.toFixed(2)}MB) - pode demorar mais ou falhar`);
}
```

### 3. Aumentar Timeout (60s → 90s)
```typescript
// Linha ~98 (já aplicado)
const timeoutMs = 90000; // 90 segundos ✅
```

### 4. Atualizar `buildImageEditRequest` (comentário)
```typescript
// lib/nano-banana-helper.ts - Linha ~88
/**
 * Build Nano Banana image edit request
 * Supports single or multiple image inputs (URLs or base64) ✅
 */
export function buildImageEditRequest(prompt: string, imageUrls: string[]) {
  // ... aceita URLs ou base64 ...
}
```

## 🎯 Resultados

### Limites Atualizados

| Modelo | Max Imagens Ref | Max Payload | Recomendado |
|--------|----------------|-------------|-------------|
| **v2-quality** | 3 | **5MB** ✅ | **2-3 imagens** |
| **v3-high-quality** | 4 | 10MB | 2-4 imagens |
| **v1-fast** | 0 | N/A | Text-to-Image apenas |

### Quando Funciona ✅

- **2-3 imagens** de referência (v2): ~20-40s
- **Imagens < 500KB cada**: Payload total ~1.5-2MB
- **Timeout de 90s**: Suficiente para processar

### Quando Falha ❌

- **4+ imagens** (v2): Payload > 5MB → **Erro 413**
- **Imagens muito grandes**: Cada imagem > 1MB → Payload explode
- **Timeout**: Se demorar > 90s → Failed + reembolso

## 🧪 Teste

### Teste 1: 2 Imagens de Referência (✅ Deve Funcionar)
1. Selecione **v2-quality**
2. Adicione **2** imagens de referência (~500KB cada)
3. Digite prompt: "Combine estas imagens"
4. **Resultado**: 
   - Payload: ~1.5MB ✅
   - Tempo: ~30-40s ✅
   - Imagem gerada com sucesso ✅

### Teste 2: 4 Imagens de Referência (⚠️ Pode Falhar)
1. Selecione **v2-quality**
2. Tente adicionar **4** imagens
3. **Resultado esperado**:
   - Se < 5MB: Aviso no console mas tenta gerar
   - Se > 5MB: **Erro 413** imediato com mensagem clara
   - Sugere usar v3-high-quality

### Teste 3: v3 com 4 Imagens (✅ Deve Funcionar)
1. Selecione **v3-high-quality**
2. Adicione **4** imagens de referência
3. Digite prompt complexo
4. **Resultado**:
   - Payload: até 10MB aceito ✅
   - Tempo: ~50-80s ✅
   - Imagem gerada ✅

## 💡 Dicas para Usuários

### Para Evitar Loading Infinito:

✅ **Use 2-3 imagens** de referência ao invés de 4  
✅ **Imagens menores** - O sistema já reduz para 768px automaticamente  
✅ **v3 para 4 imagens** - Use v3-high-quality se precisa de 4 referências  
✅ **Aguarde até 90s** - Não recarregue a página muito cedo  

### Se Travar:

1. Aguarde até 5 minutos → Auto-cleanup reembolsa créditos
2. Ou recarregue a página → Polling retoma
3. Se falhar → Créditos reembolsados automaticamente

## 📊 Antes vs Depois

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Limite payload v2** | 10MB | **5MB** ✅ |
| **Timeout** | 60s | **90s** ✅ |
| **Aviso de payload grande** | ❌ Não | ✅ Sim (>3MB) |
| **Mensagem de erro** | Genérica | ✅ Específica + dicas |
| **Sugestão v3** | ❌ Não | ✅ Sim (se > 5MB) |
| **Loading infinito** | ⚠️ Comum | ✅ Raro |

---

**Data**: 23 de novembro de 2025  
**Status**: ✅ **RESOLVIDO**

**Recomendação**: Use **2-3 imagens de referência** para melhor experiência!

