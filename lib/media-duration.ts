/**
 * Extrai a duração de um arquivo de áudio/vídeo em segundos
 * usando análise do buffer
 */
export async function getMediaDuration(buffer: ArrayBuffer): Promise<number> {
  try {
    // Converter para Uint8Array
    const uint8Array = new Uint8Array(buffer);
    
    // Procurar pelo atom 'mvhd' (Movie Header) no MP4
    // Este atom contém a duração do vídeo
    const mvhdIndex = findAtom(uint8Array, 'mvhd');
    
    if (mvhdIndex !== -1) {
      // A duração está 16 bytes após o início do mvhd
      // Formato: timescale (4 bytes) + duration (4 bytes)
      const offset = mvhdIndex + 20; // Pular versão, flags, creation time, modification time
      
      const timescale = readUint32(uint8Array, offset);
      const duration = readUint32(uint8Array, offset + 4);
      
      if (timescale > 0 && duration > 0) {
        const durationSeconds = Math.floor(duration / timescale);
        console.log('📏 Duração extraída do vídeo:', {
          timescale,
          duration,
          durationSeconds,
        });
        return durationSeconds;
      }
    }
    
    // Fallback: tentar extrair do atom stts (Sample Table Time-to-Sample)
    const sttsIndex = findAtom(uint8Array, 'stts');
    if (sttsIndex !== -1) {
      // Implementação simplificada
      console.warn('Usando atom stts para calcular duração (menos preciso)');
    }
    
    console.warn('Não foi possível extrair duração do vídeo, retornando 0');
    return 0;
  } catch (error) {
    console.error('Erro ao calcular duração do vídeo:', error);
    return 0;
  }
}

/**
 * Encontra um atom MP4 no buffer
 */
function findAtom(buffer: Uint8Array, atomName: string): number {
  const atomBytes = new TextEncoder().encode(atomName);
  
  for (let i = 0; i < buffer.length - atomBytes.length; i++) {
    let match = true;
    for (let j = 0; j < atomBytes.length; j++) {
      if (buffer[i + j] !== atomBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Lê um inteiro de 32 bits (big-endian) do buffer
 */
function readUint32(buffer: Uint8Array, offset: number): number {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  );
}

/**
 * Alternativa: Se a análise binária falhar, usar a duração reportada pela API
 * mas com validação de sanidade
 */
export function validateAndCalculateDuration(
  apiDurationMs: number | undefined,
  apiExecutionMs: number | undefined
): number {
  // Priorizar sttResult.tl (duração do áudio transcrito)
  if (apiDurationMs !== undefined && apiDurationMs > 0) {
    // Se for muito grande (>100000 = 100 segundos), provavelmente está em ms
    // Se for pequeno, pode já estar em segundos
    if (apiDurationMs > 100000) {
      return Math.floor(apiDurationMs / 1000);
    } else if (apiDurationMs > 1000) {
      // Entre 1000 e 100000, dividir por 1000
      return Math.floor(apiDurationMs / 1000);
    } else {
      // Menor que 1000, provavelmente já é em segundos
      return Math.floor(apiDurationMs);
    }
  }
  
  // Fallback para execution time
  if (apiExecutionMs !== undefined && apiExecutionMs > 0) {
    if (apiExecutionMs > 1000) {
      return Math.floor(apiExecutionMs / 1000);
    }
    return Math.floor(apiExecutionMs);
  }
  
  return 0;
}

