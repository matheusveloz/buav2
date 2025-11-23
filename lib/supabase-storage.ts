import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Converte data URL para Blob
 */
function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
}

/**
 * Upload de imagem para Supabase Storage
 * @param dataUrl - Data URL da imagem (base64)
 * @param userEmail - Email do usuário
 * @param imageId - ID único da imagem
 * @returns URL pública da imagem no Storage
 */
export async function uploadImageToStorage(
  dataUrl: string,
  userEmail: string,
  imageId: string
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  
  // Converter data URL para Blob
  const blob = dataURLtoBlob(dataUrl);
  
  // Extrair extensão do tipo MIME
  const mimeType = dataUrl.match(/data:image\/(.*?);/)?.[1] || 'png';
  const fileName = `${userEmail.replace('@', '_at_')}/${imageId}.${mimeType}`;
  
  // Upload para o bucket
  const { data, error } = await supabase.storage
    .from('generated-images')
    .upload(fileName, blob, {
      contentType: `image/${mimeType}`,
      upsert: true, // Sobrescrever se existir
    });
  
  if (error) {
    console.error('Erro no upload para Storage:', error);
    throw error;
  }
  
  // Retornar URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('generated-images')
    .getPublicUrl(fileName);
  
  return publicUrl;
}

/**
 * Upload de múltiplas imagens
 */
export async function uploadMultipleImages(
  images: Array<{ dataUrl: string; imageType: string }>,
  userEmail: string,
  generationId: string
): Promise<Array<{ imageUrl: string; imageType: string }>> {
  const uploadPromises = images.map(async (img, index) => {
    const imageId = `${generationId}_${index}`;
    const storageUrl = await uploadImageToStorage(img.dataUrl, userEmail, imageId);
    
    return {
      imageUrl: storageUrl,
      imageType: img.imageType,
    };
  });
  
  return Promise.all(uploadPromises);
}
