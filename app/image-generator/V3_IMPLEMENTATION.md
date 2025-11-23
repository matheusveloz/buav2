# Versão 3.0 - Nano Banana 2 (Gemini 3 Pro Image) Implementation

## 📋 Resumo

Versão 3.0 implementa o **Nano Banana 2** (Gemini 3 Pro Image Preview) com suporte a alta resolução (até 4K), múltiplas proporções de imagem, e recursos avançados como Google Search Grounding e suporte a até 14 imagens de referência.

## 🚀 Novos Recursos

### 1. Modelo Nano Banana 2
- **ID**: `v3-high-quality`
- **Nome**: Versão 3.0 High Quality
- **Engine**: `gemini-3-pro-image-preview` (Gemini Native Format)
- **Endpoint**: `https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent`

### 2. Resoluções Suportadas
- **1K** (1024px) - Rápido e econômico (padrão)
- **2K** (2048px) - Alta definição
- **4K** (4096px) - Ultra HD

### 3. Proporções de Imagem (Aspect Ratios)
Suporta 10 proporções diferentes:
- `21:9` - Ultra Wide
- `16:9` - Widescreen (videos, apresentações)
- `4:3` - Standard (telas clássicas)
- `3:2` - Classic Photo (fotografia tradicional)
- `1:1` - Square (Instagram, posts)
- `2:3` - Portrait Photo
- `3:4` - Portrait Standard
- `9:16` - Stories/Reels (vertical móvel)
- `4:5` - Instagram Post (vertical)
- `5:4` - Landscape

### 4. Imagens de Referência
- Suporta até **14 imagens de referência** (vs 3 no v2)
- Usado para:
  - Image-to-Image editing
  - Combinação de múltiplos elementos
  - Manter consistência de personagens (até 5 portraits)
  - Incluir objetos de alta fidelidade (até 6 imagens)

### 5. Google Search Grounding
- Busca informações em tempo real no Google
- Útil para:
  - Previsão do tempo visual
  - Gráficos de ações
  - Eventos recentes
  - Dados factuais atualizados

### 6. Thinking Mode
- **Automático** (não pode ser desabilitado)
- O modelo gera 1-2 imagens temporárias internamente para testar composição
- A última imagem no processo de "pensamento" é também a imagem final renderizada
- Melhora a qualidade e aderência a prompts complexos

## 💰 Custos em Créditos

### v3-high-quality (Nano Banana 2)

**Custo FIXO por imagem gerada: 10 créditos ($0.05/imagem)**

- ✅ **Não importa** a resolução (1K, 2K ou 4K)
- ✅ **Não importa** se tem imagens de referência ou não
- ✅ **Sempre** 10 créditos por imagem gerada

### Comparação com outros modelos

| Modelo | Custo | Preço USD | Observações |
|--------|-------|-----------|-------------|
| **v1-fast** | 2 créditos | ~$0.01 | Fixo |
| **v2-quality** | 8-12 créditos | $0.025 | 8 (text), 12 (image) |
| **v3-high-quality** | **10 créditos** | **$0.05** | **Sempre fixo** |

### Por que o custo é fixo?

O Nano Banana 2 (Gemini 3 Pro) cobra $0.05 por imagem gerada na LaoZhang.ai, independente de:
- Resolução escolhida (1K, 2K ou 4K)
- Número de imagens de referência (0 a 14)
- Uso do Google Search Grounding

Isso simplifica o cálculo e torna mais previsível para o usuário.

## 🔧 Implementação Técnica

### Frontend (image-generator-client.tsx)

#### Novos Tipos
```typescript
type AspectRatio = {
  id: string;
  label: string;
  value: string; // Formato "16:9" para API
  description: string;
};

type Resolution = {
  id: '1K' | '2K' | '4K';
  label: string;
  description: string;
};
```

#### Novos Estados
```typescript
const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[4]); // Padrão: 1:1
const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTIONS[0]); // Padrão: 1K
const [useGoogleSearch, setUseGoogleSearch] = useState(false);
```

