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
      <div className="space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Cards Grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:gap-10">
          {/* Avatar Video Card - Glassmorphism 3D */}
          <div className="group relative transform-gpu perspective-1000">
            {/* 3D Effect Container */}
            <div className="relative transform transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:rotate-y-3">
              {/* Glowing border effect */}
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-60" />
              
              {/* Main glass card */}
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-2xl shadow-2xl">
                {/* Shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                
                {/* Decorative glass orbs */}
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/30 blur-3xl" />
                <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 blur-3xl" />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="relative w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/50" />
                    <Image
                      src="/gif_avatar_video.gif"
                      alt="Avatar Vídeo"
                      width={300}
                      height={200}
                      className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6 backdrop-blur-sm">
                    <h3 className="mb-2 text-xl font-bold text-gray-900">Vídeo de avatar</h3>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-700">
                      Transforme suas ideias ou roteiros em avatares animados impressionantes que falam naturalmente.
                    </p>
                    <Link
                      href="/avatar-video"
                      className="group/btn relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-purple-500/50"
                    >
                      <span className="relative z-10">Criar Avatar</span>
                      <svg className="relative z-10 h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 transition-opacity group-hover/btn:opacity-100" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Create Voice Card - Glassmorphism 3D */}
          <div className="group relative transform-gpu perspective-1000">
            <div className="relative transform transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:rotate-y-3">
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-60" />
              
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-2xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/30 blur-3xl" />
                <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500/30 to-cyan-500/30 blur-3xl" />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="relative w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/50" />
                    <Image
                      src="/gif_criarvoz.gif"
                      alt="Criar Voz"
                      width={300}
                      height={200}
                      className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6 backdrop-blur-sm">
                    <h3 className="mb-2 text-xl font-bold text-gray-900">Criar Voz</h3>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-700">
                      Gere vozes realistas e personalizadas com inteligência artificial para seus projetos e conteúdos.
                    </p>
                    <Link
                      href="/create-voice"
                      className="group/btn relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-blue-500/50"
                    >
                      <span className="relative z-10">Criar Voz</span>
                      <svg className="relative z-10 h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 transition-opacity group-hover/btn:opacity-100" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Create Image Card - Glassmorphism 3D */}
          <div className="group relative transform-gpu perspective-1000">
            <div className="relative transform transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:rotate-y-3">
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-emerald-500 via-lime-500 to-emerald-500 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-60" />
              
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-2xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-400/30 to-lime-400/30 blur-3xl" />
                <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500/30 to-lime-500/30 blur-3xl" />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="relative w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/50" />
                    <Image
                      src="/gif_gerar_img.gif"
                      alt="Criar Imagem"
                      width={300}
                      height={200}
                      className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6 backdrop-blur-sm">
                    <h3 className="mb-2 text-xl font-bold text-gray-900">Gerar Imagem</h3>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-700">
                      Geração de imagens rápida e gratuita com poderosa consistência entre imagens.
                    </p>
                    <button className="group/btn relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-emerald-500/50">
                      <span className="relative z-10">Gerar Imagem</span>
                      <svg className="relative z-10 h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-lime-600 opacity-0 transition-opacity group-hover/btn:opacity-100" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Animate Image/Text Card - Glassmorphism 3D */}
          <div className="group relative transform-gpu perspective-1000">
            <div className="relative transform transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-2 group-hover:rotate-y-3">
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-60" />
              
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-2xl shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-orange-400/30 to-yellow-400/30 blur-3xl" />
                <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-gradient-to-br from-orange-500/30 to-yellow-500/30 blur-3xl" />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="relative w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/50" />
                    <Image
                      src="/gif_animar_img.gif"
                      alt="Animar imagem ou texto"
                      width={300}
                      height={200}
                      className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-6 backdrop-blur-sm">
                    <h3 className="mb-2 text-xl font-bold text-gray-900">Animar imagem ou texto</h3>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-700">
                      Transforme imagens estáticas ou texto em animações de vídeo dinâmicas e realistas.
                    </p>
                    <button className="group/btn relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-yellow-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:shadow-orange-500/50">
                      <span className="relative z-10">Animar Agora</span>
                      <svg className="relative z-10 h-4 w-4 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-yellow-600 opacity-0 transition-opacity group-hover/btn:opacity-100" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coming Soon Card - Glassmorphism 3D */}
          <div className="group relative transform-gpu perspective-1000">
            <div className="relative transform transition-all duration-500">
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 backdrop-blur-2xl shadow-2xl opacity-60">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-gray-400/20 to-gray-500/20 blur-3xl" />
                <div className="absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-gradient-to-br from-gray-400/20 to-gray-500/20 blur-3xl" />

                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex h-48 items-center justify-center bg-gradient-to-br from-gray-50/80 to-gray-100/80 backdrop-blur-sm">
                    <div className="relative flex h-20 w-20 items-center justify-center">
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-gray-300 to-gray-400 blur-xl opacity-50" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg">
                        <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-6 backdrop-blur-sm">
                    <h3 className="mb-2 text-xl font-bold text-gray-900">Mais recursos</h3>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-gray-700">
                      Novos recursos incríveis estão sendo desenvolvidos. Fique atento às próximas atualizações!
                    </p>
                    <button disabled className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-gray-300/50 bg-gray-100/50 px-6 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed backdrop-blur-sm">
                      Em breve
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Powered by <span className="font-semibold text-green-600">BUUA</span> AI
          </p>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
