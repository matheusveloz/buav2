import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveAudioFile, resolveFileExtension } from '@/lib/file-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos timeout (para áudios grandes)

const DEFAULT_AUDIO_BUCKET = 'audio';

function shouldUseSupabaseStorage() {
  if (process.env.AUDIO_STORAGE_DRIVER === 'fs') return false;
  if (process.env.AUDIO_STORAGE_DRIVER === 'supabase') return true;
  return Boolean(process.env.VERCEL);
}

function getAudioBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET?.trim() || DEFAULT_AUDIO_BUCKET;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar o Content-Type para determinar o tipo de upload
    const contentType = request.headers.get('content-type') || '';
    const isDirectUpload = contentType.includes('application/json');

    console.log('[POST /api/audio/upload] Requisição recebida:', {
      contentType,
      isDirectUpload,
      userEmail: user.email,
    });

    // UPLOAD DIRETO (já foi feito no cliente, só registrar no banco)
    if (isDirectUpload) {
      const body = await request.json();
      const { strategy, fileId, storagePath, storageBucket, publicUrl, originalFilename, extension } = body;

      if (strategy !== 'direct' || !fileId || !publicUrl) {
        return NextResponse.json({ error: 'Dados inválidos para registro direto' }, { status: 400 });
      }

      console.log('📝 Registrando áudio de upload direto:', {
        fileId,
        storagePath,
        publicUrl,
        originalFilename,
      });

      const { data: inserted, error: insertError } = await supabase
        .from('user_audios')
        .insert({
          id: fileId,
          user_email: user.email,
          audio_url: publicUrl,
          storage_bucket: storageBucket ?? null,
          storage_path: storagePath ?? null,
          original_filename: originalFilename ?? null,
          extension: extension ?? null,
        })
        .select('*')
        .maybeSingle();

      if (insertError || !inserted) {
        console.error('Erro ao registrar áudio do usuário', insertError);
        return NextResponse.json(
          { error: 'Áudio salvo, mas falhou ao registrar no banco.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          audio: {
            id: inserted.id,
            url: inserted.audio_url,
            name: inserted.original_filename ?? originalFilename,
            extension: inserted.extension ?? extension,
            type: 'upload' as const,
            storageBucket: inserted.storage_bucket ?? storageBucket,
            storagePath: inserted.storage_path ?? storagePath,
          },
        },
        { status: 201 }
      );
    }

    // UPLOAD TRADICIONAL VIA FORMDATA (para arquivos menores)
    const formData = await request.formData();
    
    console.log('[POST /api/audio/upload] FormData recebido. Chaves:', Array.from(formData.keys()));
    
    const file = formData.get('file');

    if (!(file instanceof File)) {
      const allEntries = Array.from(formData.entries()).map(([key, value]) => ({
        key,
        valueType: value instanceof File ? 'File' : typeof value,
        fileName: value instanceof File ? value.name : undefined,
      }));
      
      console.error('[POST /api/audio/upload] Arquivo não encontrado:', {
        chavesRecebidas: Array.from(formData.keys()),
        todasEntradas: allEntries,
        valorDoCampoFile: file,
      });
      
      return NextResponse.json({ 
        error: 'Arquivo de áudio não enviado',
        details: `Campo "file" não encontrado. Chaves recebidas: ${Array.from(formData.keys()).join(', ')}`
      }, { status: 400 });
    }

    const fileSizeMB = file.size / (1024 * 1024);

    console.log('[POST /api/audio/upload] Arquivo recebido:', {
      nome: file.name,
      tamanho: `${fileSizeMB.toFixed(2)}MB`,
      tipo: file.type,
      size: file.size,
    });

    // Validar tamanho do arquivo (máximo 50MB para upload tradicional)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'Arquivo muito grande',
          details: `O arquivo tem ${fileSizeMB.toFixed(2)}MB. Use arquivos menores ou o upload será feito diretamente.`,
        },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    const insertAudioRecord = async (
      payload: Partial<{
        id: string;
        audio_url: string;
        storage_bucket: string | null;
        storage_path: string | null;
        original_filename: string | null;
        extension: string | null;
      }>
    ) => {
      const { data: inserted, error: insertError } = await supabase
        .from('user_audios')
        .insert({
          id: payload.id,
          user_email: user.email,
          audio_url: payload.audio_url,
          storage_bucket: payload.storage_bucket ?? null,
          storage_path: payload.storage_path ?? null,
          original_filename: payload.original_filename ?? null,
          extension: payload.extension ?? null,
        })
        .select('*')
        .maybeSingle();

      if (insertError || !inserted) {
        console.error('Erro ao registrar áudio do usuário', insertError);
        return NextResponse.json(
          { error: 'Áudio salvo, mas falhou ao registrar no banco.' },
          { status: 500 }
        );
      }

      return inserted;
    };

    if (shouldUseSupabaseStorage()) {
      const bucket = getAudioBucket();
      const extension = resolveFileExtension(file.name, 'mp3');
      const fileId = randomUUID();
      const storagePath = `${user.id}/${fileId}.${extension}`;
      const contentType = file.type || `audio/${extension}`;
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        cacheControl: '3600',
        contentType,
        upsert: false,
      });

      if (uploadError) {
        console.error('Erro ao enviar áudio para Supabase Storage', {
          message: uploadError.message,
          name: uploadError.name,
          cause: uploadError.cause,
          bucket,
          storagePath,
          fileSize: buffer.length,
          contentType,
        });
        return NextResponse.json(
          {
            error: 'Falha ao salvar áudio no armazenamento',
            details: uploadError.message ?? 'Erro desconhecido no Storage',
            errorName: uploadError.name ?? null,
          },
          { status: 500 }
        );
      }

      const { data: publicUrlResult } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = publicUrlResult.publicUrl;

      const inserted = await insertAudioRecord({
        id: fileId,
        audio_url: publicUrl,
        storage_bucket: bucket,
        storage_path: storagePath,
        original_filename: file.name,
        extension,
      });

      if (!inserted) {
        return NextResponse.json({ error: 'Erro interno ao registrar áudio' }, { status: 500 });
      }

      return NextResponse.json(
        {
          audio: {
            id: inserted.id,
            url: inserted.audio_url,
            name: inserted.original_filename ?? file.name,
            extension: inserted.extension ?? extension,
            type: 'upload' as const,
            storageBucket: inserted.storage_bucket ?? bucket,
            storagePath: inserted.storage_path ?? storagePath,
          },
        },
        { status: 201 }
      );
    }

    const { fileId, publicPath, extension } = await saveAudioFile(arrayBuffer, file.name);

    const inserted = await insertAudioRecord({
      id: fileId,
      audio_url: publicPath,
      storage_bucket: null,
      storage_path: null,
      original_filename: file.name,
      extension,
    });

    if (!inserted) {
      return NextResponse.json({ error: 'Erro interno ao registrar áudio' }, { status: 500 });
    }

    return NextResponse.json(
      {
        audio: {
          id: inserted.id,
          url: inserted.audio_url,
          name: inserted.original_filename ?? file.name,
          extension: inserted.extension ?? extension,
          type: 'upload' as const,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado ao enviar áudio', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao enviar áudio',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
