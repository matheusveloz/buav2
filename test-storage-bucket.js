/**
 * Script de teste rápido para verificar o bucket de Storage
 * 
 * Como usar:
 * 1. Substitua os valores de SUPABASE_URL e SUPABASE_ANON_KEY
 * 2. Execute: node test-storage-bucket.js
 */

const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Ex: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'; // Sua anon key

async function testStorageBucket() {
  console.log('🔍 Testando configuração do Storage...\n');
  
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.error('❌ Configure SUPABASE_URL e SUPABASE_ANON_KEY primeiro!');
    return;
  }
  
  try {
    // Teste 1: Verificar se o bucket existe
    console.log('1️⃣ Verificando buckets...');
    const bucketsResponse = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    const buckets = await bucketsResponse.json();
    console.log('📦 Buckets encontrados:', buckets.map(b => b.name || b.id));
    
    const hasGeneratedImages = buckets.some(b => 
      b.name === 'generated-images' || b.id === 'generated-images'
    );
    
    if (!hasGeneratedImages) {
      console.error('\n❌ PROBLEMA ENCONTRADO: Bucket "generated-images" NÃO existe!');
      console.log('\n📝 SOLUÇÃO:');
      console.log('1. Acesse: ' + SUPABASE_URL.replace('https://', 'https://app.supabase.com/project/'));
      console.log('2. Vá para Storage no menu lateral');
      console.log('3. Clique em "New bucket"');
      console.log('4. Nome: generated-images');
      console.log('5. Marque como PUBLIC ✅');
      console.log('6. File size limit: 10MB');
      console.log('7. Clique em Create\n');
      return;
    }
    
    console.log('✅ Bucket "generated-images" encontrado!\n');
    
    // Teste 2: Verificar se é público
    console.log('2️⃣ Verificando configurações do bucket...');
    const bucketInfo = buckets.find(b => 
      b.name === 'generated-images' || b.id === 'generated-images'
    );
    
    console.log('🔍 Detalhes do bucket:', {
      nome: bucketInfo.name || bucketInfo.id,
      público: bucketInfo.public ? '✅ Sim' : '❌ Não',
      tamanhoMáximo: bucketInfo.file_size_limit ? `${bucketInfo.file_size_limit / 1024 / 1024}MB` : 'Não definido',
      criado: bucketInfo.created_at
    });
    
    if (!bucketInfo.public) {
      console.error('\n⚠️ AVISO: Bucket não está público! As imagens podem não ser acessíveis.');
      console.log('🔧 Para corrigir: Edite o bucket no Dashboard e marque como público.\n');
    }
    
    console.log('\n✅ Configuração do Storage está OK!');
    
  } catch (error) {
    console.error('❌ Erro ao testar:', error.message);
    console.log('\n💡 Verifique se:');
    console.log('- SUPABASE_URL está correto');
    console.log('- SUPABASE_ANON_KEY está correto');
    console.log('- Você tem acesso ao projeto');
  }
}

// Executar teste
testStorageBucket();
