import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Upload temporário de imagens de referência para Storage
 * Retorna URL pública ao invés de base64 (economia de ~99% no payload!)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📤 [UPLOAD-TEMP] Iniciando upload de imagem temporária...');

    // Autenticar usuário
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      console.error('❌ Usuário não autenticado');
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não fornecido' }, { status: 400 });
    }

    if (!path) {
      return NextResponse.json({ error: 'Path não fornecido' }, { status: 400 });
    }

    console.log('📝 Upload info:', {
      fileName: file.name,
      fileSize: `${Math.round(file.size / 1024)}KB`,
      fileType: file.type,
      path,
      user: user.email,
    });

    // Converter File para ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`📤 Fazendo upload para Storage: ${path}`);

    // Upload usando Admin Client (não precisa de RLS)
    const adminClient = createSupabaseAdminClient();
    
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('generated-images')
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: true, // Sobrescrever se já existir
      });

    if (uploadError) {
      console.error('❌ Erro ao fazer upload:', uploadError);
      return NextResponse.json(
        { error: `Erro ao fazer upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ Upload completo:', uploadData.path);

    // Obter URL pública
    const { data: publicUrlData } = adminClient.storage
      .from('generated-images')
      .getPublicUrl(path);

    const publicUrl = publicUrlData.publicUrl;

    console.log(`✅ URL pública gerada: ${publicUrl.substring(0, 80)}...`);
    console.log(`📊 Economia: ${Math.round(file.size / 1024)}KB → ${publicUrl.length} bytes`);

    return NextResponse.json({
      success: true,
      publicUrl,
      path: uploadData.path,
      size: file.size,
    });

  } catch (error) {
    console.error('❌ Erro no upload temporário:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