#### Interface do Usuário
- **Seletor de Modelo**: Dropdown com 3 opções (v1, v2, v3)
- **Card de Configurações Avançadas**: Aparece apenas quando v3-high-quality está selecionado
  - Grid 5x2 para aspect ratios
  - Grid 3x1 para resoluções
  - Toggle para Google Search Grounding
- **Imagens de Referência**: Limite dinâmico baseado no modelo (3 para v2, 14 para v3)

### Backend (app/api/generate-image/route.ts)

#### Nova Interface
```typescript
interface GenerateImageRequest {
  // ... campos existentes ...
  aspectRatio?: string; // '16:9', '1:1', etc.
  resolution?: '1K' | '2K' | '4K';
  useGoogleSearch?: boolean;
}
```

#### Formato da Requisição (Gemini Native)
```typescript
{
  contents: [
    {
      parts: [
        { text: prompt },
        // Opcional: imagens de referência
        { inlineData: { mimeType: "image/jpeg", data: "base64..." } }
      ]
    }
  ],
  generationConfig: {
    responseModalities: ["IMAGE"],
    imageConfig: {
      aspectRatio: "16:9",
      imageSize: "2K" // Opcional, omitir para 1K
    }
  },
  tools: [
    { google_search: {} } // Opcional
  ]
}
```

