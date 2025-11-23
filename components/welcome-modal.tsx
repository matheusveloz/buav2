'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen && !isAnimating) {
      setIsAnimating(true);
      
      // Disparar confetes múltiplas vezes para criar efeito mais intenso
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          setIsAnimating(false);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Confetes da esquerda
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1', '#98FB98']
        }));
        
        // Confetes da direita
        confetti(Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1', '#98FB98']
        }));
      }, 250);

      // Explosão inicial no centro
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1', '#98FB98'],
        zIndex: 9999
      });
    }
  }, [isOpen, isAnimating]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-2xl p-8 max-w-md mx-4 transform animate-scaleIn relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Background decorativo */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-pink-500 to-yellow-500 rounded-full blur-3xl" />
          </div>

          {/* Conteúdo */}
          <div className="relative z-10 text-center">
            {/* Ícone de celebração */}
            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-bounce">
              <span className="text-4xl">🎉</span>
            </div>

            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Parabéns! 🎊
            </h2>
            
            <p className="text-xl text-gray-700 mb-4">
              Seja bem-vindo ao BUUA!
            </p>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6">
              <p className="text-lg text-gray-700 mb-2">
                Você ganhou
              </p>
              <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                90 créditos
              </p>
              <p className="text-sm text-gray-600 mt-2">
                para usar como quiser! ✨
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Comece a criar vídeos incríveis com avatares de IA agora mesmo!
            </p>

            <button
              onClick={onClose}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              Começar a Criar! 🚀
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.4s ease-out;
        }
      `}</style>
    </>
  );
}

