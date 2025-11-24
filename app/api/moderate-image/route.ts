import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // 30 segundos é suficiente para moderação

/**
 * 🛡️ API de MODERAÇÃO INSTANTÂNEA de imagens
 * Valida a imagem ANTES do usuário clicar em "Gerar"
 * Retorna se a imagem é permitida para Buua 1.0 ou 2.0
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🛡️ [POST /api/moderate-image] Moderação instantânea...');

    const body = await request.json();
    const { imageBase64, version = '2.0' } = body as { 
      imageBase64: string; 
      version: '1.0' | '2.0';
    };

    if (!imageBase64) {
      return NextResponse.json({ error: 'Imagem não fornecida' }, { status: 400 });
    }

    // Validar versão
    if (version !== '1.0' && version !== '2.0') {
      return NextResponse.json({ error: 'Versão inválida' }, { status: 400 });
    }

    console.log(`🔍 Analisando imagem para Buua ${version}...`);

    // Importar módulos de moderação
    const { 
      detectCelebrityWithGPT, 
      shouldBlockBuua10, 
      shouldBlockBuua20,
      getBlockMessageBuua10,
      getBlockMessageBuua20,
    } = await import('@/lib/celebrity-detection-gpt');

    // Detectar conteúdo na imagem
    const detectionResult = await detectCelebrityWithGPT(imageBase64);

    let isBlocked = false;
    let blockMessage = '';
    let blockReason = '';

    // Aplicar regras específicas por versão
    if (version === '1.0') {
      isBlocked = shouldBlockBuua10(detectionResult);
      blockMessage = getBlockMessageBuua10(detectionResult);
      
      if (detectionResult.hasNudity) {
        blockReason = 'nudity';
      } else if (detectionResult.hasObscene) {
        blockReason = 'obscene';
      } else if (detectionResult.hasRealFace) {
        blockReason = 'real_face';
      }
    } else {
      isBlocked = shouldBlockBuua20(detectionResult);
      blockMessage = getBlockMessageBuua20(detectionResult);
      
      if (detectionResult.hasNudity) {
        blockReason = 'nudity';
      } else if (detectionResult.hasObscene) {
        blockReason = 'obscene';
      } else if (detectionResult.isChild) {
        blockReason = 'child';
      } else if (detectionResult.isCelebrity) {
        blockReason = 'celebrity';
      }
    }

    if (isBlocked) {
      console.warn(`🚫 [BUUA ${version}] Imagem bloqueada:`, {
        reason: blockReason,
        hasRealFace: detectionResult.hasRealFace,
        hasNudity: detectionResult.hasNudity,
        hasObscene: detectionResult.hasObscene,
        isChild: detectionResult.isChild,
        isCelebrity: detectionResult.isCelebrity,
      });

      return NextResponse.json({
        allowed: false,
        blocked: true,
        reason: blockReason,
        message: blockMessage,
        details: {
          hasRealFace: detectionResult.hasRealFace,
          hasNudity: detectionResult.hasNudity,
          hasObscene: detectionResult.hasObscene,
          isChild: detectionResult.isChild,
          isCelebrity: detectionResult.isCelebrity,
          name: detectionResult.name,
          estimatedAge: detectionResult.estimatedAge,
          confidence: detectionResult.confidence,
        },
      });
    }

    console.log(`✅ [BUUA ${version}] Imagem aprovada!`);

    return NextResponse.json({
      allowed: true,
      blocked: false,
      message: '✅ Imagem aprovada! Pode continuar.',
      details: {
        hasRealFace: detectionResult.hasRealFace,
        hasNudity: detectionResult.hasNudity,
        hasObscene: detectionResult.hasObscene,
        isChild: detectionResult.isChild,
        isCelebrity: detectionResult.isCelebrity,
        confidence: detectionResult.confidence,
      },
    });

  } catch (error) {
    console.error('❌ Erro na moderação de imagem:', error);
    
    // Em caso de erro, PERMITIR (fail-safe)
    return NextResponse.json({
      allowed: true,
      blocked: false,
      message: '✅ Imagem aprovada (moderação indisponível)',
      error: 'Erro na moderação',
    });
  }
}

