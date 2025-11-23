/**
 * Script de migração: Data URLs (base64) para Supabase Storage
 * 
 * Como usar:
 * 1. npm install @supabase/supabase-js
 * 2. Configurar variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY abaixo
 * 3. node tools/migrate-base64-to-storage.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// CONFIGURE AQUI suas credenciais
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
  console.error('❌ Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY neste arquivo');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

// Configurações
const BATCH_SIZE = 5; // Processar 5 imagens por vez
const TARGET_USER = 'empresa.stnnetwork@gmail.com'; // Processar apenas este usuário primeiro

/**
 * Converte data URL para Buffer
 */
function dataURLtoBuffer(dataURL) {
  const matches = dataURL.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL');
  }
  
  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  
  return { buffer, mimeType };
}

/**
 * Faz upload de uma imagem para o Storage
 */
async function uploadToStorage(dataUrl, userEmail, imageId, index) {
  try {
    const { buffer, mimeType } = dataURLtoBuffer(dataUrl);
    const extension = mimeType.split('/')[1] || 'png';
    const fileName = `${userEmail.replace('@', '_at_')}/${imageId}_${index}.${extension}`;
    
    // Upload para o Storage
    const { error } = await supabase.storage
      .from('generated-images')
      .upload(fileName, buffer, {
        contentType: mimeType,
        upsert: true,
      });
    
    if (error) {
      console.error(`❌ Erro no upload ${fileName}:`, error.message);
      return null;
    }
    
    // Obter URL pública
    const { data } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  } catch (error) {
    console.error('❌ Erro ao processar imagem:', error);
    return null;
  }
}

/**
 * Migra imagens de um registro
 */
async function migrateRecord(record) {
  try {
    const imageUrls = record.image_urls;
    if (!Array.isArray(imageUrls)) {
      return false;
    }
    
    // Verificar se já foi migrado
    if (imageUrls.every(img => !img.imageUrl.startsWith('data:'))) {
      console.log(`✓ Registro ${record.id} já migrado`);
      return true;
    }
    
    console.log(`🔄 Migrando registro ${record.id} (${imageUrls.length} imagens)`);
    
    const newUrls = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const imgData = imageUrls[i];
      
      // Se não é data URL, manter como está
      if (!imgData.imageUrl.startsWith('data:')) {
        newUrls.push(imgData);
        continue;
      }
      
      // Fazer upload
      const storageUrl = await uploadToStorage(
        imgData.imageUrl,
        record.user_email,
        record.id,
        i
      );
      
      if (storageUrl) {
        newUrls.push({
          imageUrl: storageUrl,
          imageType: imgData.imageType || 'png',
        });
        console.log(`  ✅ Imagem ${i + 1}/${imageUrls.length} migrada`);
      } else {
        // Em caso de erro, manter a original
        newUrls.push(imgData);
        console.log(`  ❌ Imagem ${i + 1}/${imageUrls.length} falhou (mantendo original)`);
      }
    }
    
    // Atualizar registro no banco
    const { error } = await supabase
      .from('generated_images')
      .update({ 
        image_urls: newUrls,
        migrated_at: new Date().toISOString(),
      })
      .eq('id', record.id);
    
    if (error) {
      console.error(`❌ Erro ao atualizar registro ${record.id}:`, error.message);
      return false;
    }
    
    console.log(`✅ Registro ${record.id} migrado com sucesso!`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao migrar registro ${record.id}:`, error);
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando migração de imagens base64 para Storage...');
  console.log(`🎯 Usuário alvo: ${TARGET_USER}`);
  
  try {
    // Criar bucket se não existir
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === 'generated-images')) {
      console.log('📦 Criando bucket generated-images...');
      await supabase.storage.createBucket('generated-images', { 
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
    }
    
    // Buscar registros com data URLs
    let offset = 0;
    let hasMore = true;
    let totalMigrated = 0;
    let totalFailed = 0;
    
    while (hasMore) {
      console.log(`\n📥 Buscando registros (offset: ${offset})...`);
      
      const { data: records, error } = await supabase
        .from('generated_images')
        .select('id, user_email, image_urls, status')
        .eq('user_email', TARGET_USER)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1);
      
      if (error) {
        console.error('❌ Erro ao buscar registros:', error.message);
        break;
      }
      
      if (!records || records.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`📊 Processando ${records.length} registros...`);
      
      // Processar registros
      for (const record of records) {
        const success = await migrateRecord(record);
        if (success) {
          totalMigrated++;
        } else {
          totalFailed++;
        }
        
        // Pequena pausa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      offset += BATCH_SIZE;
      
      // Continuar apenas se todos foram processados
      hasMore = records.length === BATCH_SIZE;
    }
    
    console.log('\n✨ Migração concluída!');
    console.log(`✅ Registros migrados: ${totalMigrated}`);
    console.log(`❌ Registros com falha: ${totalFailed}`);
    
    // Salvar relatório
    const report = {
      date: new Date().toISOString(),
      user: TARGET_USER,
      migrated: totalMigrated,
      failed: totalFailed,
    };
    
    fs.writeFileSync(
      `migration-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar
main();
