-- ========================================
-- ADICIONAR SOFT DELETE À TABELA videos
-- ========================================
-- 
-- PROBLEMA:
-- Quando usuários FREE deletam vídeos, a contagem diária diminui
-- permitindo gerar mais vídeos do que o permitido (3 por dia)
--
-- SOLUÇÃO:
-- Usar soft delete (deleted_at) ao invés de deletar registro
-- A contagem diária ignora deleted_at (conta TODAS as criações)
-- O histórico filtra deleted_at (não mostra vídeos deletados)
--
-- ========================================

-- 1. Adicionar coluna deleted_at
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Criar índice para otimizar queries de histórico (filtra por deleted_at = NULL)
CREATE INDEX IF NOT EXISTS idx_videos_deleted 
ON videos(user_email, created_at DESC) 
WHERE deleted_at IS NULL;

-- 3. Verificar estrutura
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'videos' 
  AND column_name IN ('deleted_at', 'user_email', 'created_at', 'task_id')
ORDER BY ordinal_position;

-- 4. Testar contagem diária (deve incluir deletados)
SELECT 
  user_email,
  DATE(created_at) as dia,
  COUNT(*) as total_videos,
  SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as videos_deletados,
  SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as videos_visiveis
FROM videos
WHERE created_at >= CURRENT_DATE
GROUP BY user_email, DATE(created_at)
ORDER BY dia DESC, total_videos DESC
LIMIT 20;

-- ========================================
-- COMPORTAMENTO ESPERADO:
-- ========================================
-- 
-- 1. GERAR VÍDEO:
--    - Conta TODOS os vídeos (deleted_at = NULL E deleted_at != NULL)
--    - Se total >= 3 no dia, bloqueia (plano FREE)
--
-- 2. DELETAR VÍDEO:
--    - Define deleted_at = NOW()
--    - Vídeo não aparece no histórico
--    - Mas ainda é contabilizado no limite diário
--
-- 3. HISTÓRICO:
--    - Filtra deleted_at IS NULL
--    - Mostra apenas vídeos ativos
--
-- ========================================

