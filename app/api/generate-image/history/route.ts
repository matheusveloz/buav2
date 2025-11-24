import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { replaceSupabaseDomain } from '@/lib/custom-domain';

export const dynamic = 'force-dynamic';
export const maxDuration = 10; // Timeout de 10 segundos para Vercel

export async function GET(request: NextRequest) {
  try {
    console.log('📚 [GET /api/generate-image/history] Buscando histórico...');

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

    // Parâmetros de query
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12', 10); // Reduzido de 20 para 12
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const status = searchParams.get('status'); // 'completed', 'processing', 'failed'

    console.log('📊 Parâmetros da query:', { userEmail, limit, offset, status });

    // Construir query - selecionar apenas campos necessários para performance
    // IMPORTANTE: user_email + created_at DESC usa o índice idx_generated_images_user_created
    let query = supabase
      .from('generated_images')
      .select('id, task_id, status, image_urls, prompt, num_images, created_at, completed_at, model', { count: 'exact' })
      .eq('user_email', userEmail)
      .is('deleted_at', null) // 🔥 NÃO mostrar imagens deletadas (soft delete)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrar por status se fornecido
    if (status && ['completed', 'processing', 'failed'].includes(status)) {
      query = query.eq('status', status);
    }

    // Adicionar timeout na query (5 segundos)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 5000)
    );

    const queryPromise = query;

    // Executar query com timeout
    const { data: images, error: fetchError, count } = await Promise.race([
      queryPromise,
      timeoutPromise.then(() => {
        throw new Error('Query timeout after 5 seconds');
      })
    ]) as any;

    if (fetchError) {
      console.error('❌ Erro ao buscar histórico:', fetchError.message);
      console.error('❌ Detalhes do erro:', fetchError);
      return NextResponse.json({ 
        error: 'Erro ao buscar histórico', 
        details: fetchError.message 
      }, { status: 500 });
    }

    console.log(`✅ ${images?.length || 0} imagens encontradas (total: ${count})`);

    // Substituir URLs do Supabase pelo domínio customizado
    const imagesWithCustomDomain = images?.map((image: Record<string, unknown>) => {
      if (image.image_urls && Array.isArray(image.image_urls)) {
        return {
          ...image,
          image_urls: image.image_urls.map((urlData: { imageUrl: string; imageType: string }) => ({
            imageUrl: replaceSupabaseDomain(urlData.imageUrl),
            imageType: urlData.imageType,
          })),
        };
      }
      return image;
    });

    return NextResponse.json({
      images: imagesWithCustomDomain || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('❌ [GET /api/generate-image/history] Erro:', error);
    
    // Verificar se é timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error('⏱️ TIMEOUT: Query demorou mais de 5 segundos');
      console.error('💡 SOLUÇÃO: Execute o script supabase/FIX_IMAGE_HISTORY_TIMEOUT.sql');
      
      return NextResponse.json(
        {
          error: 'Timeout ao buscar histórico',
          message: 'A consulta está demorando muito. Verifique os índices do banco de dados.',
          details: 'Execute o script supabase/FIX_IMAGE_HISTORY_TIMEOUT.sql no Supabase SQL Editor',
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

