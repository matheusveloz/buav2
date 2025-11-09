import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

const PUBLIC_ROOT = join(process.cwd(), 'public');
const UPLOADS_ROOT = join(PUBLIC_ROOT, 'uploads');
const VIDEO_UPLOADS_DIR = join(UPLOADS_ROOT, 'videos');
const AVATAR_UPLOADS_DIR = join(UPLOADS_ROOT, 'avatars');
const AUDIO_UPLOADS_DIR = join(UPLOADS_ROOT, 'audio');

async function ensureDirectory(path: string) {
  await mkdir(path, { recursive: true });
}

export async function ensureVideoUploadsDir() {
  await ensureDirectory(VIDEO_UPLOADS_DIR);
}

export async function ensureAvatarUploadsDir() {
  await ensureDirectory(AVATAR_UPLOADS_DIR);
}

export async function ensureAudioUploadsDir() {
  await ensureDirectory(AUDIO_UPLOADS_DIR);
}

export function resolveFileExtension(name: string, fallback: string) {
  const ext = extname(name || '').replace('.', '').trim();
  return ext.length > 0 ? ext : fallback;
}

export async function saveVideoBuffer(taskId: string, buffer: ArrayBuffer, extension = 'mp4') {
  await ensureVideoUploadsDir();

  const safeExtension = extension.replace(/^\./, '');
  const fileName = `${taskId}.${safeExtension}`;
  const filePath = join(VIDEO_UPLOADS_DIR, fileName);

  await writeFile(filePath, Buffer.from(buffer));

  const publicPath = `/uploads/videos/${fileName}`;

  return { filePath, publicPath };
}

export async function saveAvatarFile(file: ArrayBuffer, originalName: string) {
  await ensureAvatarUploadsDir();

  const fileId = randomUUID();
  const ext = resolveFileExtension(originalName, 'mp4');
  const fileName = `${fileId}.${ext}`;
  const filePath = join(AVATAR_UPLOADS_DIR, fileName);

  await writeFile(filePath, Buffer.from(file));

  const publicPath = `/uploads/avatars/${fileName}`;

  return { fileId, filePath, publicPath, extension: ext };
}

export async function saveAudioFile(file: ArrayBuffer, originalName: string) {
  await ensureAudioUploadsDir();

  const fileId = randomUUID();
  const ext = resolveFileExtension(originalName, 'mp3');
  const fileName = `${fileId}.${ext}`;
  const filePath = join(AUDIO_UPLOADS_DIR, fileName);

  await writeFile(filePath, Buffer.from(file));

  const publicPath = `/uploads/audio/${fileName}`;

  return { fileId, filePath, publicPath, extension: ext };
}


