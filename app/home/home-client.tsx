'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import type { Profile } from '@/lib/profile';

interface HomeClientProps {
  initialProfile: Profile;
  userEmail: string;
}

export default function HomeClient({ initialProfile, userEmail }: HomeClientProps) {
  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="group relative z-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg transition-all hover:shadow-xl">
          <div className="w-full">
            <Image
              src="/gif_avatar_video.gif"
              alt="Avatar Vídeo"
              width={300}
              height={200}
              className="h-48 w-full object-cover"
              unoptimized
            />
          </div>
          <div className="p-8">
            <h3 className="mb-3 text-xl font-bold text-gray-900">Avatar Vídeo</h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-600">
              Transforme suas ideias ou roteiros em avatares animados impressionantes que falam naturalmente.
            </p>
            <Link
              href="/avatar-video"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105"
            >
              Criar Avatar
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg transition-all hover:shadow-xl">
          <div className="w-full">
            <Image
              src="/gif_criarvoz.gif"
              alt="Criar Voz"
              width={300}
              height={200}
              className="h-48 w-full object-cover"
              unoptimized
            />
          </div>
          <div className="p-8">
            <h3 className="mb-3 text-xl font-bold text-gray-900">Criar Voz</h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-600">
              Gere vozes realistas e personalizadas com inteligência artificial para seus projetos e conteúdos.
            </p>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105">
              Criar Voz
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg transition-all hover:shadow-xl">
          <div className="w-full">
            <Image
              src="/gif_gerar_img.gif"
              alt="Criar Imagem"
              width={300}
              height={200}
              className="h-48 w-full object-cover"
              unoptimized
            />
          </div>
          <div className="p-8">
            <h3 className="mb-3 text-xl font-bold text-gray-900">Criar Imagem</h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-600">
              Geração de imagens rápida e gratuita com poderosa consistência entre imagens.
            </p>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105">
              Criar Imagem
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg transition-all hover:shadow-xl">
          <div className="w-full">
            <Image
              src="/gif_animar_img.gif"
              alt="Animar imagem ou texto"
              width={300}
              height={200}
              className="h-48 w-full object-cover"
              unoptimized
            />
          </div>
          <div className="p-8">
            <h3 className="mb-3 text-xl font-bold text-gray-900">Animar imagem ou texto</h3>
            <p className="mb-6 text-sm leading-relaxed text-gray-600">
              Transforme imagens estáticas ou texto em animações de vídeo dinâmicas e realistas.
            </p>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-105">
              Animar Agora
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-lg opacity-60">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h3 className="mb-3 text-xl font-bold text-gray-900">Mais recursos</h3>
          <p className="mb-6 text-sm leading-relaxed text-gray-600">
            Novos recursos incríveis estão sendo desenvolvidos. Fique atento às próximas atualizações!
          </p>
          <button disabled className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-gray-300 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed">
            Em breve
          </button>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
