import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rota de teste simplificada para diagnosticar problemas de upload no Supabase Storage
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET?.trim() || 'audio';
    const testContent = 'test-audio-upload-' + Date.now();
    const testPath = `${user.id}/test-${randomUUID()}.txt`;

    console.log('Tentando upload de teste:', { bucket, testPath, userId: user.id });

    // Tenta fazer upload de um arquivo de teste
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(testPath, Buffer.from(testContent), {
        contentType: 'text/plain',
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro no upload de teste:', {
        message: uploadError.message,
        name: uploadError.name,
        cause: uploadError.cause,
      });

      return NextResponse.json({
        success: false,
        error: uploadError.message,
        errorName: uploadError.name,
        bucket,
        testPath,
        userId: user.id,
        userEmail: user.email,
      });
    }

    // Tenta remover o arquivo de teste
    const { error: removeError } = await supabase.storage.from(bucket).remove([testPath]);

    return NextResponse.json({
      success: true,
      message: 'Upload de teste bem-sucedido',
      bucket,
      testPath,
      uploadData,
      removeError: removeError ? removeError.message : null,
      userId: user.id,
      userEmail: user.email,
    });
  } catch (error) {
    console.error('Erro inesperado no teste de upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}

