# 🐛 BUG: Múltiplas Chamadas para API

## 🔴 **PROBLEMA IDENTIFICADO:**

O usuário reportou:
- Ao gerar imagem, ela aparece
- Ao recarregar página, **imagens mudam**
- **Consumindo muitos créditos** (múltiplas chamadas)

## 🔍 **POSSÍVEIS CAUSAS:**

### 1. **React Strict Mode (Desenvolvimento)**

```typescript
// Next.js em desenvolvimento roda componentes 2x para detectar bugs
<React.StrictMode>
  <YourComponent /> // Renderiza 2x!
</React.StrictMode>
```

**Resultado**: `handleGenerate` pode ser chamado 2x!

### 2. **Hot Reload do Vercel**

Ao fazer deploy, se o código rodar múltiplas vezes, a Promise em background executa múltiplas vezes.

### 3. **Sem Proteção de Duplicação**

O código não verifica se já existe uma task com mesmo `taskId` antes de processar.

## ✅ **SOLUÇÕES:**

### Solução 1: Adicionar Flag de Processamento

```typescript
// app/api/generate-image/route.ts

// Map global para rastrear tasks em processamento
const processingTasks = new Map<string, boolean>();

if (model === 'v3-high-quality') {
  taskId = generateTaskId(generationType);
  
  // ✅ VERIFICAR SE JÁ ESTÁ PROCESSANDO
  if (processingTasks.has(taskId)) {
    console.log(`⚠️ Task ${taskId} já está sendo processada - ignorando duplicata`);
    // Não processar novamente
  } else {
    // Marcar como processando
    processingTasks.set(taskId, true);
    
    // Processar em background
    (async () => {
      try {
        // ... chamar API ...
      } finally {
        // Remover flag ao terminar
        processingTasks.delete(taskId);
      }
    })();
  }
}
```

### Solução 2: Verificar no Banco se Já Existe

```typescript
// Antes de processar, verificar se já existe no banco
const { data: existingTask } = await supabase
  .from('generated_images')
  .select('id')
  .eq('task_id', taskId)
  .single();

if (existingTask) {
  console.log(`⚠️ Task ${taskId} já existe no banco - não processar`);
  return NextResponse.json({
    status: 'processing',
    taskId,
    generationId: existingTask.id,
  });
}
```

### Solução 3: Usar CRON (Mais Robusto)

O Cron Worker é naturalmente protegido contra duplicação porque:
- Busca tasks no banco (`status = 'processing'`)
- Processa cada task apenas 1 vez
- Se processar novamente, vê que `status = 'completed'` e ignora

## 🎯 **SOLUÇÃO RECOMENDADA:**

Vou implementar **Solução 1 + Solução 2** (proteção dupla):

1. Map em memória (rápido)
2. Verificação no banco (confiável)

