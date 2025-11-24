/**
 * 🔍 CELEBRITY DETECTION usando GPT-4o Vision
 * Detecta celebridades, crianças, rostos reais, nudez e conteúdo obsceno em imagens usando OpenAI
 * Simples, preciso e econômico!
 */

interface CelebrityDetectionResult {
  isCelebrity: boolean;
  isChild: boolean;
  hasRealFace: boolean; // 🆕 Detecta rosto de pessoa real (não desenho/avatar)
  hasNudity: boolean; // 🆕 Detecta nudez ou conteúdo sexual
  hasObscene: boolean; // 🆕 Detecta conteúdo obsceno/violento
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
        hasRealFace: false,
        hasNudity: false,
        hasObscene: false,
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
  "hasRealFace": true/false,
  "hasNudity": true/false,
  "hasObscene": true/false,
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
3. hasRealFace = true if image shows a REAL HUMAN FACE (photo/realistic)
   - Mark FALSE for: drawings, cartoons, anime, 3D avatars, illustrations, paintings
   - Mark TRUE for: photographs of real people, realistic human faces
4. hasNudity = true if image contains nudity or sexual content
   - Naked body, exposed genitals, sexual acts
   - Mark FALSE for: clothed people, artistic portraits
5. hasObscene = true if image contains obscene/violent/graphic content
   - Gore, blood, weapons being used, extreme violence
   - Mark FALSE for: normal images, artistic content
6. Be strict on celebrities: even if 10% similar to a celebrity, flag it
7. Consider: Elon Musk, Trump, Biden, Taylor Swift, Kardashians, Ronaldo, Messi, etc.
8. If no person in image, set isCelebrity/isChild/hasRealFace to false
9. When in doubt about age, prefer FALSE (allow) to avoid false positives

IMPORTANT: 
- Young-looking adults (18-25) are NOT children. Be conservative.
- Drawings/cartoons/avatars = hasRealFace: FALSE
- Real photos of people = hasRealFace: TRUE

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
    if (result.hasRealFace) {
      console.log(`📸 GPT-4o: Rosto real detectado (pessoa real, não desenho)`);
    }
    if (result.hasNudity) {
      console.log(`🔞 GPT-4o: Nudez/conteúdo sexual detectado`);
    }
    if (result.hasObscene) {
      console.log(`⚠️ GPT-4o: Conteúdo obsceno/violento detectado`);
    }
    if (!result.isCelebrity && !result.isChild && !result.hasRealFace && !result.hasNudity && !result.hasObscene) {
      console.log(`✅ GPT-4o: Imagem aprovada - Nenhuma restrição detectada`);
    }

    return result;

  } catch (error) {
    console.error('❌ Erro no GPT-4o Vision:', error);
    // Em caso de erro, NÃO bloquear (fail-safe)
    return {
      isCelebrity: false,
      isChild: false,
      hasRealFace: false,
      hasNudity: false,
      hasObscene: false,
      confidence: 'low',
      reason: 'Erro na análise',
    };
  }
}

/**
 * 🎯 MODERAÇÃO ESPECÍFICA PARA BUUA 1.0 (LEGADO)
 * Bloqueia: rostos reais, nudez, conteúdo obsceno
 * Permite: desenhos, objetos, avatares, arte
 */
export function shouldBlockBuua10(result: CelebrityDetectionResult): boolean {
  // 🚫 SEMPRE bloquear nudez e obscenidades
  if (result.hasNudity || result.hasObscene) {
    console.log(`🚫 BUUA 1.0: Bloqueando conteúdo impróprio`);
    return true;
  }

  // 🚫 Bloquear rostos reais (apenas desenhos e objetos permitidos)
  if (result.hasRealFace) {
    console.log(`🚫 BUUA 1.0: Bloqueando rosto real - apenas desenhos e objetos permitidos`);
    return true;
  }

  return false;
}

/**
 * 🎯 MODERAÇÃO ESPECÍFICA PARA BUUA 2.0 (HIGH)
 * Bloqueia: crianças, famosos, nudez, conteúdo obsceno
 * Permite: pessoas, avatares IA (adultos)
 */
