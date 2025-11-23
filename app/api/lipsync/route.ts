import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { blockIfAccountBlocked } from '@/lib/account-status';

const LIPSYNC_API_URL = 'https://api.newportai.com/api/async/lipsync';

type LipsyncRequestBody = {
  srcVideoUrl?: string;
  audioUrl?: string;
  vocalAudioUrl?: string | null;
  estimatedDuration?: number;
  videoParams?: Partial<{
    video_width: number;
    video_height: number;
    video_enhance: number;
  }>;
};

function toAbsoluteUrl(url: string, request: Request) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const origin = new URL(request.url).origin;
  if (url.startsWith('/')) {
    return `${origin}${url}`;
  }

  return `${origin}/${url}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se conta está bloqueada
    const blockedResponse = await blockIfAccountBlocked(user.email);
    if (blockedResponse) {
      return blockedResponse;
    }

    // Verificar créditos do usuário ANTES de processar
    const { data: profile } = await supabase
      .from('emails')
      .select('creditos, creditos_extras')
      .eq('email', user.email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Perfil de usuário não encontrado' }, { status: 404 });
    }

    const totalCredits = (profile.creditos || 0) + (profile.creditos_extras || 0);
    
    // Verificação básica: pelo menos 1 crédito
    if (totalCredits < 1) {
      console.log('❌ Usuário sem créditos:', {
        email: user.email,
        creditos: profile.creditos,
        creditos_extras: profile.creditos_extras,
        total: totalCredits
      });
      return NextResponse.json({ 
        error: 'Créditos insuficientes',
        details: 'Você não possui créditos suficientes para gerar vídeos.'
      }, { status: 403 });
    }

    const apiKey = process.env.NEXT_PUBLIC_NEWPORT_API_KEY;

    if (!apiKey) {
      console.error('NEXT_PUBLIC_NEWPORT_API_KEY não configurada');
      return NextResponse.json({ error: 'Configuração de API ausente' }, { status: 500 });
    }

    const body = (await request.json()) as LipsyncRequestBody;
    const { srcVideoUrl, audioUrl, vocalAudioUrl, videoParams, estimatedDuration } = body;

    if (!srcVideoUrl || !audioUrl) {
      return NextResponse.json(
        { error: 'srcVideoUrl e audioUrl são obrigatórios' },
        { status: 400 }
      );
    }

    // Calcular créditos necessários baseado na duração estimada do áudio
    // Fórmula: duração em segundos (arredondado para cima) + 1 crédito
    const duration = estimatedDuration || 0;
    const creditsNeeded = Math.ceil(duration) + 1;

    // Verificar se tem créditos suficientes para esta requisição específica
    if (totalCredits < creditsNeeded) {
      console.log('❌ Créditos insuficientes para este vídeo:', {
        email: user.email,
        creditosDisponiveis: totalCredits,
        creditosNecessarios: creditsNeeded,
        duracao: duration
      });
      return NextResponse.json({ 
        error: 'Créditos insuficientes',
        details: `Você precisa de ${creditsNeeded} créditos para este vídeo de ${duration}s, mas possui apenas ${totalCredits}.`
      }, { status: 403 });
    }

    const payload = {
      srcVideoUrl: toAbsoluteUrl(srcVideoUrl, request),
      audioUrl: toAbsoluteUrl(audioUrl, request),
      ...(vocalAudioUrl ? { vocalAudioUrl: toAbsoluteUrl(vocalAudioUrl, request) } : {}),
      videoParams: {
        video_width: 0,
        video_height: 0,
        video_enhance: 1,
        ...videoParams,
      },
    };

    const response = await fetch(LIPSYNC_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      console.error('LipSync API respondeu com erro', errorPayload);
      return NextResponse.json(
        { error: 'Falha ao iniciar geração de avatar', details: errorPayload },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      code?: number;
      message?: string;
      data?: { taskId?: string };
    };

    if (data.code !== 0 || !data.data?.taskId) {
      return NextResponse.json(
        { error: data.message ?? 'Falha ao obter taskId', details: data },
        { status: 502 }
      );
    }

    const taskId = data.data.taskId;

    // DESCONTAR CRÉDITOS DE FORMA ATÔMICA (thread-safe)
    // Isso previne race conditions quando múltiplos vídeos são processados simultaneamente
    console.log('💰 Descontando créditos ANTES de processar o vídeo (ATÔMICO):', {
      email: user.email,
      creditos_atuais: profile.creditos,
      creditos_extras_atuais: profile.creditos_extras,
      total_atual: totalCredits,
      creditos_a_descontar: creditsNeeded,
    });

    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits_atomic', {
      p_email: user.email,
      p_credits_to_deduct: creditsNeeded,
    });

    if (deductError || !deductResult || deductResult.length === 0) {
      console.error('❌ Erro ao descontar créditos (RPC):', deductError);
      return NextResponse.json(
        { error: 'Erro ao processar pagamento. Tente novamente.' },
        { status: 500 }
      );
    }

    const result = deductResult[0];

    if (!result.success) {
      console.error('❌ Falha ao descontar créditos:', result.error_message);
      return NextResponse.json(
        { error: result.error_message || 'Erro ao descontar créditos' },
        { status: 403 }
      );
    }

    const newRegular = result.new_creditos;
    const newExtras = result.new_creditos_extras;

    console.log('✅ Créditos descontados com sucesso (ATÔMICO):', {
      creditos_novos: newRegular,
      creditos_extras_novos: newExtras,
      total_novo: result.total_remaining,
      descontado: creditsNeeded,
    });

    const insertResult = await supabase.from('videos').insert({
      user_email: user.email,
      task_id: taskId,
      status: 'pending',
      source_video_url: srcVideoUrl,
      audio_url: audioUrl,
      creditos_utilizados: creditsNeeded, // Registrar os créditos já cobrados
    });

    if (insertResult.error) {
      console.error('Erro ao registrar task: ', insertResult.error);
      
      // Se falhar ao registrar, DEVOLVER os créditos
      console.log('⚠️ Devolvendo créditos por falha no registro...');
      await supabase
        .from('emails')
        .update({
          creditos: profile.creditos,
          creditos_extras: profile.creditos_extras,
        })
        .eq('email', user.email);
        
      return NextResponse.json(
        { error: 'Task criada, mas não foi possível registrar no banco.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        taskId,
        message: 'Task criada e registrada com sucesso.',
        creditsDeducted: creditsNeeded,
        newBalance: {
          creditos: newRegular,
          creditos_extras: newExtras,
          total: newRegular + newExtras,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado ao criar task de LipSync', error);
    return NextResponse.json({ error: 'Erro interno ao criar task' }, { status: 500 });
  }
}

