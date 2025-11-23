# 🐛 BUGFIX: Limite Diário de Vídeos (Plano FREE)

## 📋 Problema Identificado

**Sintoma:** Usuários do plano FREE conseguiam gerar mais de 3 vídeos por dia deletando vídeos antigos.

**Causa Raiz:** O sistema contava apenas os vídeos **existentes** no banco para verificar o limite diário. Quando o usuário deletava um vídeo, o registro era removido completamente (`DELETE`), fazendo a contagem diminuir e permitindo gerar mais vídeos.

## ✅ Solução Implementada

### 1. **Soft Delete** ao invés de Hard Delete

Modificado o endpoint `POST /api/video/delete` para marcar vídeos como deletados (`deleted_at`) ao invés de removê-los do banco.

**Antes:**
```typescript
// Deletava completamente o registro
await supabase
  .from('videos')
  .delete()
  .eq('id', videoId);
```

**Depois:**
```typescript
// Marca como deletado (soft delete)
await supabase
  .from('videos')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', videoId);
```

### 2. **Contagem Correta do Limite Diário**

Criado endpoint `GET /api/video/count-today` que conta **TODOS** os vídeos criados no dia, independente de estarem deletados:

```typescript
// ⚠️ NÃO filtra por deleted_at - conta TUDO
const { count } = await supabase
  .from('videos')
  .select('id', { count: 'exact', head: true })
  .eq('user_email', userEmail)
  .gte('created_at', startOfDay.toISOString())
  .lt('created_at', endOfDay.toISOString());
  // Propositalmente não filtra deleted_at
```

### 3. **Histórico Filtrado**

A página de vídeos (`app/avatar-video/page.tsx`) filtra vídeos deletados para não mostrá-los ao usuário:

```typescript
const { data: historyRows } = await supabase
  .from('videos')
  .select('...')
  .eq('user_email', user.email)
  .is('deleted_at', null) // 🔥 Oculta deletados
```

### 4. **Validação Atualizada no Cliente**

O componente `avatar-video-client.tsx` agora usa o endpoint de contagem para validar o limite:

```typescript
// Fazer requisição ao endpoint para contar vídeos do dia (incluindo deletados)
const countResponse = await fetch('/api/video/count-today');
const { count } = await countResponse.json();

if (count >= limiteVideosFreePorDia) {
  // Exibir modal informando que o limite foi atingido
  // ⚠️ Deletar vídeos não aumenta o limite diário
}
```

## 🗄️ Mudanças no Banco de Dados

### Executar SQL no Supabase

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute o arquivo `supabase/ADD_SOFT_DELETE_TO_VIDEOS.sql`

```sql
-- Adicionar coluna deleted_at
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Criar índice para otimizar queries de histórico
CREATE INDEX IF NOT EXISTS idx_videos_deleted 
ON videos(user_email, created_at DESC) 
WHERE deleted_at IS NULL;
```

## 📊 Comportamento Esperado

### Antes da Correção ❌
1. Usuário FREE gera 3 vídeos → ✅ Limite atingido
2. Usuário deleta 1 vídeo → Registro é removido do banco
3. Usuário tenta gerar outro vídeo → ✅ Permitido (BUG!)

### Depois da Correção ✅
1. Usuário FREE gera 3 vídeos → ✅ Limite atingido
2. Usuário deleta 1 vídeo → Registro marcado como `deleted_at = NOW()`
3. Usuário tenta gerar outro vídeo → ❌ **BLOQUEADO**
4. Modal exibe: "Deletar vídeos não aumenta o limite diário"
5. Limite é renovado automaticamente no dia seguinte

## 🎯 Arquivos Modificados

1. ✅ `supabase/ADD_SOFT_DELETE_TO_VIDEOS.sql` - Migration para adicionar coluna
2. ✅ `app/api/video/delete/route.ts` - Soft delete
3. ✅ `app/api/video/count-today/route.ts` - Endpoint de contagem (novo)
4. ✅ `app/avatar-video/page.tsx` - Filtrar deletados no histórico
5. ✅ `app/avatar-video/avatar-video-client.tsx` - Validação atualizada

## 🧪 Como Testar

1. **Criar 3 vídeos com plano FREE**
   - Deve funcionar normalmente

2. **Tentar criar 4º vídeo**
   - Deve exibir modal: "Limite diário atingido"
   - Deve mostrar: "Vídeos gerados hoje: 3/3"

3. **Deletar 1 vídeo**
   - Vídeo some do histórico (UI)
   - Registro continua no banco com `deleted_at`

4. **Tentar criar outro vídeo**
   - Deve exibir modal: "Limite diário atingido"
   - Deve mostrar: "Vídeos gerados hoje: 3/3"
   - Deve avisar: "⚠️ Deletar vídeos não aumenta o limite diário"

5. **Aguardar meia-noite**
   - Limite deve ser renovado automaticamente
   - Usuário pode gerar 3 novos vídeos

## 💡 Benefícios

✅ **Previne abuso do plano FREE**  
✅ **Incentiva upgrade para planos pagos**  
✅ **Mantém histórico para análise/auditoria**  
✅ **Performance otimizada com índices**  
✅ **UX clara sobre o limite diário**

## 📝 Notas

- O storage ainda é limpo quando vídeo é deletado (economiza espaço)
- Apenas o registro no banco é mantido com `deleted_at`
- Limpeza de registros antigos pode ser feita periodicamente (opcional)