export function shouldBlockBuua20(result: CelebrityDetectionResult): boolean {
  // 🚫 SEMPRE bloquear nudez e obscenidades
  if (result.hasNudity || result.hasObscene) {
    console.log(`🚫 BUUA 2.0: Bloqueando conteúdo impróprio`);
    return true;
  }

  // 🛡️ Bloquear crianças (com validação de idade)
  if (result.isChild) {
    // Se tem idade estimada, verificar se é realmente menor
    if (result.estimatedAge && result.estimatedAge >= 16) {
      console.log(`⚠️ BUUA 2.0: Idade ${result.estimatedAge} - considerado adulto jovem, permitindo`);
      return false;
    }
    
    // Se confiança for baixa, não bloquear (evitar falsos positivos)
    if (result.confidence === 'low') {
      console.log(`⚠️ BUUA 2.0: Confiança baixa na detecção de criança, permitindo`);
      return false;
    }
    
    console.log(`🚫 BUUA 2.0: Bloqueando criança (idade: ${result.estimatedAge}, confiança: ${result.confidence})`);
    return true;
  }

  // 🚫 Bloquear celebridades com alta ou média confiança
  if (result.isCelebrity && (result.confidence === 'high' || result.confidence === 'medium')) {
    console.log(`🚫 BUUA 2.0: Bloqueando celebridade: ${result.name}`);
    return true;
  }

  return false;
}

/**
 * Verifica se deve bloquear baseado no resultado (FUNÇÃO LEGADA - mantida por compatibilidade)
 * ⚠️ Use shouldBlockBuua10() ou shouldBlockBuua20() para nova implementação
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
  // Prioridade: Nudez/Obsceno > Criança+Celebridade > Criança > Celebridade > Rosto Real
  
  if (result.hasNudity) {
    return `🚫 Conteúdo Impróprio Detectado\n\n` +
           `Detectamos nudez ou conteúdo sexual na imagem.\n\n` +
           `⚠️ Não é permitido animar conteúdo adulto, nudez ou sexual.\n\n` +
           `✅ Use: Imagens apropriadas para todos os públicos.`;
  }

  if (result.hasObscene) {
    return `🚫 Conteúdo Impróprio Detectado\n\n` +
           `Detectamos conteúdo obsceno, violento ou gráfico na imagem.\n\n` +
           `⚠️ Não é permitido animar conteúdo violento, gore ou obsceno.\n\n` +
           `✅ Use: Imagens apropriadas para todos os públicos.`;
  }

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

  if (result.hasRealFace) {
    return `🚫 Rosto Real Detectado (Buua 1.0)\n\n` +
           `O Buua 1.0 (Legado) só permite animar desenhos e objetos.\n\n` +
           `⚠️ Para animar fotos de pessoas reais, use o Buua 2.0 (High).\n\n` +
           `✅ Use no Buua 1.0: Desenhos, cartoons, ilustrações, objetos, arte.\n` +
           `✅ Use no Buua 2.0: Fotos de pessoas reais (sem crianças/famosos).`;
  }

  return 'Conteúdo não permitido detectado.';
}

/**
 * 🎯 Retorna mensagem específica para BUUA 1.0
 */
export function getBlockMessageBuua10(result: CelebrityDetectionResult): string {
  if (result.hasNudity) {
    return `🚫 Conteúdo Impróprio Detectado\n\n` +
           `Detectamos nudez ou conteúdo sexual na imagem.\n\n` +
           `⚠️ Não é permitido animar conteúdo adulto, nudez ou sexual.\n\n` +
           `✅ Use: Imagens apropriadas para todos os públicos.`;
  }

  if (result.hasObscene) {
    return `🚫 Conteúdo Impróprio Detectado\n\n` +
           `Detectamos conteúdo obsceno, violento ou gráfico na imagem.\n\n` +
           `⚠️ Não é permitido animar conteúdo violento, gore ou obsceno.\n\n` +
           `✅ Use: Imagens apropriadas para todos os públicos.`;
  }

  if (result.hasRealFace) {
    return `🚫 Rosto Real Detectado - Buua 1.0 (Legado)\n\n` +
           `O Buua 1.0 só permite animar DESENHOS e OBJETOS.\n\n` +
           `⚠️ Para animar fotos de pessoas reais, use o Buua 2.0 (High).\n\n` +
           `✅ Buua 1.0 permite:\n` +
           `   • Desenhos e cartoons\n` +
           `   • Ilustrações e arte digital\n` +
           `   • Avatares estilizados (não-realistas)\n` +
           `   • Objetos e cenários\n\n` +
           `✅ Buua 2.0 permite:\n` +
           `   • Fotos de pessoas reais (adultos)\n` +
           `   • Avatares IA realistas\n` +
           `   • Sem crianças ou famosos`;
  }

  return 'Conteúdo não permitido detectado no Buua 1.0.';
}

/**
 * 🎯 Retorna mensagem específica para BUUA 2.0
 */
