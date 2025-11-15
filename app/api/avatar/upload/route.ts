import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { saveAvatarFile, resolveFileExtension } from '@/lib/file-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 segundos timeout

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

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = (await request.json()) as {
        fileId?: string;
        publicUrl?: string;
        storagePath?: string;
        storageBucket?: string;
        originalFilename?: string | null;
        contentType?: string | null;
        strategy?: string | null;
      };

      if (!body?.fileId || !body?.publicUrl) {
        return NextResponse.json(
          { error: 'Dados insuficientes para registrar avatar.' },
          { status: 400 }
        );
      }

      const { data: inserted, error: insertError } = await supabase
        .from('user_avatars')
        .insert({
          id: body.fileId,
          user_email: user.email,
          video_path: body.publicUrl,
          preview_path: null,
          thumbnail_path: null,
          original_filename: body.originalFilename ?? null,
        })
        .select('*')
        .maybeSingle();

      if (insertError || !inserted) {
        console.error('❌ Erro ao registrar avatar após upload direto:', insertError);
        return NextResponse.json(
          { error: 'Falha ao registrar avatar no banco após upload direto.' },
          { status: 500 }
        );
      }

      console.log('✅ Avatar registrado após upload direto', {
        id: inserted.id,
        storagePath: body.storagePath,
        storageBucket: body.storageBucket,
      });

      return NextResponse.json(
        {
          avatar: {
            id: inserted.id,
            label: 'Avatar personalizado',
            videoUrl: inserted.video_path ?? body.publicUrl,
            type: 'uploaded' as const,
            createdAt: inserted.created_at,
          },
        },
        { status: 201 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de avatar não enviado' }, { status: 400 });
    }

    console.log('📤 Upload de avatar iniciado:', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2) + 'MB',
      fileType: file.type,
      userEmail: user.email,
    });

    const arrayBuffer = await file.arrayBuffer();
    console.log('✅ ArrayBuffer criado, tamanho:', arrayBuffer.byteLength);

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
        console.error('❌ Erro ao enviar avatar para Supabase Storage:', {
          message: uploadError.message,
          name: uploadError.name,
          bucket,
          storagePath,
          fileSize: buffer.length,
          fileSizeMB: (buffer.length / 1024 / 1024).toFixed(2) + 'MB',
          contentType,
        });
        return NextResponse.json(
          {
            error: 'Falha ao salvar avatar no armazenamento',
            details: uploadError.message ?? 'Erro desconhecido no Storage',
            errorName: uploadError.name,
          },
          { status: 500 }
        );
      }

      console.log('✅ Avatar salvo no Storage com sucesso');

      const { data: publicUrlResult } = supabase.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = publicUrlResult.publicUrl;

      const { data: inserted, error } = await supabase
        .from('user_avatars')
        .insert({
          id: fileId,
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
            label: 'Avatar personalizado',
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
        id: fileId,
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
