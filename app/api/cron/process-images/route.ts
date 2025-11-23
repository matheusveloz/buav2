import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { uploadBase64ToStorage } from '@/lib/upload-base64-to-storage';
import {
  buildText2ImageRequest,
  buildImageEditRequest,
  extractBase64Image,
  isValidNanoBananaResponse,
} from '@/lib/nano-banana-helper';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos (Vercel Pro)

// ==================== CRON: PROCESSAR IMAGENS PENDENTES ====================
// Roda a cada 1 minuto via Vercel Cron
// Processa tasks v2-quality e v3-high-quality em 'processing'
// ==========================================================================

const LAOZHANG_API_KEY = process.env.LAOZHANG_API_KEY;
const LAOZHANG_BASE_URL = 'https://api.laozhang.ai/v1/chat/completions';

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

    // Buscar tasks em 'processing' criadas há mais de 10 segundos
    // (para dar tempo de salvar no banco antes de processar)
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000);

    const { data: pendingTasks, error: fetchError } = await supabase
      .from('generated_images')
      .select('*')
      .eq('status', 'processing')
      .in('model', [
        'gemini-2.5-flash-image-preview',
        'gemini-2.5-flash-image-edit',
        'gemini-3-pro-image-preview',
        'gemini-3-pro-image-edit',
      ])
      .lt('created_at', tenSecondsAgo.toISOString())
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
  const model = task.model;

  // Identificar se é v2 ou v3
  const isV3 = model.includes('gemini-3-pro');
  const isV2 = model.includes('gemini-2.5-flash');

  console.log(`🔧 [CRON] Processando task: ${taskId} (user: ${userEmail}, model: ${model}, version: ${isV3 ? 'v3' : 'v2'})`);

  try {
    const startTime = Date.now();
    const generatedImages: { imageUrl: string; imageType: string }[] = [];

    // Buscar imagens de referência se houver
    let referenceImages: string[] = [];
    if (task.reference_images && Array.isArray(task.reference_images)) {
      referenceImages = task.reference_images;
    }

    if (isV3) {
      // ========== PROCESSAR V3 (Gemini 3 Pro / Nano Banana 2) ==========
      console.log(`🚀 [CRON V3] Processando v3-high-quality: ${taskId}`);

      for (let i = 0; i < num; i++) {
        console.log(`🎨 [CRON V3] Gerando imagem ${i + 1}/${num}...`);

        // Montar payload para Nano Banana 2
        const requestBody: any = {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE'], // ✅ OBRIGATÓRIO segundo doc oficial!
            imageConfig: {
              aspectRatio: task.aspect_ratio || '1:1',
              imageSize: task.resolution || '1K', // Adicionar resolução (1K, 2K, 4K)
            },
          },
        };
        
        console.log(`📦 [CRON V3] Request body:`, JSON.stringify(requestBody).substring(0, 300));

        // Adicionar imagens de referência se houver (máximo 4)
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
                console.error(`❌ [CRON V3] Erro ao converter URL:`, error);
                continue;
              }
            } else {
              continue;
            }

            requestBody.contents[0].parts.push({
              inline_data: { mimeType, data }, // ✅ CORRIGIDO: inline_data (com underscore)
            });
          }
        }

        // Chamar API Gemini 3 Pro (Nano Banana 2) com timeout de 270s
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
          console.log(`⏱️ [CRON V3] Resposta recebida em ${elapsed}s para imagem ${i + 1}`);

          if (!nanoResponse.ok) {
            const errorText = await nanoResponse.text();
            console.error(`❌ [CRON V3] Erro HTTP ${nanoResponse.status}:`, errorText.substring(0, 300));
            throw new Error(`API error: ${nanoResponse.status}`);
          }

          const nanoResult = await nanoResponse.json();
          
          console.log(`📦 [CRON V3] Resposta parseada, keys:`, Object.keys(nanoResult));
          console.log(`📦 [CRON V3] Has candidates:`, !!nanoResult.candidates);
          console.log(`📦 [CRON V3] Candidates length:`, nanoResult.candidates?.length);

          // Extrair imagem
          if (!nanoResult.candidates || nanoResult.candidates.length === 0) {
            console.error(`❌ [CRON V3] Resposta sem candidates. Full response:`, JSON.stringify(nanoResult).substring(0, 500));
            throw new Error('Resposta sem candidates');
          }

          const candidate = nanoResult.candidates[0];
          console.log(`📦 [CRON V3] Candidate keys:`, Object.keys(candidate));
          console.log(`📦 [CRON V3] Content keys:`, Object.keys(candidate.content || {}));
          console.log(`📦 [CRON V3] Parts length:`, candidate.content?.parts?.length);
          
          let imagePart = null;

          // Pegar última imagem
          for (let j = candidate.content.parts.length - 1; j >= 0; j--) {
            const part = candidate.content.parts[j];
            console.log(`📦 [CRON V3] Part ${j} keys:`, Object.keys(part));
            // A API pode retornar inline_data (underscore) ou inlineData (camelCase)
            if (part.inline_data || part.inlineData) {
              imagePart = part;
              console.log(`✅ [CRON V3] Inline data encontrado no part ${j}`);
              break;
            }
          }

          // Extrair dados da imagem (suporta ambos os formatos)
          const imageData = imagePart?.inline_data || imagePart?.inlineData;
          
          if (!imagePart || !imageData || !imageData.data) {
            console.error(`❌ [CRON V3] Imagem não encontrada. Parts:`, JSON.stringify(candidate.content.parts).substring(0, 500));
            throw new Error('Imagem não encontrada na resposta');
          }
          
          console.log(`✅ [CRON V3] Base64 data length:`, imageData.data.length);
          console.log(`✅ [CRON V3] MimeType:`, imageData.mimeType || imageData.mime_type);

          const base64Data = imageData.data;
          const mimeType = imageData.mimeType || imageData.mime_type || 'image/png';
          const dataUrl = `data:${mimeType};base64,${base64Data}`;

          console.log(`📤 [CRON V3] Fazendo upload para Storage... (user: ${userEmail}, taskId: ${taskId}, index: ${i})`);
          
          // Upload para Storage
          const uploadedImage = await uploadBase64ToStorage(
            supabase,
            dataUrl,
            userEmail,
            taskId,
            i
          );

          console.log(`📥 [CRON V3] Upload result:`, uploadedImage ? 'SUCCESS' : 'FAILED');
          
          if (uploadedImage) {
            generatedImages.push(uploadedImage);
            console.log(`✅ [CRON V3] Imagem ${i + 1}/${num} gerada e salva. URL: ${uploadedImage.imageUrl?.substring(0, 80)}`);
          } else {
            console.error(`❌ [CRON V3] Upload retornou null/undefined`);
          }

        } catch (error) {
          console.error(`❌ [CRON V3] Erro ao gerar imagem ${i + 1}:`, error);
          throw error;
        }
      }

    } else if (isV2) {
      // ========== PROCESSAR V2 (Gemini 2.5 Flash / Nano Banana) ==========
      console.log(`🍌 [CRON V2] Processando v2-quality: ${taskId}`);

      // Verificar se é image edit ou text2image
      const hasReferenceImages = referenceImages && referenceImages.length > 0;
      const isImageEdit = hasReferenceImages;

      let nanoRequestBody: ReturnType<typeof buildText2ImageRequest> | ReturnType<typeof buildImageEditRequest>;
      
      if (isImageEdit) {
        console.log(`🎨 [CRON V2] Image Edit com ${referenceImages.length} imagens de referência`);
        nanoRequestBody = buildImageEditRequest(prompt, referenceImages);
      } else {
        console.log(`🎨 [CRON V2] Text-to-Image`);
        nanoRequestBody = buildText2ImageRequest(prompt);
      }

      // Gerar múltiplas imagens em paralelo
      const generationPromises = Array.from({ length: num }, async (_, i) => {
        const imageStartTime = Date.now();
        console.log(`🔄 [CRON V2] ===== INICIANDO IMAGEM ${i + 1}/${num} =====`);
        
        try {
          console.log(`📤 [CRON V2] Enviando fetch para imagem ${i + 1}...`);
          
          const timeoutMs = 240000; // 240 segundos = 4 minutos
          
          const nanoResponse = await fetch(LAOZHANG_BASE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${LAOZHANG_API_KEY}`,
            },
            body: JSON.stringify(nanoRequestBody),
            signal: AbortSignal.timeout(timeoutMs),
          });
          
          const fetchElapsed = Math.round((Date.now() - imageStartTime) / 1000);
          console.log(`📥 [CRON V2] Resposta recebida em ${fetchElapsed}s (imagem ${i + 1}), status: ${nanoResponse.status}`);

          if (!nanoResponse.ok) {
            const errorText = await nanoResponse.text();
            console.error(`❌ [CRON V2] Erro HTTP ${nanoResponse.status} (imagem ${i + 1}):`, errorText.substring(0, 300));
            return null;
          }

          const nanoResult = await nanoResponse.json();
          console.log(`📋 [CRON V2] JSON parseado (imagem ${i + 1})`);

          // Validar resposta
          if (!isValidNanoBananaResponse(nanoResult)) {
            console.error(`❌ [CRON V2] Resposta inválida (imagem ${i + 1})`);
            return null;
          }

          // Extrair base64 da resposta
          const content = nanoResult.choices[0].message.content;
          console.log(`🔍 [CRON V2] Extraindo base64 da resposta (imagem ${i + 1})...`);
          const extractedImage = extractBase64Image(content);

          if (!extractedImage) {
            console.error(`❌ [CRON V2] Erro ao extrair imagem base64 (imagem ${i + 1})`);
            return null;
          }
          
          console.log(`✅ [CRON V2] Base64 extraído (imagem ${i + 1}), formato: ${extractedImage.format}`);

          // Upload para Storage
          try {
            console.log(`📤 [CRON V2] Fazendo upload para Storage (imagem ${i + 1})...`);
            const uploadedImage = await uploadBase64ToStorage(
              supabase,
              extractedImage.dataUrl,
              userEmail,
              taskId,
              i
            );
            
            console.log(`✅ [CRON V2] Imagem ${i + 1}/${num} salva no Storage`);
            return uploadedImage;
          } catch (uploadError) {
            console.error(`❌ [CRON V2] Erro ao fazer upload (imagem ${i + 1}):`, uploadError);
            // Fallback para base64
            return {
              imageUrl: extractedImage.dataUrl,
              imageType: extractedImage.format,
            };
          }
        } catch (error) {
          console.error(`❌ [CRON V2] Erro ao gerar imagem ${i + 1}:`, error);
          return null;
        }
      });

      // Aguardar todas as gerações
      console.log(`⏳ [CRON V2] Aguardando Promise.all de ${num} imagens...`);
      const results = await Promise.all(generationPromises);
      console.log(`📊 [CRON V2] Promise.all concluído, processando resultados...`);
      
      const successfulImages = results.filter((img): img is { imageUrl: string; imageType: string } => img !== null);
      console.log(`📊 [CRON V2] Resultados: ${successfulImages.length} sucessos, ${results.length - successfulImages.length} falhas`);

      if (successfulImages.length === 0) {
        console.error(`❌ [CRON V2] NENHUMA imagem gerada com sucesso`);
        throw new Error('Nenhuma imagem gerada');
      }

      generatedImages.push(...successfulImages);
      console.log(`✅ [CRON V2] ${successfulImages.length}/${num} imagens geradas com sucesso`);
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

    console.log(`✅ [CRON] Task ${taskId} marcada como completed com ${generatedImages.length} imagens`);

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