export function getBlockMessageBuua20(result: CelebrityDetectionResult): string {
  if (result.hasNudity) {
    return `🚫 Conteúdo Impróprio Detectado\n\n` +
           `Detectamos nudez ou conteúdo sexual na imagem.\n\n` +
           `⚠️ Não é permitido animar conteúdo adulto, nudez ou sexual.\n\n` +
           `✅ Use: Imagens apropriadas para todos os públicos.`;
  }

  if (result.hasObscene) {
    return `🚫 Conteúdo Impróprio Detectado\n\n` +
           `Detectamos conteúdo obsceno, violento ou gráfico na imagem.\n\n` +
           `⚠️ Não é permitido animar conteúdo violento, gore ou obsceno.\n\n` +
           `✅ Use: Imagens apropriadas para todos os públicos.`;
  }

  if (result.isChild && result.isCelebrity) {
    return `🚫 Conteúdo não permitido - Buua 2.0 (High)\n\n` +
           `Detectamos uma pessoa famosa (${result.name || 'celebridade'}) que aparenta ser menor de idade` +
           (result.estimatedAge ? ` (~${result.estimatedAge} anos)` : '') + `.\n\n` +
           `⚠️ Por políticas de proteção infantil e anti-deepfake, não podemos processar essa imagem.\n\n` +
           `✅ Use: Avatares fictícios adultos ou suas próprias fotos.`;
  }

  if (result.isChild) {
    const age = result.estimatedAge ? ` (~${result.estimatedAge} anos)` : '';
    return `🚫 Proteção Infantil Ativada - Buua 2.0\n\n` +
           `Detectamos uma pessoa que aparenta ter menos de 16 anos${age}.\n\n` +
           `⚠️ Por políticas de proteção infantil, não é permitido animar crianças.\n\n` +
           `✅ Use: Adultos (16+), avatares IA adultos ou suas próprias fotos.\n\n` +
           `ℹ️ Se você acredita que isso é um erro e a pessoa tem 16+ anos, tente novamente ou use outra foto.`;
  }

  if (result.isCelebrity) {
    return `🚫 Celebridade detectada - Buua 2.0\n\n` +
           `Detectamos uma pessoa famosa na imagem` +
           (result.name ? `: ${result.name}` : '') + `.\n\n` +
           `⚠️ Não é possível animar pessoas famosas devido a políticas anti-deepfake.\n\n` +
           `✅ Use: Avatares IA, ilustrações ou suas próprias fotos.\n\n` +
           (result.reason ? `ℹ️ ${result.reason}` : '');
  }

  return 'Conteúdo não permitido detectado no Buua 2.0.';
}

/**
 * 🎯 MODERAÇÃO ESPECÍFICA PARA BUUA 3.0 (V2/V3 HIGH-QUALITY)
 * Regras mais flexíveis - apenas bloqueia nudez explícita
 * Permite: pessoas, crianças (com roupas), celebridades (com roupas), biquini/maiô
 * Bloqueia: apenas nudez explícita e conteúdo obsceno/violento
 */
export function shouldBlockBuua30(result: CelebrityDetectionResult): boolean {
  // 🚫 APENAS bloquear nudez explícita (genitais expostos, nudez completa)
  if (result.hasNudity) {
    console.log(`🚫 BUUA 3.0: Bloqueando nudez explícita`);
    return true;
  }

  // 🚫 Bloquear conteúdo obsceno/violento extremo
  if (result.hasObscene) {
    console.log(`🚫 BUUA 3.0: Bloqueando conteúdo obsceno/violento`);
    return true;
  }

  // ✅ Permitir tudo o resto: pessoas, crianças com roupas, celebridades com roupas, biquini/maiô
  console.log(`✅ BUUA 3.0: Conteúdo permitido (regras flexíveis)`);
  return false;
}

/**
 * 🎯 Retorna mensagem específica para BUUA 3.0
 */
export function getBlockMessageBuua30(result: CelebrityDetectionResult): string {
  if (result.hasNudity) {
    return `🚫 Nudez Explícita Detectada\n\n` +
           `Detectamos nudez explícita na imagem.\n\n` +
           `⚠️ Não é permitido usar imagens com nudez explícita.\n\n` +
           `✅ Permitido: Pessoas com roupas, biquini, maiô, roupas de banho.\n` +
           `🚫 Não permitido: Nudez completa, genitais expostos.`;
  }

  if (result.hasObscene) {
    return `🚫 Conteúdo Impróprio Detectado\n\n` +
           `Detectamos conteúdo obsceno, violento ou gráfico na imagem.\n\n` +
           `⚠️ Não é permitido animar conteúdo violento, gore ou obsceno.\n\n` +
           `✅ Use: Imagens apropriadas.`;
  }

  return 'Conteúdo não permitido detectado no Buua 3.0.';
}

