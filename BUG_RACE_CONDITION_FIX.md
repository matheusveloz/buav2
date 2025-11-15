# 🐛 BUG CRÍTICO: Race Condition na Cobrança de Créditos

## 📋 Descrição do Problema

Quando múltiplos vídeos são processados **simultaneamente**, apenas o último desconto de créditos era mantido, sobrescrevendo os anteriores.

### Exemplo Real:
```
Usuário com 100 créditos processa 3 vídeos ao mesmo tempo:
- Vídeo 1: 50 segundos = 51 créditos
- Vídeo 2: 12 segundos = 13 créditos  
- Vídeo 3: 12 segundos = 13 créditos

✅ Total esperado: 51 + 13 + 13 = 77 créditos
❌ Total cobrado: 51 créditos (BUG!)
```

## 🔍 Causa Raiz: Race Condition

O problema ocorria porque 3 requisições paralelas liam o saldo ao mesmo tempo:

```
T0: Usuário tem 100 créditos

Requisição 1 (50s): SELECT → 100 créditos → calcula 100 - 51 = 49
Requisição 2 (12s): SELECT → 100 créditos → calcula 100 - 13 = 87  ⚠️
Requisição 3 (12s): SELECT → 100 créditos → calcula 100 - 13 = 87  ⚠️

T1: Requisição 1 UPDATE → 49 créditos ✅
T2: Requisição 2 UPDATE → 87 créditos ❌ (sobrescreve!)
T3: Requisição 3 UPDATE → 87 créditos ❌ (sobrescreve!)

Resultado final: 87 créditos (descontou apenas 13!)
```

## ✅ Solução Implementada

Criamos uma **função RPC atômica** no PostgreSQL que usa `FOR UPDATE` para bloquear a linha durante a transação:

```sql
CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_email TEXT,
  p_credits_to_deduct INTEGER
)
```

### Como funciona:
1. `SELECT ... FOR UPDATE` **bloqueia a linha** do usuário
2. Outras requisições **esperam** até a primeira terminar
3. Cada desconto é processado **sequencialmente**
4. Não há sobrescrita de valores

### Fluxo corrigido:
```
T0: Usuário tem 100 créditos

Requisição 1 (50s): LOCK → SELECT 100 → UPDATE 49 → UNLOCK ✅
Requisição 2 (12s): AGUARDA → LOCK → SELECT 49 → UPDATE 36 → UNLOCK ✅  
Requisição 3 (12s): AGUARDA → LOCK → SELECT 36 → UPDATE 23 → UNLOCK ✅

Resultado final: 23 créditos (descontou 77 corretamente!)
```

## 🚀 Como Aplicar a Correção

### 1. Aplicar Migration no Supabase

Execute o SQL no Supabase SQL Editor:

```bash
# Copie o conteúdo de:
supabase/APPLY_DEDUCT_CREDITS_FUNCTION.sql
```

Ou pela CLI:

```bash
supabase migration up
```

### 2. Verificar se a função foi criada

```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'deduct_credits_atomic';
```

### 3. Testar a função

```sql
-- Teste com seu email
SELECT * FROM deduct_credits_atomic('seu-email@exemplo.com', 51);

-- Resultado esperado:
-- success | new_creditos | new_creditos_extras | total_remaining | error_message
-- true    | 49           | 0                   | 49              | NULL
```

## 📊 Impacto da Correção

### Antes (com bug):
- ❌ Cobrança inconsistente em processamento paralelo
- ❌ Usuários sendo sub-cobrados
- ❌ Perda de receita
- ❌ Dados incorretos no banco

### Depois (corrigido):
- ✅ Cobrança precisa SEMPRE
- ✅ Thread-safe (seguro para concorrência)
- ✅ Sem perda de receita
- ✅ Dados consistentes

## 🧪 Como Testar

1. **Adicionar créditos de teste:**
```sql
UPDATE emails SET creditos = 100 WHERE email = 'seu-email@test.com';
```

2. **Processar 3 vídeos simultaneamente:**
   - Vídeo 1: 50s (51 créditos)
   - Vídeo 2: 12s (13 créditos)
   - Vídeo 3: 12s (13 créditos)

3. **Verificar saldo final:**
```sql
SELECT creditos, creditos_extras 
FROM emails 
WHERE email = 'seu-email@test.com';
-- Deve retornar: creditos = 23 (100 - 77)
```

## 🔧 Arquivos Modificados

1. ✅ `supabase/migrations/202411110001_create_deduct_credits_function.sql` - Migration
2. ✅ `supabase/APPLY_DEDUCT_CREDITS_FUNCTION.sql` - Script para aplicar
3. ✅ `app/api/lipsync/route.ts` - API atualizada para usar RPC
4. ✅ `BUG_RACE_CONDITION_FIX.md` - Esta documentação

## ⚠️ IMPORTANTE

Esta correção **NÃO afeta** vídeos já processados. É apenas para garantir que **futuros processamentos** sejam cobrados corretamente.

Para ajustar cobranças incorretas do passado, será necessário um script de correção manual.

---

## 💡 Lições Aprendidas

1. **Sempre use operações atômicas** para modificar dados compartilhados
2. **Race conditions** são difíceis de debugar (não aparecem sempre)
3. **Teste com carga paralela** antes de produção
4. **PostgreSQL `FOR UPDATE`** é perfeito para esse tipo de problema
5. **Funções RPC** no Supabase são mais seguras que UPDATE direto

---

**Correção implementada em:** 11/11/2024  
**Desenvolvedor:** AI Assistant  
**Prioridade:** 🔴 CRÍTICA

