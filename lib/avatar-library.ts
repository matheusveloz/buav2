import { readdir } from 'node:fs/promises';
import { Dirent } from 'node:fs';
import { join, parse } from 'node:path';

const PUBLIC_ROOT = join(process.cwd(), 'public');
const BUILTIN_AVATAR_DIR = join(PUBLIC_ROOT, 'avatar');

export type AvatarLibraryItem = {
  id: string;
  label: string;
  videoUrl: string;
  type: 'builtin' | 'uploaded';
};

export async function listBuiltinAvatars(): Promise<AvatarLibraryItem[]> {
  let entries: Dirent[] = [];
  try {
    entries = await readdir(BUILTIN_AVATAR_DIR, { withFileTypes: true });
  } catch (error) {
    console.error('Não foi possível ler a pasta de avatares padrão.', error);
    return [];
  }

  const avatars: AvatarLibraryItem[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const { name, ext } = parse(entry.name);

    if (!['.mp4', '.webm', '.mov'].includes(ext.toLowerCase())) {
      continue;
    }

    const videoUrl = `/avatar/${entry.name}`;

    avatars.push({
      id: `builtin-${name}`,
      label: name.replace(/[-_]/g, ' '),
      videoUrl,
      type: 'builtin',
    });
  }

  return avatars;
}

