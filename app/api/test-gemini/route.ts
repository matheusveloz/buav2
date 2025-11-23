import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Endpoint de teste para verificar se a API Gemini está funcionando
export async function GET(request: NextRequest) {
  try {
    const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
    const LAOZHANG_NATIVE_URL = 'https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent';

    console.log('🧪 [TEST GEMINI] Iniciando teste...');
    console.log('🔑 [TEST GEMINI] API Key presente:', !!LAOZHANG_API_KEY);

    if (!LAOZHANG_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'API Key não configurada',
        message: 'LAOZHANG_API_KEY não está definida nas variáveis de ambiente',
      }, { status: 500 });
    }

    // Teste simples: text-to-image sem referências
    const requestBody = {
      contents: [
        {
          parts: [{ text: 'A simple red circle on white background' }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    };

    console.log('📤 [TEST GEMINI] Enviando request de teste...');
    const startTime = Date.now();

    const response = await fetch(LAOZHANG_NATIVE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LAOZHANG_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️ [TEST GEMINI] Resposta em ${elapsed}s`);
    console.log(`📊 [TEST GEMINI] Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TEST GEMINI] Erro HTTP:', response.status, errorText.substring(0, 500));
      
      return NextResponse.json({
        success: false,
        error: 'Erro na API Gemini',
        status: response.status,
        statusText: response.statusText,
        details: errorText.substring(0, 500),
        elapsed: `${elapsed}s`,
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('✅ [TEST GEMINI] Sucesso!');
    console.log('📋 [TEST GEMINI] Candidates:', result.candidates?.length || 0);

    // Verificar se tem imagem
    const hasCandidates = result.candidates && result.candidates.length > 0;
    const hasImage = hasCandidates && result.candidates[0].content?.parts?.some((p: { inlineData?: unknown }) => p.inlineData);

    return NextResponse.json({
      success: true,
      message: 'API Gemini está funcionando!',
      elapsed: `${elapsed}s`,
      hasCandidates,
      hasImage,
      numParts: hasCandidates ? result.candidates[0].content?.parts?.length : 0,
      apiStatus: 'OK',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [TEST GEMINI] Erro crítico:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao testar API',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

