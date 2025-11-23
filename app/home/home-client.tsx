'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import { WelcomeModal } from '@/components/welcome-modal';
import { useWelcomeModal } from '@/lib/use-welcome-modal';
import type { Profile } from '@/lib/profile';

interface HomeClientProps {
  initialProfile: Profile;
  userEmail: string;
}

const HEADLINES = [
  "O que vamos criar hoje?",
  "Por onde você quer começar?",
  "Transforme ideias em realidade",
  "Crie algo incrível",
  "Comece a criar",
  "O que você quer criar hoje?"
];

export default function HomeClient({ initialProfile, userEmail }: HomeClientProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(() => 
    Math.floor(Math.random() * HEADLINES.length)
  );
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Verificar se é primeiro acesso
  const [isFirstTime, setIsFirstTime] = useState(false);
  useEffect(() => {
    const firstTimeFlag = sessionStorage.getItem('isFirstTimeUser');
    if (firstTimeFlag === 'true') {
      setIsFirstTime(true);
      sessionStorage.removeItem('isFirstTimeUser'); // Limpar após usar
    }
  }, []);
  
  const { showWelcomeModal, handleCloseModal } = useWelcomeModal(userEmail, isFirstTime);

  useEffect(() => {
    const currentPhrase = HEADLINES[currentPhraseIndex];
    
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (displayedText.length < currentPhrase.length) {
          setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
        } else {
          // Wait before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting
        if (displayedText.length > 0) {
          setDisplayedText(displayedText.slice(0, -1));
        } else {
          // Move to next random phrase
          setIsDeleting(false);
          let nextIndex;
          do {
            nextIndex = Math.floor(Math.random() * HEADLINES.length);
          } while (nextIndex === currentPhraseIndex);
          setCurrentPhraseIndex(nextIndex);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [displayedText, isDeleting, currentPhraseIndex]);

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <WelcomeModal isOpen={showWelcomeModal} onClose={handleCloseModal} />
      <div className="space-y-6">
        {/* Headline with Typing Animation */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 min-h-[3rem]">
            {displayedText}
            <span className="animate-pulse">|</span>
          </h1>
        </div>

        {/* 4 Small Cards in a Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Avatar Video Card */}
          <Link href="/avatar-video">
            <div className="group relative overflow-hidden rounded-2xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/30 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z" />
                    <path d="M19 10c.5-.5 1-1 1-2" />
                    <path d="M19 6c1 1 2 2 2 4" />
                    <path d="M5 10c-.5-.5-1-1-1-2" />
                    <path d="M5 6c-1 1-2 2-2 4" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Vídeo Avatar</h3>
                <p className="text-sm text-gray-700">Crie avatares animados que falam com sincronização labial</p>
              </div>
            </div>
          </Link>

          {/* Create Voice Card */}
          <Link href="/create-voice">
            <div className="group relative overflow-hidden rounded-2xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/30 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Criar Voz</h3>
                <p className="text-sm text-gray-700">Gere vozes realistas com IA ou clone sua voz</p>
              </div>
            </div>
          </Link>

          {/* Image Generator Card */}
          <Link href="/image-generator">
            <div className="group relative overflow-hidden rounded-2xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-400/30 to-lime-400/30 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 shadow-lg transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Gerar Imagem</h3>
                <p className="text-sm text-gray-700">Crie imagens incríveis com IA</p>
              </div>
            </div>
          </Link>

          {/* Video Generator Card */}
          <Link href="/video-generator">
            <div className="group relative overflow-hidden rounded-2xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer">
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-orange-400/30 to-amber-400/30 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">Gerar Vídeo</h3>
                <p className="text-sm text-gray-700">Crie vídeos incríveis com IA</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Two Square Cards Below */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ferramentas Poderosas Card */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-8 transition-all duration-300 hover:shadow-2xl">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-purple-400/30 to-pink-400/30 blur-3xl" />
            <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-gradient-to-br from-blue-400/30 to-cyan-400/30 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col min-h-[300px]">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">Ferramentas Poderosas</h2>
              <p className="text-gray-700 leading-relaxed">
                Acesse as melhores ferramentas de IA gratuitas para criação de conteúdo. Crie vídeos, vozes e imagens com qualidade profissional de forma rápida e intuitiva.
              </p>
            </div>
          </div>

          {/* Updates Card */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-8 transition-all duration-300 hover:shadow-2xl">
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-400/30 to-lime-400/30 blur-3xl" />
            <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-gradient-to-br from-orange-400/30 to-yellow-400/30 blur-3xl" />
            <div className="relative z-10 flex h-full flex-col min-h-[300px]">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">Atualizações</h2>
              {/* Updates content will go here */}
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
