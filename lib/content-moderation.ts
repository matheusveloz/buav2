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
 * 🎬 AJUSTADO: Permite conteúdo de ação/esportes radicais
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

    // 🎬 FILTRO INTELIGENTE: Detectar falsos positivos de ação/esportes
    const isActionSports = /\b(parkour|bicicleta|skate|gopro|câmera|primeira pessoa|esporte|radical|acrobacia|salto|pulo|escalada|surf|snowboard|motocross)\b/i.test(prompt);
    const hasViolenceContext = /\b(sangue|matar|morte|assassinar|tortura|arma|tiro|facada|espancamento|briga|agressão)\b/i.test(prompt);
    
    // Se é conteúdo de ação/esportes E não tem violência explícita, PERMITIR
    if (isActionSports && !hasViolenceContext) {
      console.log('✅ Prompt aprovado: Conteúdo de ação/esportes radicais detectado');
      return {
        flagged: false,
        categories: {},
        categoryScores: result.category_scores,
        reason: 'action_sports_allowed',
      };
    }

    // Para outras categorias, usar score threshold mais alto (menos sensível)
    const isViolenceHighScore = (result.category_scores.violence || 0) > 0.8; // Era blocado com score > 0.5
    const isViolenceGraphicHighScore = (result.category_scores['violence/graphic'] || 0) > 0.8;
    
    // Só bloquear violência se for REALMENTE alta (> 80%)
    const shouldBlockViolence = (result.categories.violence || result.categories['violence/graphic']) && 
                                (isViolenceHighScore || isViolenceGraphicHighScore);

    // Criar flagged customizado
    const customFlagged = 
      result.categories.sexual || 
      result.categories['sexual/minors'] || 
      result.categories.hate || 
      result.categories['harassment/threatening'] || 
      result.categories['self-harm'] || 
      shouldBlockViolence;

    if (customFlagged) {
      console.warn('🚫 CONTEÚDO IMPRÓPRIO DETECTADO:', {
        categories: result.categories,
        categoryScores: result.category_scores,
        customFiltered: true,
      });
    } else {
      console.log('✅ Prompt aprovado pela moderação');
    }

    return {
      flagged: customFlagged,
      categories: {
        sexual: result.categories.sexual || result.categories['sexual/minors'],
        violence: shouldBlockViolence,
        hate: result.categories.hate,
        harassment: result.categories.harassment || result.categories['harassment/threatening'],
        selfHarm: result.categories['self-harm'],
        sexualMinors: result.categories['sexual/minors'],
        violenceGraphic: result.categories['violence/graphic'] && isViolenceGraphicHighScore,
      },
      categoryScores: result.category_scores,
      reason: customFlagged ? getModerationReason(result.categories) : undefined,
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
 * @param version - '1.0' para Buua Legado (só desenhos/objetos), '2.0' para Buua High (pessoas permitidas)
 */
export async function moderateContent(
  prompt: string, 
  imageBase64?: string,
  version: '1.0' | '2.0' | '3.0' = '2.0'
): Promise<{
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

  // 2. Moderar imagem (celebridades + crianças + rostos reais + nudez + obsceno)
  if (imageBase64) {
    const { 
      detectCelebrityWithGPT, 
      shouldBlockBuua10, 
      shouldBlockBuua20,
      shouldBlockBuua30,
      getBlockMessageBuua10,
      getBlockMessageBuua20,
      getBlockMessageBuua30,
    } = await import('./celebrity-detection-gpt');
    
    const detectionResult = await detectCelebrityWithGPT(imageBase64);
    
    // Aplicar regras específicas por versão
    if (version === '1.0') {
      // BUUA 1.0: Bloquear rostos reais, nudez, obsceno
      if (shouldBlockBuua10(detectionResult)) {
        return {
          blocked: true,
          reason: detectionResult.hasNudity ? 'nudity' : 
                  detectionResult.hasObscene ? 'obscene' : 
                  detectionResult.hasRealFace ? 'real_face' : 'content',
          details: getBlockMessageBuua10(detectionResult),
        };
      }
    } else if (version === '3.0') {
      // BUUA 3.0: Mais permissivo - apenas bloqueia nudez explícita e obsceno
      if (shouldBlockBuua30(detectionResult)) {
        return {
          blocked: true,
          reason: detectionResult.hasNudity ? 'nudity' : 
                  detectionResult.hasObscene ? 'obscene' : 'content',
          details: getBlockMessageBuua30(detectionResult),
        };
      }
    } else {
      // BUUA 2.0: Bloquear crianças, celebridades, nudez, obsceno (permite pessoas)
      if (shouldBlockBuua20(detectionResult)) {
        return {
          blocked: true,
          reason: detectionResult.hasNudity ? 'nudity' : 
                  detectionResult.hasObscene ? 'obscene' :
                  detectionResult.isChild ? 'child' : 
                  detectionResult.isCelebrity ? 'celebrity' : 'content',
          details: getBlockMessageBuua20(detectionResult),
        };
      }
    }
  }

  return { blocked: false };
}

