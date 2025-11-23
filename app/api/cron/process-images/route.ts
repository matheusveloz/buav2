import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { uploadBase64ToStorage } from '@/lib/upload-base64-to-storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos (Vercel Pro)

// ==================== CRON: PROCESSAR IMAGENS PENDENTES ====================
// Roda a cada 5 minutos via Vercel Cron
// Busca tasks em 'processing' e processa em background
// ==========================================================================

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;

export async function GET(request: NextRequest) {
  try {
    // Verificar autorização (Vercel Cron envia header)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ [CRON] Não autorizado');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 [CRON] Iniciando processamento de imagens pendentes...');

    const supabase = createSupabaseAdminClient();

    // Buscar tasks em 'processing' criadas há mais de 30 segundos
    // (para dar tempo de salvar no banco antes de processar)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

    const { data: pendingTasks, error: fetchError } = await supabase
      .from('generated_images')
      .select('*')
      .eq('status', 'processing')
      .lt('created_at', thirtySecondsAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(10); // Processar até 10 tasks por vez

    if (fetchError) {
      console.error('❌ [CRON] Erro ao buscar tasks:', fetchError);
      return NextResponse.json({ error: 'Erro ao buscar tasks' }, { status: 500 });
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      console.log('✅ [CRON] Nenhuma task pendente');
      return NextResponse.json({ message: 'Nenhuma task pendente', processed: 0 });
    }

    console.log(`📋 [CRON] ${pendingTasks.length} task(s) pendente(s) encontrada(s)`);

    // Processar cada task
    const results = await Promise.allSettled(
      pendingTasks.map(task => processTask(task, supabase))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ [CRON] Processamento concluído: ${successful} sucessos, ${failed} falhas`);

    return NextResponse.json({
      message: 'Processamento concluído',
      processed: pendingTasks.length,
      successful,
      failed,
    });

  } catch (error) {
    console.error('❌ [CRON] Erro crítico:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

async function processTask(task: any, supabase: any) {
  const taskId = task.task_id;
  const userEmail = task.user_email;
  const prompt = task.prompt;
  const num = task.num_images || 1;

  console.log(`🔧 [CRON] Processando task: ${taskId} (user: ${userEmail})`);

  try {
    const startTime = Date.now();
    const generatedImages: { imageUrl: string; imageType: string }[] = [];

    // Buscar imagens de referência se houver
    let referenceImages: string[] = [];
    if (task.reference_images && Array.isArray(task.reference_images)) {
      referenceImages = task.reference_images;
    }

    // Gerar imagens
    for (let i = 0; i < num; i++) {
      console.log(`🎨 [CRON] Gerando imagem ${i + 1}/${num} para task ${taskId}...`);

      // Montar payload
      const requestBody: any = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: task.aspect_ratio || '1:1',
          },
        },
      };

      // Adicionar imagens de referência se houver
      if (referenceImages && referenceImages.length > 0) {
        for (const imageRef of referenceImages.slice(0, 4)) {
          let mimeType: string;
          let data: string;

          // Verificar se é base64 ou URL
          const base64Match = imageRef.match(/^data:([^;]+);base64,(.+)$/);

          if (base64Match) {
            mimeType = base64Match[1];
            data = base64Match[2];
          } else if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
            // Fetch URL e converter para base64
            try {
              const imageResponse = await fetch(imageRef);
              if (imageResponse.ok) {
                const blob = await imageResponse.blob();
                mimeType = blob.type || 'image/png';
                const buffer = await blob.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                data = btoa(binary);
              } else {
                continue;
              }
            } catch (error) {
              console.error(`❌ [CRON] Erro ao converter URL:`, error);
              continue;
            }
          } else {
            continue;
          }

          requestBody.contents[0].parts.push({
            inlineData: { mimeType, data },
          });
        }
      }

      // Chamar API Gemini (com timeout de 270s)
      const timeoutMs = 270000; // 4.5 minutos

      try {
        const nanoResponse = await fetch(
          'https://api.laozhang.ai/v1beta/models/gemini-3-pro-image-preview:generateContent',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LAOZHANG_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(timeoutMs),
          }
        );

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`⏱️ [CRON] Resposta recebida em ${elapsed}s para imagem ${i + 1}`);

        if (!nanoResponse.ok) {
          const errorText = await nanoResponse.text();
          console.error(`❌ [CRON] Erro HTTP ${nanoResponse.status}:`, errorText.substring(0, 300));
          throw new Error(`API error: ${nanoResponse.status}`);
        }

        const nanoResult = await nanoResponse.json();

        // Extrair imagem
        if (!nanoResult.candidates || nanoResult.candidates.length === 0) {
          throw new Error('Resposta sem candidates');
        }

        const candidate = nanoResult.candidates[0];
        let imagePart = null;

        // Pegar última imagem
        for (let j = candidate.content.parts.length - 1; j >= 0; j--) {
          const part = candidate.content.parts[j];
          if (part.inlineData) {
            imagePart = part;
            break;
          }
        }

        if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
          throw new Error('Imagem não encontrada na resposta');
        }

        const base64Data = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        // Upload para Storage
        const uploadedImage = await uploadBase64ToStorage(
          supabase,
          dataUrl,
          userEmail,
          taskId,
          i
        );

        if (uploadedImage) {
          generatedImages.push(uploadedImage);
          console.log(`✅ [CRON] Imagem ${i + 1}/${num} gerada e salva`);
        }

      } catch (error) {
        console.error(`❌ [CRON] Erro ao gerar imagem ${i + 1}:`, error);
        throw error; // Re-throw para marcar task como failed
      }
    }

    // Atualizar banco com imagens geradas
    const totalElapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ [CRON] Task ${taskId} completada em ${totalElapsed}s`);

    const { error: updateError } = await supabase
      .from('generated_images')
      .update({
        status: 'completed',
        image_urls: generatedImages,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('task_id', taskId);

    if (updateError) {
      console.error(`❌ [CRON] Erro ao atualizar banco:`, updateError);
      throw updateError;
    }

    console.log(`✅ [CRON] Task ${taskId} marcada como completed`);

  } catch (error) {
    console.error(`❌ [CRON] Erro ao processar task ${taskId}:`, error);

    // Marcar como failed e reembolsar créditos
    try {
      await supabase
        .from('generated_images')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('task_id', taskId);

      // Reembolsar créditos
      const creditsToRefund = task.credits_used || 0;
      if (creditsToRefund > 0) {
        const { data: profile } = await supabase
          .from('emails')
          .select('creditos')
          .eq('email', userEmail)
          .single();

        if (profile) {
          await supabase
            .from('emails')
            .update({
              creditos: (profile.creditos || 0) + creditsToRefund,
            })
            .eq('email', userEmail);

          console.log(`💰 [CRON] ${creditsToRefund} créditos reembolsados para ${userEmail}`);
        }
      }

      console.log(`✅ [CRON] Task ${taskId} marcada como failed`);

    } catch (refundError) {
      console.error(`❌ [CRON] Erro ao marcar failed/reembolsar:`, refundError);
    }

    throw error; // Re-throw para contabilizar no resultado
  }
}

