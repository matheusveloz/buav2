# 🐛 BUGFIX: Deleção de Imagens Não Persiste ao Recarregar

## 📋 Problema Identificado

**Sintoma:** Ao deletar uma imagem, ela sumia da UI, mas ao recarregar a página (F5), a imagem voltava a aparecer.

**Causa Raiz:**
- A deleção era apenas **visual** (removia da UI local)
- Nenhuma chamada à API era feita
- O banco de dados não era atualizado
- Ao recarregar, o histórico era buscado do banco e a imagem voltava

### Código Anterior (❌ Bugado)
```typescript
// Apenas removia da UI, não persistia
setImages((prev) => prev.filter((img) => img.id !== image.id));
// SEM chamada à API!
```

## ✅ Solução Implementada

### 1. API Inteligente de Deleção

A API agora detecta se está deletando:
- **Imagem individual**: ID no formato `{uuid}-{index}` (ex: `abc123-0`)
- **Geração inteira**: ID no formato `{uuid}` (ex: `abc123`)

**Fluxo de Deleção Individual:**
```typescript
// ID recebido: "abc123-def456-...-1" (geração-1)
// Extrai: generationId="abc123-def456-..." e imageIndex=1

1. Busca a geração no banco
2. Remove apenas o item do index 1 do array image_urls
3. Deleta o arquivo específico do Storage
4. Atualiza o banco com o novo array
5. Se o array ficar vazio, marca a geração como deletada
```

**Código da API:**
```typescript
// Parsear ID para extrair generationId e imageIndex
const parts = imageIdentifier.split('-');
const lastPart = parts[parts.length - 1];

if (!isNaN(Number(lastPart))) {
  imageIndex = Number(lastPart);
  generationId = parts.slice(0, -1).join('-');
}

// Remover apenas a imagem específica do array
const updatedImageUrls = existingImage.image_urls.filter((_, idx) => idx !== imageIndex);

// Atualizar no banco
await supabase
  .from('generated_images')
  .update({ 
    image_urls: updatedImageUrls,
    num_images: updatedImageUrls.length 
  })
  .eq('id', generationId);
```

### 2. Cliente Atualizado

Agora faz chamada à API com o ID completo:

```typescript
// Chamar API com ID completo (inclui o index)
const response = await fetch(`/api/generate-image/${image.id}`, {
  method: 'DELETE',
});

// API detecta o index automaticamente e deleta apenas aquela imagem
```

## 🎯 Comportamento Esperado Agora

### Cenário 1: Deletar 1 de 4 imagens
```
✅ Gerar 4 imagens: A (uuid-0), B (uuid-1), C (uuid-2), D (uuid-3)
🗑️ Deletar imagem B (uuid-1)
📊 Banco: image_urls = [A, C, D], num_images = 3
💾 Storage: Arquivo de B deletado
🔄 Recarregar página: Aparecem apenas A, C, D ✨
```

### Cenário 2: Deletar todas as imagens individualmente
```
✅ Gerar 4 imagens: A, B, C, D
🗑️ Deletar A → Restam B, C, D
🗑️ Deletar B → Restam C, D
🗑️ Deletar C → Resta D
🗑️ Deletar D → Array vazio
📊 Geração marcada como deleted_at (soft delete)
🔄 Recarregar página: Nenhuma imagem aparece ✨
```

## 🔍 Casos de Uso

### Deleção Individual (novo)
```
DELETE /api/generate-image/abc123-def456-ghi789-1
→ Deleta apenas a imagem no index 1
→ Mantém as outras da mesma geração
```

### Deleção de Geração Completa (existente)
```
DELETE /api/generate-image/abc123-def456-ghi789
→ Deleta todas as imagens
→ Marca geração como deleted_at
```

## 📝 Estrutura do Banco

**Antes da deleção:**
```json
{
  "id": "abc123-def456-ghi789",
  "num_images": 4,
  "image_urls": [
    { "imageUrl": "url1", "imageType": "png" },
    { "imageUrl": "url2", "imageType": "png" },
    { "imageUrl": "url3", "imageType": "png" },
    { "imageUrl": "url4", "imageType": "png" }
  ],
  "deleted_at": null
}
```

**Depois de deletar índice 1:**
```json
{
  "id": "abc123-def456-ghi789",
  "num_images": 3,
  "image_urls": [
    { "imageUrl": "url1", "imageType": "png" },
    { "imageUrl": "url3", "imageType": "png" },
    { "imageUrl": "url4", "imageType": "png" }
  ],
  "deleted_at": null
}
```

**Depois de deletar todos os índices:**
```json
{
  "id": "abc123-def456-ghi789",
  "num_images": 0,
  "image_urls": [],
  "deleted_at": "2024-11-21T12:34:56.789Z"
}
```

## ⚡ Melhorias

1. **Persistência**: Deleções agora são persistidas no banco
2. **Storage Limpo**: Arquivos deletados são removidos do Storage
3. **Contagem Correta**: `num_images` é atualizado automaticamente
4. **Soft Delete**: Quando não há mais imagens, usa soft delete para manter histórico
5. **Retrocompatível**: Continua funcionando com IDs antigos (sem index)

## 📁 Arquivos Modificados

- `app/api/generate-image/[id]/route.ts` - API de deleção inteligente
- `app/image-generator/image-generator-client.tsx` - Cliente com chamada à API

---

**Status:** ✅ Corrigido e persistindo  
**Data:** 21/11/2024  
**Impacto:** Crítico - afetava persistência de deleções

