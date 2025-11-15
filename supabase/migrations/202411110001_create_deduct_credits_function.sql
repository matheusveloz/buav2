-- Função para descontar créditos de forma atômica (thread-safe)
-- Previne race conditions quando múltiplos vídeos são processados simultaneamente

CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_email TEXT,
  p_credits_to_deduct INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  new_creditos INTEGER,
  new_creditos_extras INTEGER,
  total_remaining INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_current_creditos INTEGER;
  v_current_creditos_extras INTEGER;
  v_total_available INTEGER;
  v_remaining_to_deduct INTEGER;
  v_new_creditos INTEGER;
  v_new_creditos_extras INTEGER;
BEGIN
  -- Bloquear a linha durante a transação (FOR UPDATE)
  -- Isso garante que apenas uma requisição processe por vez
  SELECT creditos, creditos_extras
  INTO v_current_creditos, v_current_creditos_extras
  FROM emails
  WHERE email = p_email
  FOR UPDATE;

  -- Verificar se o usuário existe
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false, 
      0, 
      0, 
      0, 
      'Usuário não encontrado'::TEXT;
    RETURN;
  END IF;

  -- Calcular total disponível
  v_total_available := COALESCE(v_current_creditos, 0) + COALESCE(v_current_creditos_extras, 0);

  -- Verificar se tem créditos suficientes
  IF v_total_available < p_credits_to_deduct THEN
    RETURN QUERY SELECT 
      false, 
      v_current_creditos, 
      v_current_creditos_extras, 
      v_total_available, 
      'Créditos insuficientes'::TEXT;
    RETURN;
  END IF;

  -- Descontar dos créditos extras primeiro
  v_remaining_to_deduct := p_credits_to_deduct;
  v_new_creditos_extras := COALESCE(v_current_creditos_extras, 0);
  v_new_creditos := COALESCE(v_current_creditos, 0);

  IF v_new_creditos_extras > 0 THEN
    IF v_new_creditos_extras >= v_remaining_to_deduct THEN
      v_new_creditos_extras := v_new_creditos_extras - v_remaining_to_deduct;
      v_remaining_to_deduct := 0;
    ELSE
      v_remaining_to_deduct := v_remaining_to_deduct - v_new_creditos_extras;
      v_new_creditos_extras := 0;
    END IF;
  END IF;

  -- Descontar do restante dos créditos regulares
  IF v_remaining_to_deduct > 0 THEN
    v_new_creditos := v_new_creditos - v_remaining_to_deduct;
  END IF;

  -- Atualizar no banco de dados
  UPDATE emails
  SET 
    creditos = v_new_creditos,
    creditos_extras = v_new_creditos_extras
  WHERE email = p_email;

  -- Retornar resultado
  RETURN QUERY SELECT 
    true, 
    v_new_creditos, 
    v_new_creditos_extras, 
    v_new_creditos + v_new_creditos_extras, 
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Garantir que a função rode com privilégios do owner
ALTER FUNCTION deduct_credits_atomic(TEXT, INTEGER) SECURITY DEFINER;

-- Comentário explicativo
COMMENT ON FUNCTION deduct_credits_atomic IS 'Desconta créditos de forma atômica (thread-safe) para prevenir race conditions em processamento paralelo';

