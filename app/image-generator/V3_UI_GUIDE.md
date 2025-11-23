# 🎨 Versão 3.0 - Guia Visual da Interface

## 📱 Nova Interface do Usuário

### 1. Seletor de Modelo (Dropdown)

```
┌─────────────────────────────────────┐
│ Modelo: [Versão 3.0 High Quality ▼]│
├─────────────────────────────────────┤
│ ⚡ Versão 1.0 Fast                  │
│ ✨ Versão 2.0 Quality                │
│ 🚀 Versão 3.0 High Quality  ← NOVO  │
└─────────────────────────────────────┘
```

### 2. Card de Imagens de Referência (Expandido para v3)

**Para v2-quality (limite: 3)**
```
┌───────────────────────────────────────────────┐
│ 🖼️ Imagens de Referência (opcional) 2/3      │
├───────────────────────────────────────────────┤
│ [IMG1] [IMG2] [+ Add]                         │
│ Adicione até 3 imagens para edição...        │
└───────────────────────────────────────────────┘
```

**Para v3-high-quality (limite: 14)**
```
┌───────────────────────────────────────────────┐
│ 🖼️ Imagens de Referência (opcional) 5/14     │
├───────────────────────────────────────────────┤
│ [IMG1] [IMG2] [IMG3] [IMG4] [IMG5] [+ Add]    │
│ [IMG6] [IMG7] ...                             │
│ Adicione até 14 imagens para edição/         │
│ combinação com IA (Gemini 3 Pro)...          │
└───────────────────────────────────────────────┘
```

### 3. Card de Configurações Avançadas (NOVO - Apenas v3)

```
┌──────────────────────────────────────────────────────────┐
│ ⚙️ Configurações Avançadas    [Nano Banana 2]           │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ Proporção da Imagem:                                      │
│ ┌─────┬─────┬─────┬─────┬─────┐                         │
│ │21:9 │16:9 │ 4:3 │ 3:2 │ 1:1 │                         │
│ │Ultra│Wide │Stnd │Photo│Squar│                         │
│ └─────┴─────┴─────┴─────┴─────┘                         │
│ ┌─────┬─────┬─────┬─────┬─────┐                         │
│ │ 2:3 │ 3:4 │ 9:16│ 4:5 │ 5:4 │                         │
│ │Portr│Port │Story│Inst │Land │                         │
│ └─────┴─────┴─────┴─────┴─────┘                         │
│                                                           │
│ Resolução:                                                │
│ ┌──────────┬──────────┬──────────┐                       │
│ │   1K     │   2K     │   4K     │  ← 1K selecionado    │
│ │(1024px)  │(2048px)  │(4096px)  │                       │
│ │ Rápido   │Alta HD   │ Ultra HD │                       │
│ └──────────┴──────────┴──────────┘                       │
│                                                           │
│ ┌────────────────────────────────────────┬──────┐        │
│ │ 🔍 Google Search                       │ [OFF]│        │
│ │    Usar dados reais em tempo real     │      │        │
│ └────────────────────────────────────────┴──────┘        │
└──────────────────────────────────────────────────────────┘
```

### 4. Botão de Criar (Créditos Dinâmicos)

**v1-fast (fixo)**
```
┌──────────────────┐
│ 💰 2 Criar       │
└──────────────────┘
```

**v2-quality (fixo)**
```
┌──────────────────┐
│ 💰 8 Criar       │  (text-to-image)
└──────────────────┘

┌──────────────────┐
│ 💰 12 Criar      │  (image-to-image)
└──────────────────┘
```

**v3-high-quality (VARIÁVEL)**
```
Sem imagens de referência:
┌──────────────────┐
│ 💰 4 Criar       │  (1K)
└──────────────────┘
┌──────────────────┐
│ 💰 6 Criar       │  (2K)
└──────────────────┘
┌──────────────────┐
│ 💰 10 Criar      │  (4K)
└──────────────────┘

Com imagens de referência:
┌──────────────────┐
│ 💰 8 Criar       │  (1K)
└──────────────────┘
┌──────────────────┐
│ 💰 12 Criar      │  (2K)
└──────────────────┘
┌──────────────────┐
│ 💰 18 Criar      │  (4K)
└──────────────────┘
```

## 🎯 Fluxo de Uso Típico

### Cenário 1: Post do Instagram (1:1, 1K)

```
1. Selecionar modelo: "🚀 Versão 3.0 High Quality"
2. Card de Configurações Avançadas aparece ↓
3. Proporção: Clicar em [1:1] (Square)
4. Resolução: Deixar em [1K] (padrão)
5. Digitar prompt: "Um café artesanal em uma mesa de madeira"
6. Clicar em [💰 4 Criar]
7. ✅ Imagem 1024x1024px gerada!
```

### Cenário 2: Banner de YouTube (16:9, 2K)

```
1. Selecionar modelo: "🚀 Versão 3.0 High Quality"
2. Proporção: Clicar em [16:9] (Widescreen)
3. Resolução: Clicar em [2K] (Alta HD)
4. Digitar prompt: "Banner moderno de tecnologia com fundo futurista"
5. Clicar em [💰 6 Criar]
6. ✅ Imagem ~2048x1152px gerada!
```

### Cenário 3: Stories do Instagram (9:16, 2K) com Google Search

```
1. Selecionar modelo: "🚀 Versão 3.0 High Quality"
2. Proporção: Clicar em [9:16] (Stories)
3. Resolução: Clicar em [2K]
4. Google Search: Ativar toggle [ON]
5. Digitar prompt: "Visualização da previsão do tempo em São Paulo"
6. Clicar em [💰 6 Criar]
7. ✅ Imagem vertical com dados reais gerada!
```