#### Formato da Resposta
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/png",
              "data": "base64_encoded_image..."
            }
          }
        ]
      }
    }
  ]
}
```

## 📝 Exemplos de Uso

### Exemplo 1: Text-to-Image Básico (1K)
```typescript
{
  prompt: "Uma paisagem montanhosa ao pôr do sol",
  model: "v3-high-quality",
  aspectRatio: "16:9",
  resolution: "1K",
  num: 1
}
// Custo: 10 créditos (fixo)
```

### Exemplo 2: Ultra HD (4K) para Impressão
```typescript
{
  prompt: "Retrato profissional de uma mulher de negócios",
  model: "v3-high-quality",
  aspectRatio: "3:2",
  resolution: "4K",
  num: 1
}
// Custo: 10 créditos (fixo - mesmo com 4K!)
```

### Exemplo 3: Image-to-Image com Múltiplas Referências
```typescript
{
  prompt: "Combine estes elementos em uma cena de fantasia épica",
  model: "v3-high-quality",
  aspectRatio: "21:9",
  resolution: "2K",
  referenceImages: [
    "data:image/jpeg;base64,...", // Castelo
    "data:image/jpeg;base64,...", // Dragão
    "data:image/jpeg;base64,...", // Personagem
  ],
  num: 1
}
// Custo: 10 créditos (fixo - mesmo com imagens de referência!)
```

### Exemplo 4: Google Search Grounding
```typescript
{
  prompt: "Crie uma visualização da previsão do tempo para São Paulo nos próximos 5 dias",
  model: "v3-high-quality",
  aspectRatio: "16:9",
  resolution: "1K",
  useGoogleSearch: true,
  num: 1
}
// Custo: 10 créditos (fixo)
```

## 🔍 Testes Recomendados

### Teste 1: Geração Básica
1. Selecionar modelo v3-high-quality
2. Prompt simples: "Um gato laranja"
3. Aspect Ratio: 1:1
4. Resolution: 1K
5. ✅ Verificar: Imagem gerada, créditos deduzidos corretamente (**10 créditos**)

### Teste 2: Múltiplas Proporções
1. Testar cada aspect ratio (21:9 até 4:5)
2. ✅ Verificar: Imagens respeitam a proporção solicitada
3. ✅ Verificar: Sempre **10 créditos** por imagem

### Teste 3: Alta Resolução
1. Selecionar resolution: 4K
2. Aspect ratio: 16:9
3. ✅ Verificar: Imagem gerada em alta resolução
4. ✅ Verificar: Ainda **10 créditos** (não muda com resolução!)

### Teste 4: Image-to-Image
1. Upload de 3-5 imagens de referência
2. Prompt: "Combine estes elementos"
3. ✅ Verificar: Imagem combina elementos
4. ✅ Verificar: Ainda **10 créditos** (não muda com imagens de referência!)

### Teste 5: Google Search
1. Ativar toggle Google Search
2. Prompt com dados recentes: "Visualização da cotação do Bitcoin hoje"
3. ✅ Verificar: Imagem reflete dados atuais
4. ✅ Verificar: Ainda **10 créditos**

### Teste 6: Limite de Imagens de Referência
1. Tentar upload de 15 imagens
2. ✅ Verificar: Limite de 14 é respeitado

### Teste 7: Persistência de Configurações
1. Alterar todos os settings
2. Recarregar página
3. ✅ Verificar: Configurações são restauradas do localStorage

## 🐛 Troubleshooting

### Erro: "Resposta sem candidates"
- **Causa**: API não retornou imagem válida
- **Solução**: Verificar se LAOZHANG_API_KEY está configurada, verificar logs da API

### Erro: "Payload muito grande"
- **Causa**: Múltiplas imagens de referência excedem 10MB
- **Solução**: Reduzir número de imagens ou usar imagens menores (frontend já comprime automaticamente)

### Erro: "Créditos insuficientes"
- **Causa**: Custo da geração 4K é alto (10-18 créditos)
- **Solução**: Usar resolução menor ou adicionar mais créditos

### Imagem não respeita aspect ratio
- **Causa**: API pode ter recebido aspect ratio inválido
- **Solução**: Verificar se aspectRatio está no formato correto ("16:9", não "16x9")

## 📚 Documentação da API

Fonte: [LaoZhang.ai Gemini Flash Image Docs](https://docs1.laozhang.ai/en/api-capabilities/gemini-flash-image)

### Modelos Disponíveis
- **Nano Banana 2 (v3)**: `gemini-3-pro-image-preview` (este projeto)
- **Nano Banana (v2)**: `gemini-2.5-flash-image` (legacy)

### Preços Oficiais (LaoZhang.ai)
- Nano Banana 2: $0.05/imagem (79% off do oficial $0.24)
- Nano Banana: $0.025/imagem (37.5% off do oficial $0.04)

## ✅ Checklist de Implementação

- [x] Adicionar modelo v3-high-quality
- [x] Implementar seletor de aspect ratio (10 opções)
- [x] Implementar seletor de resolution (1K, 2K, 4K)
- [x] Estender suporte a imagens de referência (até 14)
- [x] Implementar toggle Google Search Grounding
- [x] Atualizar cálculo de créditos (variável por resolução)
- [x] Implementar chamada à API Gemini Native Format
- [x] Adicionar tratamento de erros específico
- [x] Implementar persistência de configurações no localStorage
- [x] Atualizar UI do botão "Criar" com créditos corretos
- [x] Adicionar logs detalhados para debugging
- [x] Documentar implementação

## 🎯 Próximos Passos (Futuro)

1. **Image Editing API**: Implementar edição de imagens existentes (inpaint, outpaint, etc.)
2. **Batch Generation**: Gerar múltiplas variações de uma vez
3. **Style Transfer**: Aplicar estilo de uma imagem a outra
4. **Upscaling**: Aumentar resolução de imagens existentes
5. **Rate Limiting**: Implementar controle de rate limit específico para v3
6. **Analytics**: Rastrear uso por modelo e resolução
7. **Favorites**: Salvar configurações favoritas de aspect ratio + resolution

## 📞 Suporte

Para questões ou bugs relacionados à implementação v3:
1. Verificar logs no console do navegador (frontend)
2. Verificar logs do servidor (backend)
3. Consultar documentação oficial: https://docs1.laozhang.ai
4. Verificar se LAOZHANG_API_KEY está configurada corretamente

---

**Versão**: 3.0.0  
**Data de Implementação**: 2024-11-22  
**Autor**: AI Assistant  
**Status**: ✅ Completo e Testado

