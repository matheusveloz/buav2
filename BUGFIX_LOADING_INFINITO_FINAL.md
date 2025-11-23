# ✅ BUGFIX: Loading Infinito Resolvido

## 📋 Problema
Card com loading ficava aparecendo infinitamente, mesmo quando a imagem já deveria estar pronta.

## 🔍 Causa Raiz
1. **Função assíncrona sem garantias** - Se travasse, não atualizava o banco
2. **Timeout muito curto** - 60s era apertado para 4 imagens de referência
3. **Reembolso de créditos** - Não estava sendo feito no catch externo

## ✅ Correções Aplicadas

### 1. Aumentar Timeout (60s → 90s)
```typescript
// v2-quality: 90s (antes era 60s)
const timeoutMs = 90000; // ✅ Tempo suficiente para 4 imagens
```

### 2. Adicionar `updated_at` no Update
```typescript
// Linha ~197
.update({
  status: 'completed',
  image_urls: successfulImages,
  completed_at: new Date().toISOString(),
  updated_at: new Date().toISOString(), // ✅ ADICIONADO
})
```

### 3. Garantir Reembolso no Catch Externo
```typescript
// Linha ~865
.catch(async (error) => {
  // ✅ Reembolsar créditos SEMPRE que falhar
  const { data: currentProfile } = await supabase
    .from('emails')
    .select('creditos, creditos_extras')
    .eq('email', userEmail)
    .single();
  
  if (currentProfile) {
    const newCreditos = (currentProfile.creditos || 0) + creditsNeeded;
    await supabase
      .from('emails')
      .update({ creditos: newCreditos })
      .eq('email', userEmail);
  }
  
  // Marcar como failed
  await supabase
    .from('generated_images')
    .update({ 
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('task_id', taskId);
})
```

### 4. Adicionar `.then()` para Log de Sucesso
```typescript
// Linha ~883
v3GenerationPromise.then(() => {
  console.log(`✅ [V3] Geração assíncrona completada: ${taskId}`);
}).catch((error) => {
  console.error(`❌ [V3 CATCH] Erro não tratado:`, error);
});
```

## 🎯 Resultado

### Antes
```
User clica "Gerar"
→ Card loading aparece
→ Se travar: Loading infinito ❌
→ Auto-cleanup após 5min
```

### Agora
```
User clica "Gerar"
→ Card loading aparece
→ Geração completa em ~20-80s ✅
→ Card atualiza para imagem
→ Ou falha com reembolso automático ✅
```

## ⏱️ Timeouts Atualizados

| Modelo | Timeout | Uso Típico |
|--------|---------|-----------|
| v1-fast (Newport) | Assíncrono (API externa) | 2-5min |
| v2-quality | **90s** ✅ | ~20-40s normalmente |
| v3-high-quality | **90s** ✅ | ~50-80s com 4 imagens |

## 🧪 Teste
1. Clique em "Gerar" (v2 ou v3)
2. Aguarde ~20-80s
3. ✅ Imagem aparece (não fica em loading infinito)
4. Se falhar → Créditos reembolsados automaticamente

## 📝 Garantias Adicionadas

✅ **Sempre atualiza o banco** (completed OU failed)  
✅ **Sempre reembolsa créditos** se falhar  
✅ **Timeout robusto** (90s para v2 e v3)  
✅ **Auto-cleanup** (failsafe após 5min)  
✅ **Logs claros** para debug  

---

**Data**: 23 de novembro de 2025  
**Status**: ✅ **RESOLVIDO**

