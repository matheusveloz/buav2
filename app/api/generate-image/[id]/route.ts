import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🗑️ [DELETE /api/generate-image/:id] Deletando imagem...');

    // Await params (Next.js 15+)
    const { id: imageIdentifier } = await params;

    if (!imageIdentifier) {
      return NextResponse.json({ error: 'ID da imagem é obrigatório' }, { status: 400 });
    }

    // Obter usuário autenticado
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      console.error('❌ Usuário não autenticado:', userError?.message);
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const userEmail = user.email;

    // Parsear o imageIdentifier para extrair generationId e imageIndex
    // Formato: {generationId}-{imageIndex} ou apenas {generationId}
    let generationId: string;
    let imageIndex: number | null = null;

    // Tentar extrair index do final (formato: uuid-0, uuid-1, etc)
    const parts = imageIdentifier.split('-');
    const lastPart = parts[parts.length - 1];
    
    // Verificar se o último segmento é um número (imageIndex)
    if (!isNaN(Number(lastPart)) && parts.length > 5) { // UUID tem 5 partes + index
      imageIndex = Number(lastPart);
      // Remover o index para obter o generationId
      generationId = parts.slice(0, -1).join('-');
    } else {
      // Não tem index, é a geração inteira
      generationId = imageIdentifier;
    }

    console.log('📋 Deletando imagem:', { 
      imageIdentifier, 
      generationId, 
      imageIndex,
      userEmail 
    });

    // Buscar a geração no banco
    const { data: existingImage, error: fetchError } = await supabase
      .from('generated_images')
      .select('id, user_email, image_urls, num_images')
      .eq('id', generationId)
      .single();

    if (fetchError || !existingImage) {
      console.error('❌ Imagem não encontrada:', fetchError?.message);
      return NextResponse.json({ error: 'Imagem não encontrada' }, { status: 404 });
    }

    if (existingImage.user_email !== userEmail) {
      console.error('❌ Usuário não autorizado a deletar esta imagem');
      return NextResponse.json(
        { error: 'Você não tem permissão para deletar esta imagem' },
        { status: 403 }
      );
    }

    // Se imageIndex for especificado, deletar apenas aquela imagem
    if (imageIndex !== null && existingImage.image_urls && Array.isArray(existingImage.image_urls)) {
      console.log(`🎯 Deletando imagem individual (index ${imageIndex}) da geração ${generationId}`);
      
      // Verificar se o index é válido
      if (imageIndex < 0 || imageIndex >= existingImage.image_urls.length) {
        return NextResponse.json({ error: 'Index de imagem inválido' }, { status: 400 });
      }

      // Deletar arquivo específico do Storage
      const imgData = existingImage.image_urls[imageIndex];
      const imageUrl = typeof imgData === 'string' ? imgData : imgData?.imageUrl;
      
      if (imageUrl && imageUrl.includes('supabase')) {
        const urlParts = imageUrl.split('/storage/v1/object/public/generated-images/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          console.log('🗑️ Deletando arquivo do Storage:', filePath);
          
          const { error: storageError } = await supabase.storage
            .from('generated-images')
            .remove([filePath]);
          
          if (storageError) {
            console.warn('⚠️ Erro ao deletar arquivo do Storage:', storageError.message);
          } else {
            console.log('✅ Arquivo deletado do Storage:', filePath);
          }
        }
      }

      // Remover a imagem do array image_urls
      const updatedImageUrls = existingImage.image_urls.filter((_: unknown, idx: number) => idx !== imageIndex);
      
      // Se ainda houver imagens, atualizar o array
      // Se não houver mais imagens, marcar toda a geração como deletada
      if (updatedImageUrls.length > 0) {
        const { error: updateError } = await supabase
          .from('generated_images')
          .update({ 
            image_urls: updatedImageUrls,
            // ⚠️ NÃO atualizar num_images - ele deve manter o valor ORIGINAL
            // para contagem correta do limite diário
          })
          .eq('id', generationId);

        if (updateError) {
          console.error('❌ Erro ao atualizar image_urls:', updateError.message);
          return NextResponse.json({ error: 'Erro ao deletar imagem' }, { status: 500 });
        }

        console.log(`✅ Imagem individual deletada. Restam ${updatedImageUrls.length} imagem(ns) (num_images original mantido: ${existingImage.num_images})`);
      } else {
        // Não há mais imagens, marcar geração inteira como deletada
        const { error: deleteError } = await supabase
          .from('generated_images')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', generationId);

        if (deleteError) {
          console.error('❌ Erro ao marcar geração como deletada:', deleteError.message);
          return NextResponse.json({ error: 'Erro ao deletar imagem' }, { status: 500 });
        }

        console.log('✅ Última imagem deletada. Geração marcada como deletada (soft delete)');
      }

      return NextResponse.json({
        success: true,
        message: 'Imagem deletada com sucesso',
        remainingImages: updatedImageUrls.length,
      });
    }

    // Se não tem imageIndex, deletar geração inteira (comportamento original)
    console.log('🗑️ Deletando geração inteira:', generationId);
    
    // Deletar todos os arquivos do Storage
    if (existingImage.image_urls && Array.isArray(existingImage.image_urls)) {
      for (const imgData of existingImage.image_urls) {
        try {
          const imageUrl = typeof imgData === 'string' ? imgData : imgData.imageUrl;
          
          if (imageUrl && imageUrl.includes('supabase')) {
            const urlParts = imageUrl.split('/storage/v1/object/public/generated-images/');
            if (urlParts.length > 1) {
              const filePath = urlParts[1];
              console.log('🗑️ Deletando arquivo do Storage:', filePath);
              
              const { error: storageError } = await supabase.storage
                .from('generated-images')
                .remove([filePath]);
              
              if (storageError) {
                console.error('⚠️ Erro ao deletar arquivo do Storage:', storageError.message);
              } else {
                console.log('✅ Arquivo deletado do Storage:', filePath);
              }
            }
          }
        } catch (storageErr) {
          console.error('⚠️ Erro ao processar deleção do Storage:', storageErr);
        }
      }
    }

    // SOFT DELETE: Marcar como deletada ao invés de remover do banco
    const { error: deleteError } = await supabase
      .from('generated_images')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', generationId);

    if (deleteError) {
      console.error('❌ Erro ao marcar imagem como deletada:', deleteError.message);
      return NextResponse.json({ error: 'Erro ao deletar imagem' }, { status: 500 });
    }

    console.log('✅ Geração inteira marcada como deletada (soft delete):', generationId);

    return NextResponse.json({
      success: true,
      message: 'Imagem deletada com sucesso',
    });
  } catch (error) {
    console.error('❌ [DELETE /api/generate-image/:id] Erro:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

