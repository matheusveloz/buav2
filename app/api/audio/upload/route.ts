import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveAudioFile, resolveFileExtension } from '@/lib/file-storage';
import { DEFAULT_AUDIO_BUCKET, getAudioBucket, shouldUseSupabaseStorage } from '@/lib/audio-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 });
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
        console.error('Erro ao enviar áudio para Supabase Storage', uploadError);
        return NextResponse.json(
          {
            error: 'Falha ao salvar áudio no armazenamento',
            details: uploadError.message ?? null,
            status: uploadError.status ?? null,
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
