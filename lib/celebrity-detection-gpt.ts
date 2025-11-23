/**
 * 🔍 CELEBRITY DETECTION usando GPT-4o Vision
 * Detecta celebridades e crianças em imagens usando OpenAI
 * Simples, preciso e econômico!
 */

interface CelebrityDetectionResult {
  isCelebrity: boolean;
  isChild: boolean;
  name?: string;
  reason?: string;
  estimatedAge?: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 🎯 DETECTA CELEBRIDADES E CRIANÇAS USANDO GPT-4o VISION
 * Custo: ~$0.003 por imagem (muito barato!)
 */
export async function detectCelebrityWithGPT(imageBase64: string): Promise<CelebrityDetectionResult> {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada');
      return {
        isCelebrity: false,
        isChild: false,
        confidence: 'low',
      };
    }

    console.log('🔍 Analisando imagem com GPT-4o Vision...');

    // Preparar imagem (remover prefixo se necessário)
    let imageData = imageBase64;
    if (!imageBase64.startsWith('data:image')) {
      imageData = `data:image/jpeg;base64,${imageBase64}`;
    }

    // Chamar GPT-4o Vision
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Mais barato: $0.0004 por imagem!
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and answer in JSON format ONLY:

{
  "isCelebrity": true/false,
  "isChild": true/false,
  "name": "celebrity name if detected",
  "reason": "brief explanation",
  "estimatedAge": number (if visible),
  "confidence": "high/medium/low"
}

RULES:
1. isCelebrity = true if person is famous (actor, politician, athlete, influencer, etc.)
2. isChild = true ONLY if person appears CLEARLY under 16 years old (be conservative)
   - Young adults (18-25) who look youthful should be marked as FALSE
   - Teenagers (16-17) should be marked as FALSE
   - Only mark true if clearly a child (under 16)
3. Be strict on celebrities: even if 10% similar to a celebrity, flag it
4. Consider: Elon Musk, Trump, Biden, Taylor Swift, Kardashians, Ronaldo, Messi, etc.
5. If no person in image, return all false
6. When in doubt about age, prefer FALSE (allow) to avoid false positives

IMPORTANT: Young-looking adults (18-25) are NOT children. Be conservative.

Respond ONLY with JSON, no markdown, no explanation.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                  detail: 'low', // Mais barato e suficiente
                },
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.1, // Mais determinístico
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na OpenAI API:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da OpenAI');
    }

    // Parse JSON da resposta
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result: CelebrityDetectionResult = JSON.parse(cleanContent);

    // Log resultado
    if (result.isCelebrity) {
      console.log(`🎭 GPT-4o: Celebridade detectada: ${result.name} (${result.confidence} confiança)`);
    }
    if (result.isChild) {
      console.log(`👶 GPT-4o: Criança detectada - Idade estimada: ${result.estimatedAge} anos`);
    }
    if (!result.isCelebrity && !result.isChild) {
      console.log(`✅ GPT-4o: Imagem aprovada - Nenhuma restrição detectada`);
    }

    return result;

  } catch (error) {
    console.error('❌ Erro no GPT-4o Vision:', error);
    // Em caso de erro, NÃO bloquear (fail-safe)
    return {
      isCelebrity: false,
      isChild: false,
      confidence: 'low',
      reason: 'Erro na análise',
    };
  }
}

/**
 * Verifica se deve bloquear baseado no resultado
 */
export function shouldBlockGeneration(result: CelebrityDetectionResult): boolean {
  // 🛡️ BLOQUEAR SE FOR CRIANÇA (mas só se tiver certeza)
  if (result.isChild) {
    // Se tem idade estimada, verificar se é realmente menor
    if (result.estimatedAge && result.estimatedAge >= 16) {
      console.log(`⚠️ Idade ${result.estimatedAge} - considerado adulto jovem, permitindo`);
      return false; // Adolescentes 16+ podem usar
    }
    
    // Se confiança for baixa, não bloquear (evitar falsos positivos)
    if (result.confidence === 'low') {
      console.log(`⚠️ Confiança baixa na detecção de criança, permitindo`);
      return false;
    }
    
    console.log(`🚫 BLOQUEANDO: Criança detectada (idade: ${result.estimatedAge}, confiança: ${result.confidence})`);
    return true;
  }

  // Bloquear celebridades com alta ou média confiança
  if (result.isCelebrity && (result.confidence === 'high' || result.confidence === 'medium')) {
    return true;
  }

  return false;
}

/**
 * Retorna mensagem de erro amigável
 */
export function getBlockMessage(result: CelebrityDetectionResult): string {
  if (result.isChild && result.isCelebrity) {
    return `🚫 Conteúdo não permitido\n\n` +
           `Detectamos uma pessoa famosa (${result.name || 'celebridade'}) que aparenta ser menor de idade` +
           (result.estimatedAge ? ` (~${result.estimatedAge} anos)` : '') + `.\n\n` +
           `⚠️ Por políticas de proteção infantil e anti-deepfake, não podemos processar essa imagem.\n\n` +
           `✅ Use: Avatares fictícios adultos ou suas próprias fotos.`;
  }

  if (result.isChild) {
    const age = result.estimatedAge ? ` (~${result.estimatedAge} anos)` : '';
    return `🚫 Proteção Infantil Ativada\n\n` +
           `Detectamos uma pessoa que aparenta ter menos de 16 anos${age}.\n\n` +
           `⚠️ Por políticas de proteção infantil, não é permitido animar crianças.\n\n` +
           `✅ Use: Avatares fictícios adultos ou fotos suas (16+).\n\n` +
           `ℹ️ Se você acredita que isso é um erro e a pessoa tem 16+ anos, tente novamente ou use outra foto.`;
  }

  if (result.isCelebrity) {
    return `🚫 Celebridade detectada\n\n` +
           `Detectamos uma pessoa famosa na imagem` +
           (result.name ? `: ${result.name}` : '') + `.\n\n` +
           `⚠️ Não é possível animar pessoas famosas devido a políticas anti-deepfake.\n\n` +
           `✅ Use: Avatares fictícios, ilustrações ou suas próprias fotos.\n\n` +
           (result.reason ? `ℹ️ ${result.reason}` : '');
  }

  return 'Conteúdo não permitido detectado.';
}

