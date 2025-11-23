import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST V3] Testando API diretamente...');
    console.log('🧪 [TEST V3] API Key disponível:', !!LAOZHANG_API_KEY);

    // Teste 1: Prompt simples em inglês
    const requestBody = {
      contents: [
        {
          parts: [{ text: "A cute cat" }],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '1K',
        },
      },
    };

    console.log('🧪 [TEST V3] Request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      'https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LAOZHANG_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120000), // 2 minutos
      }
    );

    console.log('🧪 [TEST V3] Response status:', response.status);

    const result = await response.json();
    
    console.log('🧪 [TEST V3] Response:', JSON.stringify(result, null, 2).substring(0, 3000));

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      hasCandidates: !!result.candidates && result.candidates.length > 0,
      candidatesLength: result.candidates?.length,
      result: result,
    });

  } catch (error) {
    console.error('❌ [TEST V3] Error:', error);
    return NextResponse.json(
      { 
        error: 'Test failed', 
        details: error instanceof Error ? error.message : 'Unknown' 
      },
      { status: 500 }
    );
  }
}

