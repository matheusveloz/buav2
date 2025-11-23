# 🐛 DEBUG: API sendo chamada 2x

## 🔍 **COMO TESTAR:**

### 1. Adicionar Log Único no Backend

```typescript
// app/api/generate-image/route.ts - linha ~240

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`🆔 [${requestId}] POST /api/generate-image INICIADO`);
  
  // ... resto do código ...
  
  // Na linha onde chama API:
  console.log(`📤 [${requestId}] Chamando API Laozhang...`);
  const nanoResponse = await fetch(...);
  console.log(`📥 [${requestId}] Resposta da API recebida`);
}
```

### 2. Ver nos Logs da Vercel

Se aparecer:
```
🆔 [abc123] POST /api/generate-image INICIADO
📤 [abc123] Chamando API Laozhang...
📥 [abc123] Resposta da API recebida

🆔 [def456] POST /api/generate-image INICIADO  ← DUPLICATA!
📤 [def456] Chamando API Laozhang...
📥 [def456] Resposta da API recebida
```

= **Frontend está chamando 2x!**

Se aparecer:
```
🆔 [abc123] POST /api/generate-image INICIADO
📤 [abc123] Chamando API Laozhang...
📤 [abc123] Chamando API Laozhang...  ← DUPLICATA!
```

= **Backend está chamando 2x!**

## 🎯 **SOLUÇÃO RÁPIDA:**

Adicione um **debounce** no botão:

```typescript
// app/image-generator/image-generator-client.tsx

const [isSubmitting, setIsSubmitting] = useState(false);

const handleGenerate = async () => {
  // ✅ PROTEÇÃO: Evitar cliques duplos
  if (isSubmitting) {
    console.log('⚠️ Já está enviando - ignorando');
    return;
  }
  
  setIsSubmitting(true);
  
  try {
    // ... código normal ...
  } finally {
    setTimeout(() => setIsSubmitting(false), 1000); // Debounce de 1s
  }
};
```

Quer que eu implemente isso?

