-- ========================================
-- ADICIONAR SOFT DELETE À TABELA generated_images
-- ========================================
-- 
-- PROBLEMA:
-- Quando usuários FREE deletam imagens, a contagem diária diminui
-- permitindo gerar mais imagens do que o permitido (4 por dia)
--
-- SOLUÇÃO:
-- Usar soft delete (deleted_at) ao invés de deletar registro
-- A contagem diária ignora deleted_at (conta TODAS as criações)
-- O histórico filtra deleted_at (não mostra imagens deletadas)
--
-- ========================================

-- 1. Adicionar coluna deleted_at
ALTER TABLE generated_images 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Criar índice para otimizar queries de histórico (filtra por deleted_at = NULL)
CREATE INDEX IF NOT EXISTS idx_generated_images_deleted 
ON generated_images(user_email, created_at DESC) 
WHERE deleted_at IS NULL;

-- 3. Verificar estrutura
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'generated_images' 
  AND column_name IN ('deleted_at', 'user_email', 'created_at', 'num_images')
ORDER BY ordinal_position;

-- 4. Testar contagem diária (deve incluir deletadas)
SELECT 
  user_email,
  DATE(created_at) as dia,
  COUNT(*) as total_geracoes,
  SUM(num_images) as total_imagens,
  SUM(CASE WHEN deleted_at IS NOT NULL THEN num_images ELSE 0 END) as imagens_deletadas,
  SUM(CASE WHEN deleted_at IS NULL THEN num_images ELSE 0 END) as imagens_visiveis
FROM generated_images
WHERE created_at >= CURRENT_DATE
GROUP BY user_email, DATE(created_at)
ORDER BY dia DESC, total_imagens DESC
LIMIT 20;

-- ========================================
-- COMPORTAMENTO ESPERADO:
-- ========================================
-- 
-- 1. GERAR IMAGEM:
--    - Conta TODAS as imagens (deleted_at = NULL E deleted_at != NULL)
--    - Se total >= 4 no dia, bloqueia (plano FREE)
--
-- 2. DELETAR IMAGEM:
--    - Define deleted_at = NOW()
--    - Remove do histórico visual
--    - MAS ainda conta para o limite diário
--
-- 3. HISTÓRICO:
--    - Mostra apenas deleted_at IS NULL
--
-- ========================================