### Cenário 4: Impressão de Alta Qualidade (3:2, 4K) com Referências

```
1. Selecionar modelo: "🚀 Versão 3.0 High Quality"
2. Upload de 3 imagens de referência:
   - Logo da empresa
   - Foto do produto
   - Cor/estilo de referência
3. Proporção: Clicar em [3:2] (Classic Photo)
4. Resolução: Clicar em [4K] (Ultra HD)
5. Digitar prompt: "Banner profissional combinando estes elementos"
6. Clicar em [💰 18 Criar]
7. ✅ Imagem ~4096x2731px ultra HD gerada!
```

## 🎨 Esquema de Cores da UI

### Cards de Configuração

```css
/* Card de Imagens de Referência */
background: gradient(emerald-50 → green-50)
border: emerald-200
icon: emerald-600
text: emerald-700

/* Card de Configurações Avançadas (v3) */
background: gradient(purple-50 → pink-50)
border: purple-200
icon: purple-600
text: purple-700
badge: purple-100 + purple-700

/* Botão Criar */
background: gradient(emerald-500 → green-600)
text: white
shadow: 2xl
hover: scale-105
```

### Estados dos Seletores

```css
/* Aspect Ratio / Resolution - Selecionado */
border: purple-500 (2px)
background: purple-100
shadow: sm

/* Aspect Ratio / Resolution - Não Selecionado */
border: gray-200 (2px)
background: white/70
hover: border-purple-300

/* Toggle Google Search - ON */
background: purple-500
circle: white, translateX(6)

/* Toggle Google Search - OFF */
background: gray-300
circle: white, translateX(1)
```

## 📐 Layout Grid

### Aspect Ratios (Grid 5x2)

```
┌─────────────────────────────────────────┐
│ [21:9]  [16:9]  [4:3]  [3:2]  [1:1]    │
│ [2:3]   [3:4]   [9:16] [4:5]  [5:4]    │
└─────────────────────────────────────────┘
```

### Resolutions (Grid 3x1)

```
┌─────────────────────────────────────────┐
│    [1K]         [2K]         [4K]       │
└─────────────────────────────────────────┘
```

### Reference Images (Flexbox wrap, até 14)

```
┌─────────────────────────────────────────┐
│ [IMG] [IMG] [IMG] [IMG] [IMG] [IMG] ... │
│ [IMG] [IMG] [IMG] [+Add]                │
└─────────────────────────────────────────┘
```

## 🔄 Estados da Interface

### Estado 1: Modelo v1-fast selecionado
```
✅ Prompt textarea
✅ Seletor de quantidade (1-4)
✅ Seletor de tamanho (512x512, 768x768, etc.)
❌ Card de imagens de referência
❌ Card de configurações avançadas
```

### Estado 2: Modelo v2-quality selecionado
```
✅ Prompt textarea
✅ Seletor de quantidade (1-4)
❌ Seletor de tamanho (fixo 1024x1024)
✅ Card de imagens de referência (até 3)
❌ Card de configurações avançadas
```

### Estado 3: Modelo v3-high-quality selecionado (NOVO!)
```
✅ Prompt textarea
✅ Seletor de quantidade (1-4)
❌ Seletor de tamanho (substituído por aspect ratio + resolution)
✅ Card de imagens de referência (até 14)
✅ Card de configurações avançadas
   ├─ Aspect Ratio (grid 5x2)
   ├─ Resolution (grid 3x1)
   └─ Google Search toggle
```

## 📊 Indicadores Visuais

### Badge do Modelo
```
┌────────────────────┐
│ [Nano Banana 2]    │  ← Purple badge
└────────────────────┘
```

### Contador de Imagens de Referência
```
Imagens de Referência (opcional) [5/14]
                                  └─┬─┘
                          Contador dinâmico
```

### Descrições dos Aspect Ratios
```
┌──────┐
│ 16:9 │  ← Ratio
│Wide  │  ← Descrição
└──────┘
```

### Descrições das Resolutions
```
┌──────────┐
│   2K     │  ← Label
│(2048px)  │  ← Tamanho
│Alta HD   │  ← Descrição
└──────────┘
```

## 🎬 Animações

### Aparecimento do Card de Configurações
```
transition: all 300ms
opacity: 0 → 1
transform: translateY(10px) → translateY(0)
```

### Hover nos Botões de Aspect Ratio/Resolution
```
transition: all 200ms
border-color: gray-200 → purple-300
```

### Toggle do Google Search
```
transition: background 200ms, transform 200ms
circle translateX: 1 ↔ 6 (24px)
```

### Botão Criar
```
hover: scale-105
transition: all 200ms
shadow: lg → xl
```

## 💡 Dicas de UX

### 1. Feedback Visual Imediato
- Seleção de aspect ratio/resolution destaca imediatamente
- Contador de créditos atualiza em tempo real
- Upload de imagens mostra preview instantâneo

### 2. Validações
- Limite de 14 imagens respeitado automaticamente
- Botão "Criar" desabilitado se prompt vazio
- Créditos insuficientes mostram modal explicativo

### 3. Persistência
- Todas as configurações salvas no localStorage
- Ao recarregar, configurações são restauradas
- Usuário pode continuar de onde parou

### 4. Responsividade
- Grid adapta em mobile (stack vertical)
- Botões e cards redimensionam
- Text sizes ajustam (text-xs em mobile, text-sm em desktop)

---

**🎨 Design System**: Tailwind CSS  
**🎯 Framework**: React/Next.js  
**📐 Layout**: Flexbox + CSS Grid  
**🎭 Animações**: Tailwind transitions + transforms

