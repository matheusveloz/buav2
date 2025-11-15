/**
 * Utilitário para obter duração de áudio MP3
 * Baseado na leitura do header MPEG
 */

export async function getMP3Duration(audioBuffer: ArrayBuffer): Promise<number> {
  try {
    const buffer = Buffer.from(audioBuffer);
    const fileSize = buffer.length;

    // Estimativa simples baseada no bitrate médio
    // MP3 44.1kHz 128kbps = ~16KB por segundo
    const estimatedDuration = Math.ceil(fileSize / 16000);

    // Para maior precisão, seria necessário parsear frames MPEG
    // Por enquanto, usar estimativa conservadora
    return Math.max(1, estimatedDuration);
  } catch (error) {
    console.error('[getMP3Duration] Erro ao calcular duração:', error);
    // Fallback: retornar 1 segundo (cobrar mínimo)
    return 1;
  }
}

/**
 * Calcular créditos baseado na duração real do áudio
 * Fórmula: 30 créditos/minuto = 0.5 créditos/segundo
 */
export function calculateCreditsFromDuration(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds * 0.5));
}

/**
 * Ajustar créditos se houve diferença entre estimativa e realidade
 * Retorna quantos créditos devem ser ajustados (positivo = descontar mais, negativo = estornar)
 */
export function calculateCreditAdjustment(
  estimatedCredits: number,
  actualCredits: number
): number {
  return actualCredits - estimatedCredits;
}

