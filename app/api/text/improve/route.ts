import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Verificar se a chave está configurada
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não configurada!');
  console.error('📝 Configure a chave em .env.local: OPENAI_API_KEY=sk-...');
}

type ImproveMode = 'improve' | 'punctuation' | 'correct';
type ContentType = 
  | 'video-script'      // Roteiro de vídeo
  | 'ad-copy'           // Anúncio/propaganda
  | 'narration'         // Narração/locução
  | 'tutorial'          // Tutorial/explicativo
  | 'storytelling'      // História/narrativa
  | 'presentation'      // Apresentação
  | 'podcast'           // Podcast/áudio longo
  | 'image-prompt'      // Prompt de imagem AI
  | 'video-prompt'      // Prompt de vídeo AI (Sora)
  | 'general';          // Geral/outros

const CONTENT_TYPE_PROMPTS: Record<ContentType, string> = {
  'video-script': `Você é um especialista em roteiros para vídeos. Otimize este texto para ser um roteiro de vídeo envolvente e dinâmico.

Estruture o texto seguindo:
1. **GANCHO** (3-5 segundos): Abra com uma frase impactante que prenda a atenção imediatamente
2. **PROBLEMA/CONTEXTO**: Apresente o tema ou problema de forma clara
3. **DESENVOLVIMENTO**: Explique o conteúdo de forma dinâmica e visual
4. **CONCLUSÃO**: Finalize com resumo ou call-to-action

Características:
- Frases curtas e diretas (ideais para vídeo)
- Tom conversacional e natural
- Pausas estratégicas (vírgulas e pontos)
- Linguagem visual ("imagine", "veja", "perceba")
- Ritmo dinâmico mantendo engajamento

Retorne APENAS o roteiro otimizado, sem explicações ou títulos de seções.`,

  'ad-copy': `Você é um copywriter especialista em anúncios persuasivos. Transforme este texto em um anúncio irresistível usando a fórmula AIDA.

**A - ATENÇÃO**: Gancho forte que para o scroll/áudio
**I - INTERESSE**: Mostre por que isso importa
**D - DESEJO**: Crie conexão emocional com benefícios
**A - AÇÃO**: Call-to-action claro e urgente

Técnicas:
- Use gatilhos mentais (escassez, prova social, urgência)
- Foque em benefícios, não características
- Tom persuasivo e emocional
- Frases de impacto
- Linguagem que vende

Retorne APENAS o anúncio otimizado, sem explicações.`,

  'narration': `Você é um especialista em textos para locução/narração profissional. Otimize este texto para ser narrado com clareza e fluidez.

Características para narração:
- Vírgulas estratégicas para respiração natural
- Pontos para pausas claras entre ideias
- Frases nem muito longas, nem muito curtas
- Evite palavras difíceis de pronunciar
- Tom claro e objetivo
- Ritmo constante e agradável
- Estrutura lógica e fácil de acompanhar

Foco:
- Fluência na leitura em voz alta
- Pausas naturais para respiração
- Clareza e dicção perfeita

Retorne APENAS o texto otimizado para narração, sem explicações.`,

  'tutorial': `Você é um especialista em conteúdo educativo. Transforme este texto em um tutorial/explicação clara e didática.

Estrutura:
1. **INTRODUÇÃO**: O que será ensinado (contexto rápido)
2. **PASSO A PASSO**: Informações em ordem lógica e clara
3. **DICAS/OBSERVAÇÕES**: Pontos de atenção importantes
4. **CONCLUSÃO**: Resumo ou próximos passos

Características:
- Linguagem simples e acessível
- Tom didático e paciente
- Exemplos práticos quando possível
- Explicações passo a passo
- Evite jargões técnicos desnecessários

Retorne APENAS o tutorial otimizado, sem explicações.`,

  'storytelling': `Você é um contador de histórias profissional. Transforme este texto em uma narrativa envolvente e cativante.

Elementos narrativos:
1. **INÍCIO**: Contexto/cenário que prende atenção
2. **DESENVOLVIMENTO**: Construa a história com detalhes
3. **CONFLITO/TENSÃO**: Crie interesse e curiosidade
4. **RESOLUÇÃO**: Finalize com impacto ou reflexão

Técnicas:
- Use descrições sensoriais (visão, som, emoção)
- Crie conexão emocional
- Tom envolvente e cinematográfico
- Ritmo variado (tensão e alívio)
- Linguagem rica e expressiva

Retorne APENAS a história otimizada, sem explicações.`,

  'presentation': `Você é um especialista em apresentações profissionais. Otimize este texto para uma apresentação clara e impactante.

Estrutura de apresentação:
1. **ABERTURA**: Afirmação forte ou pergunta intrigante
2. **CONTEXTO**: Situe a audiência no tema
3. **PONTOS PRINCIPAIS**: Organize em tópicos claros
4. **FECHAMENTO**: Conclusão memorável

Características:
- Linguagem profissional mas acessível
- Frases de impacto para slides
- Tom confiante e autoritário
- Estrutura clara e organizada
- Fácil de acompanhar auditivamente

Retorne APENAS a apresentação otimizada, sem explicações.`,

  'podcast': `Você é um especialista em conteúdo para podcast. Otimize este texto para ser falado naturalmente em formato de áudio longo.

Características de podcast:
- Tom conversacional e intimista
- Frases naturais (como se estivesse conversando)
- Pausas para reflexão
- Storytelling casual
- Digressões pertinentes (contexto adicional)
- Linguagem próxima e pessoal
- Ritmo mais relaxado

Técnicas:
- Use "você" e "a gente" (proximidade)
- Inclua transições naturais
- Tom de conversa entre amigos
- Não precisa ser tão direto quanto vídeo

Retorne APENAS o texto otimizado para podcast, sem explicações.`,

  'image-prompt': `Você é um especialista em prompts para geração de imagens com IA (Stable Diffusion, DALL-E, Midjourney, Flux).

Transforme a descrição fornecida em um prompt OTIMIZADO para gerar imagens de alta qualidade.

**ESTRUTURA DO PROMPT IDEAL:**
1. **Sujeito principal**: O que é (pessoa, objeto, cenário)
2. **Ação/pose**: O que está fazendo
3. **Ambiente/cenário**: Onde está, contexto
4. **Estilo artístico**: Fotorrealista, arte digital, pintura, etc.
5. **Iluminação**: Tipo de luz (natural, dramática, golden hour)
6. **Qualidade**: Termos técnicos (4K, highly detailed, professional)
7. **Câmera/composição**: Ângulo, perspectiva, focal

**TÉCNICAS DE OTIMIZAÇÃO:**
- Use inglês se necessário para termos técnicos específicos
- Seja específico e descritivo (não vago)
- Adicione detalhes visuais importantes (cores, texturas, atmosfera)
- Inclua qualificadores de qualidade (masterpiece, best quality, highly detailed)
- Especifique estilo quando relevante (realistic, anime, oil painting, etc)
- Mencione iluminação e mood (dramatic lighting, soft light, cinematic)

**EXEMPLO:**
Entrada: "uma mulher bonita"
Saída: "Beautiful woman with long flowing hair, elegant pose, studio lighting, photorealistic portrait, professional photography, soft bokeh background, 4K, highly detailed, natural makeup, confident expression"

Retorne APENAS o prompt otimizado, sem explicações.`,

  'video-prompt': `Você é um especialista em prompts para geração de vídeos com IA (Sora 2, RunwayML, Pika Labs).

Transforme a descrição fornecida em um prompt OTIMIZADO para gerar vídeos cinematográficos de alta qualidade.

**ESTRUTURA DO PROMPT IDEAL PARA VÍDEO:**
1. **Cena principal**: O que está acontecendo (ação, movimento)
2. **Sujeito(s)**: Quem ou o que está na cena
3. **Movimento da câmera**: Dolly, pan, zoom, steadicam, drone shot
4. **Ambiente/cenário**: Onde a ação acontece, hora do dia
5. **Estilo visual**: Cinematográfico, documentário, comercial, anime
6. **Iluminação e atmosfera**: Natural, dramática, neon, golden hour
7. **Movimento e dinâmica**: Velocidade, fluidez, transições
8. **Qualidade técnica**: 4K, cinematic, professional, smooth motion

**TÉCNICAS ESPECÍFICAS PARA VÍDEO:**
- Descreva MOVIMENTO (pessoas andando, objetos se movendo, câmera em movimento)
- Especifique o tipo de shot (close-up, wide shot, tracking shot, aerial view)
- Mencione velocidade (slow motion, time-lapse, real-time)
- Inclua direção da câmera (moving forward, panning left, tilting up)
- Descreva transições naturais e fluidez
- Foco em continuidade e coerência temporal
- Use termos cinematográficos (cinematic, filmic, lens flare, depth of field)

**EXEMPLOS:**
Entrada: "um carro na estrada"
Saída: "Cinematic tracking shot following a sleek sports car driving on a coastal highway at sunset, camera smoothly panning alongside the vehicle, golden hour lighting, ocean waves crashing in background, aerial drone perspective gradually descending, 4K quality, professional cinematography, smooth motion, lens flare from setting sun"

Entrada: "pessoa caminhando"
Saída: "Medium shot of a confident person walking through a busy city street at night, camera dolly moving forward at walking pace, neon lights reflecting on wet pavement, shallow depth of field with bokeh background, cinematic color grading, smooth steadicam movement, urban cyberpunk atmosphere, 4K professional footage"

**IMPORTANTE:** 
- Retorne o prompt TOTALMENTE EM INGLÊS (melhor para geração de vídeos)
- Traduza palavras em português para inglês
- Use terminologia cinematográfica profissional em inglês
- Mantenha o prompt conciso mas detalhado (ideal: 150-300 caracteres)
- NÃO adicione explicações, comentários ou formatação extra
- Retorne APENAS o prompt otimizado em inglês puro`,

  'general': `Você é um especialista em otimização de textos para áudio. Melhore este texto para ser claro, envolvente e agradável ao ouvir.

Melhorias gerais:
- Corrija gramática, ortografia e acentuação
- Adicione pontuação adequada para pausas naturais
- Torne as frases fluidas e bem estruturadas
- Melhore a clareza e objetividade
- Mantenha tom profissional mas acessível
- Organize ideias de forma lógica

Retorne APENAS o texto melhorado, sem explicações.`,
};

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
    // Verificar se a chave da OpenAI está configurada
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada!');
      return NextResponse.json(
        { 
          error: 'Serviço de melhoria de texto não configurado.',
          details: 'A chave da API da OpenAI não está configurada no servidor. Configure OPENAI_API_KEY em .env.local'
        },
        { status: 500 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { text, mode, contentType } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Informe o texto a ser melhorado.' }, { status: 400 });
    }

    if (text.length > 5000) {
      return NextResponse.json({ error: 'Texto muito longo (máx 5000 caracteres).' }, { status: 400 });
    }

    const improveMode = (mode as ImproveMode) || 'improve';
    const userContentType = (contentType as ContentType) || 'general';
    
    // Se o modo é 'improve', usa o prompt baseado no tipo de conteúdo
    // Se for 'punctuation' ou 'correct', usa os prompts específicos
    const systemPrompt = improveMode === 'improve' 
      ? CONTENT_TYPE_PROMPTS[userContentType]
      : PROMPTS[improveMode];

    console.log('[POST /api/text/improve] Melhorando texto:', {
      mode: improveMode,
      contentType: userContentType,
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
      contentType: userContentType,
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

