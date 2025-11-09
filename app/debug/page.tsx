import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DebugPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login');
  }

  // Verificar variáveis de ambiente
  const envVars = {
    NEXT_PUBLIC_NEWPORT_API_KEY: process.env.NEXT_PUBLIC_NEWPORT_API_KEY ? '✓ Configurado' : '✗ Ausente',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Configurado' : '✗ Ausente',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Configurado' : '✗ Ausente',
    NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET || 'audio (padrão)',
    NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars (padrão)',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'Não configurado',
    VERCEL: process.env.VERCEL ? '✓ Rodando no Vercel' : '✗ Ambiente local',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  // Testar conexão com buckets
  const audioBucket = process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET || 'audio';
  const avatarBucket = process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || 'avatars';
  const videoBucket = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || 'videos';

  const audioStorageTest = await supabase.storage.from(audioBucket).list('', { limit: 1 });
  const avatarStorageTest = await supabase.storage.from(avatarBucket).list('', { limit: 1 });
  const videoStorageTest = await supabase.storage.from(videoBucket).list('', { limit: 1 });

  // Testar acesso às tabelas
  const userAvatarsTest = await supabase
    .from('user_avatars')
    .select('count')
    .eq('user_email', user.email)
    .limit(1);

  const userAudiosTest = await supabase
    .from('user_audios')
    .select('count')
    .eq('user_email', user.email)
    .limit(1);

  const videosTest = await supabase
    .from('videos')
    .select('count')
    .eq('user_email', user.email)
    .limit(1);

  const emailsTest = await supabase
    .from('emails')
    .select('plano, creditos, creditos_extras')
    .eq('email', user.email)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">🔍 Debug - Diagnóstico Completo</h1>
          <p className="text-sm text-gray-600">
            Usuário: <span className="font-medium">{user.email}</span>
          </p>
          <p className="text-sm text-gray-600">
            ID: <span className="font-mono text-xs">{user.id}</span>
          </p>
        </div>

        {/* Variáveis de Ambiente */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">📋 Variáveis de Ambiente</h2>
          <div className="space-y-2">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="font-mono text-sm text-gray-700">{key}</span>
                <span className={`text-sm ${value.includes('✓') ? 'text-green-600' : value.includes('✗') ? 'text-red-600' : 'text-gray-600'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Storage Buckets */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">🗂️ Supabase Storage</h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-medium text-gray-800">Bucket: {audioBucket}</h3>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm">
                  Status: {audioStorageTest.error ? (
                    <span className="text-red-600">✗ Erro - {audioStorageTest.error.message}</span>
                  ) : (
                    <span className="text-green-600">✓ OK</span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-gray-800">Bucket: {avatarBucket}</h3>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm">
                  Status: {avatarStorageTest.error ? (
                    <span className="text-red-600">✗ Erro - {avatarStorageTest.error.message}</span>
                  ) : (
                    <span className="text-green-600">✓ OK</span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-gray-800">Bucket: {videoBucket}</h3>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm">
                  Status: {videoStorageTest.error ? (
                    <span className="text-red-600">✗ Erro - {videoStorageTest.error.message}</span>
                  ) : (
                    <span className="text-green-600">✓ OK</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabelas do Banco */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">🗄️ Tabelas do Banco de Dados</h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-medium text-gray-800">Tabela: user_avatars</h3>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm">
                  Status: {userAvatarsTest.error ? (
                    <span className="text-red-600">✗ Erro - {userAvatarsTest.error.message}</span>
                  ) : (
                    <span className="text-green-600">✓ OK - Acesso permitido</span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-gray-800">Tabela: user_audios</h3>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm">
                  Status: {userAudiosTest.error ? (
                    <span className="text-red-600">✗ Erro - {userAudiosTest.error.message}</span>
                  ) : (
                    <span className="text-green-600">✓ OK - Acesso permitido</span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-gray-800">Tabela: videos</h3>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm">
                  Status: {videosTest.error ? (
                    <span className="text-red-600">✗ Erro - {videosTest.error.message}</span>
                  ) : (
                    <span className="text-green-600">✓ OK - Acesso permitido</span>
                  )}
                </p>
              </div>
            </div>
            <div>
              <h3 className="mb-2 font-medium text-gray-800">Tabela: emails</h3>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm">
                  Status: {emailsTest.error ? (
                    <span className="text-red-600">✗ Erro - {emailsTest.error.message}</span>
                  ) : (
                    <span className="text-green-600">✓ OK - Dados: {JSON.stringify(emailsTest.data)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* API Newport */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">🎬 API Newport (LipSync)</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-sm font-medium text-gray-700">NEXT_PUBLIC_NEWPORT_API_KEY</span>
              <span className={`text-sm ${process.env.NEXT_PUBLIC_NEWPORT_API_KEY ? 'text-green-600' : 'text-red-600'}`}>
                {process.env.NEXT_PUBLIC_NEWPORT_API_KEY ? (
                  <>✓ Configurado ({process.env.NEXT_PUBLIC_NEWPORT_API_KEY.slice(0, 8)}...)</>
                ) : (
                  '✗ Ausente - Configure esta variável!'
                )}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-sm font-medium text-gray-700">Endpoint</span>
              <span className="font-mono text-xs text-gray-600">
                https://api.newportai.com/api/async/lipsync
              </span>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-4">
          <a
            href="/avatar-video"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            ← Voltar ao Avatar Video
          </a>
          <a
            href="/home"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300"
          >
            Ir para Home
          </a>
        </div>

        {/* Instruções */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="mb-2 font-semibold text-amber-900">⚠️ Como corrigir erros</h3>
          <ul className="space-y-2 text-sm text-amber-800">
            <li>
              <strong>NEXT_PUBLIC_NEWPORT_API_KEY ausente:</strong> Adicione a variável no Vercel (Settings → Environment Variables)
            </li>
            <li>
              <strong>Bucket não encontrado:</strong> Crie os buckets 'audio' e 'avatars' no Supabase Storage
            </li>
            <li>
              <strong>Erro nas tabelas:</strong> Execute as migrations SQL no Supabase e configure RLS policies
            </li>
            <li>
              <strong>Após fazer mudanças:</strong> Faça redeploy no Vercel para aplicar as configurações
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

