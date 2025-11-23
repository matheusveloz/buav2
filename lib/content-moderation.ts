/**
 * 🛡️ MODERAÇÃO DE CONTEÚDO com OpenAI
 * Detecta conteúdo explícito, violento, sexual, etc.
 */

interface ModerationResult {
  flagged: boolean;
  categories: {
    sexual?: boolean;
    violence?: boolean;
    hate?: boolean;
    harassment?: boolean;
    selfHarm?: boolean;
    sexualMinors?: boolean;
    violenceGraphic?: boolean;
  };
  categoryScores: Record<string, number>;
  reason?: string;
}

/**
 * 🔍 MODERA O PROMPT usando OpenAI Moderation API
 * Custo: GRÁTIS! (API de moderação não cobra)
 * 
 * ⚡ Com timeout de 3 segundos para não travar a experiência
 */
export async function moderatePrompt(prompt: string): Promise<ModerationResult> {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada');
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
      };
    }

    console.log('🛡️ Moderando conteúdo do prompt...');

    // ⏱️ TIMEOUT: Se demorar > 3 segundos, continua sem bloquear
    const moderationPromise = fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: prompt,
      }),
    });

    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Moderation timeout')), 3000);
    });

    const response = await Promise.race([moderationPromise, timeoutPromise]);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na Moderation API:', response.status, errorText);
      // Em caso de erro, não bloquear (fail-safe)
      return {
        flagged: false,
        categories: {},
        categoryScores: {},
      };
    }

    const data = await response.json();
    const result = data.results[0];

    if (result.flagged) {
      console.warn('🚫 CONTEÚDO IMPRÓPRIO DETECTADO:', {
        categories: result.categories,
        categoryScores: result.category_scores,
      });
    } else {
      console.log('✅ Prompt aprovado pela moderação');
    }

    return {
      flagged: result.flagged,
      categories: {
        sexual: result.categories.sexual || result.categories['sexual/minors'],
        violence: result.categories.violence || result.categories['violence/graphic'],
        hate: result.categories.hate,
        harassment: result.categories.harassment || result.categories['harassment/threatening'],
        selfHarm: result.categories['self-harm'],
        sexualMinors: result.categories['sexual/minors'],
        violenceGraphic: result.categories['violence/graphic'],
      },
      categoryScores: result.category_scores,
      reason: getModerationReason(result.categories),
    };

  } catch (error) {
    const err = error as Error;
    if (err.message === 'Moderation timeout') {
      console.warn('⏱️ Moderação excedeu 3s - continuando sem bloquear (fail-safe)');
    } else {
      console.error('❌ Erro na moderação:', error);
    }
    // Em caso de erro/timeout, não bloquear (fail-safe)
    return {
      flagged: false,
      categories: {},
      categoryScores: {},
    };
  }
}

/**
 * Retorna mensagem amigável baseada nas categorias detectadas
 */
function getModerationReason(categories: Record<string, boolean>): string {
  const detected = [];

  if (categories.sexual || categories['sexual/minors']) {
    detected.push('conteúdo sexual');
  }
  if (categories.violence || categories['violence/graphic']) {
    detected.push('violência');
  }
  if (categories.hate) {
    detected.push('discurso de ódio');
  }
  if (categories.harassment) {
    detected.push('assédio');
  }
  if (categories['self-harm']) {
    detected.push('automutilação');
  }

  if (detected.length === 0) {
    return 'Conteúdo impróprio';
  }

  return detected.join(', ');
}

/**
 * Retorna mensagem de erro amigável
 */
export function getModerationBlockMessage(result: ModerationResult): string {
  return `🚫 Conteúdo Impróprio Detectado\n\n` +
         `Detectamos ${result.reason || 'conteúdo impróprio'} na sua descrição.\n\n` +
         `⚠️ Por favor, reformule sua descrição respeitando nossas políticas de uso.\n\n` +
         `❌ Não é permitido:\n` +
         `• Conteúdo sexual ou adulto\n` +
         `• Violência explícita\n` +
         `• Discurso de ódio\n` +
         `• Assédio ou bullying\n\n` +
         `✅ Tente: Descrições criativas e adequadas para todos os públicos.`;
}

/**
 * 🎯 MODERAÇÃO COMPLETA: Prompt + Imagem
 */
export async function moderateContent(prompt: string, imageBase64?: string): Promise<{
  blocked: boolean;
  reason?: string;
  details?: string;
}> {
  // 1. Moderar prompt
  const promptModeration = await moderatePrompt(prompt);
  
  if (promptModeration.flagged) {
    return {
      blocked: true,
      reason: 'prompt',
      details: getModerationBlockMessage(promptModeration),
    };
  }

  // 2. Moderar imagem (celebridades + crianças)
  if (imageBase64) {
    const { detectCelebrityWithGPT, shouldBlockGeneration, getBlockMessage } = await import('./celebrity-detection-gpt');
    
    const detectionResult = await detectCelebrityWithGPT(imageBase64);
    
    if (shouldBlockGeneration(detectionResult)) {
      return {
        blocked: true,
        reason: detectionResult.isChild ? 'child' : 'celebrity',
        details: getBlockMessage(detectionResult),
      };
    }
  }

  return { blocked: false };
}

