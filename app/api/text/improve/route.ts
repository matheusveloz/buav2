import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type ImproveMode = 'improve' | 'punctuation' | 'correct';

const PROMPTS: Record<ImproveMode, string> = {
  improve: `Você é um especialista em copywriting e otimização de textos para narração em áudio, utilizando o método AIDA (Atenção, Interesse, Desejo, Ação).

Analise o texto fornecido e crie uma NOVA VERSÃO MELHORADA seguindo a estrutura AIDA:

**A - ATENÇÃO**: Comece captando a atenção com um gancho forte, pergunta impactante ou declaração surpreendente
**I - INTERESSE**: Desenvolva o interesse apresentando informações relevantes e envolventes
**D - DESEJO**: Crie desejo mostrando benefícios, soluções ou transformações possíveis
**A - AÇÃO**: Finalize com um chamado à ação claro e motivador

Além disso:
- Adicione vírgulas e pausas naturais para respiração
- Corrija gramática, ortografia e acentuação
- Torne mais fluido e agradável para leitura em voz alta
- Melhore a estrutura das frases mantendo o significado original
- Use palavras persuasivas e adequadas para narração

IMPORTANTE: Retorne APENAS o texto melhorado no formato AIDA, sem explicações, títulos de seções ou comentários adicionais.`,

  punctuation: `Adicione pontuação adequada (vírgulas, pontos, exclamações, reticências) neste texto para torná-lo perfeito para narração em áudio.

Foque em:
- Vírgulas para pausas naturais e respiração
- Pontos para separar ideias
- Exclamações para ênfase quando apropriado
- Reticências para suspense ou pausa dramática

Retorne APENAS o texto com pontuação corrigida, sem explicações.`,

  correct: `Corrija todos os erros de gramática, ortografia e acentuação neste texto em português do Brasil.

Mantenha:
- O significado original
- O tom e estilo
- A estrutura das frases

Corrija:
- Erros ortográficos
- Acentuação incorreta
- Concordância verbal e nominal
- Pontuação básica

Retorne APENAS o texto corrigido, sem explicações.`,
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { text, mode } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Informe o texto a ser melhorado.' }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Texto muito longo (máx 5000 caracteres).' }, { status: 400 });
    }

    const improveMode = (mode as ImproveMode) || 'improve';
    const systemPrompt = PROMPTS[improveMode] || PROMPTS.improve;

    console.log('[POST /api/text/improve] Melhorando texto:', {
      mode: improveMode,
      textLength: text.length,
      userEmail: user.email,
    });

    // Chamar API do OpenAI GPT-4 mini (barato para texto)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Modelo mais barato para texto
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3, // Baixa temperatura para ser mais preciso
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[POST /api/text/improve] Erro OpenAI:', error);
      return NextResponse.json(
        { error: 'Falha ao melhorar texto com IA.', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    const improvedText = data.choices?.[0]?.message?.content?.trim();

    if (!improvedText) {
      return NextResponse.json({ error: 'Não foi possível melhorar o texto.' }, { status: 500 });
    }

    console.log('[POST /api/text/improve] Texto melhorado com sucesso:', {
      originalLength: text.length,
      improvedLength: improvedText.length,
    });

    return NextResponse.json({
      originalText: text,
      improvedText,
      mode: improveMode,
    });
  } catch (error) {
    console.error('[POST /api/text/improve] Erro inesperado:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao melhorar texto.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

