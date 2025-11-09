import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveAudioFile, resolveFileExtension } from '@/lib/file-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_AUDIO_BUCKET = 'audio';

function shouldUseSupabaseStorage() {
  if (process.env.AUDIO_STORAGE_DRIVER === 'fs') return false;
  if (process.env.AUDIO_STORAGE_DRIVER === 'supabase') return true;
  return Boolean(process.env.VERCEL);
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

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    if (shouldUseSupabaseStorage()) {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET?.trim() || DEFAULT_AUDIO_BUCKET;
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
        return NextResponse.json({ error: 'Falha ao salvar áudio no armazenamento' }, { status: 500 });
      }

      const { data: publicUrlResult } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = publicUrlResult.publicUrl;

      return NextResponse.json(
        {
          audio: {
            id: fileId,
            url: publicUrl,
            name: file.name,
            extension,
            type: 'upload' as const,
            storageBucket: bucket,
            storagePath,
          },
        },
        { status: 201 }
      );
    }

    const { fileId, publicPath, extension } = await saveAudioFile(arrayBuffer, file.name);

    return NextResponse.json(
      {
        audio: {
          id: fileId,
          url: publicPath,
          name: file.name,
          extension,
          type: 'upload' as const,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado ao enviar áudio', error);
    return NextResponse.json({ error: 'Erro interno ao enviar áudio' }, { status: 500 });
  }
}
