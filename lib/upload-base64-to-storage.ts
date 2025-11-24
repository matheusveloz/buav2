import { SupabaseClient } from '@supabase/supabase-js';
import { replaceSupabaseDomain } from '@/lib/custom-domain';

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
 * Upload de imagem base64 para Supabase Storage
 * Usado pela API do Nano Banana para evitar salvar base64 no banco
 */
export async function uploadBase64ToStorage(
  supabase: SupabaseClient,
  base64DataUrl: string,
  userEmail: string,
  taskId: string,
  imageIndex: number = 0
): Promise<{ imageUrl: string; imageType: string } | null> {
  let fileName = ''; // Declarar fora do try para estar disponível no catch
  
  try {
    console.log('🔄 Iniciando upload para Storage...', {
      taskId,
      imageIndex,
      dataUrlLength: base64DataUrl.length,
    });
    
    // Verificar se o bucket existe
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError);
    } else {
      const bucketExists = buckets?.some(b => b.name === 'generated-images' || b.id === 'generated-images');
      console.log('🪣 Bucket "generated-images" existe?', bucketExists);
      
      if (!bucketExists) {
        console.error('❌ ERRO CRÍTICO: Bucket "generated-images" NÃO EXISTE!');
        console.error('📝 SOLUÇÃO: Execute o script VERIFY_STORAGE_BUCKET.sql ou crie manualmente no Supabase Dashboard');
        return null;
      }
    }

    // Converter para Blob
    const blob = dataURLtoBlob(base64DataUrl);
    
    // Extrair tipo de imagem
    const imageType = base64DataUrl.match(/data:image\/(.*?);/)?.[1] || 'png';
    
    // Gerar nome do arquivo
    const timestamp = Date.now();
    fileName = `${userEmail.replace('@', '_at_')}/${taskId}_${imageIndex}_${timestamp}.${imageType}`;
    
    // Upload para o bucket
    console.log('📤 Tentando upload:', {
      bucket: 'generated-images',
      fileName,
      blobSize: blob.size,
      contentType: `image/${imageType}`
    });
    
    const { data, error } = await supabase.storage
      .from('generated-images')
      .upload(fileName, blob, {
        contentType: `image/${imageType}`,
        cacheControl: '3600',
        upsert: true,
      });
    
    if (error) {
      console.error('❌ Erro no upload para Storage:', {
        error: error.message,
        details: error,
        bucket: 'generated-images',
        fileName
      });
      
      // Verificar erros comuns
      if (error.message?.includes('not found')) {
        console.error('🪣 ERRO: Bucket "generated-images" não existe! Crie no Supabase Dashboard.');
      } else if (error.message?.includes('policy')) {
        console.error('🔒 ERRO: Problema de permissão no bucket. Verifique se é público.');
      }
      
      return null;
    }
    
    // Obter URL pública com domínio customizado
    const { data: { publicUrl } } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);
    
    const finalUrl = replaceSupabaseDomain(publicUrl);
    
    console.log('✅ Upload concluído:', {
      fileName,
      publicUrl: finalUrl,
      imageType,
    });
    
    return {
      imageUrl: finalUrl,
      imageType: imageType,
    };
  } catch (error) {
    console.error('❌ Erro ao fazer upload do base64:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userEmail,
      taskId,
      fileName: fileName || 'not-generated-yet'
    });
    return null;
  }
}
