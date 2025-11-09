import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveAvatarFile, resolveFileExtension } from '@/lib/file-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_AVATAR_BUCKET = 'avatars';

function shouldUseSupabaseStorage() {
  if (process.env.AVATAR_STORAGE_DRIVER === 'fs') return false;
  if (process.env.AVATAR_STORAGE_DRIVER === 'supabase') return true;
  return Boolean(process.env.VERCEL);
}

function getAvatarBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET?.trim() || DEFAULT_AVATAR_BUCKET;
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

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de avatar não enviado' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    if (shouldUseSupabaseStorage()) {
      const bucket = getAvatarBucket();
      const extension = resolveFileExtension(file.name, 'mp4');
      const fileId = randomUUID();
      const storagePath = `${user.id}/${fileId}.${extension}`;
      const contentType = file.type || `video/${extension}`;
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          cacheControl: '3600',
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Erro ao enviar avatar para Supabase Storage', {
          message: uploadError.message,
          name: uploadError.name,
          bucket,
          storagePath,
          fileSize: buffer.length,
          contentType,
        });
        return NextResponse.json(
          {
            error: 'Falha ao salvar avatar no armazenamento',
            details: uploadError.message ?? 'Erro desconhecido no Storage',
          },
          { status: 500 }
        );
      }

      const { data: publicUrlResult } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = publicUrlResult.publicUrl;

      const { data: inserted, error } = await supabase
        .from('user_avatars')
        .insert({
          user_email: user.email,
          video_path: publicUrl,
          preview_path: null,
          thumbnail_path: null,
          original_filename: file.name,
        })
        .select('*')
        .maybeSingle();

      if (error || !inserted) {
        console.error('Erro ao registrar avatar do usuário', error);
        return NextResponse.json(
          { error: 'Avatar salvo, mas falhou ao registrar no banco.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          avatar: {
            id: inserted.id,
            label: inserted.original_filename ?? 'Avatar personalizado',
            videoUrl: inserted.video_path ?? publicUrl,
            type: 'uploaded' as const,
            createdAt: inserted.created_at,
          },
        },
        { status: 201 }
      );
    }

    // Fallback para filesystem (desenvolvimento local)
    const { fileId, publicPath } = await saveAvatarFile(arrayBuffer, file.name);

    const { data: inserted, error } = await supabase
      .from('user_avatars')
      .insert({
        user_email: user.email,
        video_path: publicPath,
        preview_path: null,
        thumbnail_path: null,
        original_filename: file.name,
      })
      .select('*')
      .maybeSingle();

    if (error || !inserted) {
      console.error('Erro ao registrar avatar do usuário', error);
      return NextResponse.json(
        { error: 'Avatar salvo, mas falhou ao registrar no banco.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        avatar: {
          id: inserted.id,
          label: inserted.original_filename ?? 'Avatar personalizado',
          videoUrl: inserted.video_path ?? publicPath,
          type: 'uploaded' as const,
          createdAt: inserted.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro inesperado ao enviar avatar', error);
    return NextResponse.json({ error: 'Erro interno ao enviar avatar' }, { status: 500 });
  }
}
