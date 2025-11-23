'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const WELCOME_MODAL_KEY = 'buua_welcome_shown';

export function useWelcomeModal(userEmail: string | null, isFirstTimeUser: boolean = false) {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (!userEmail) return;

    // Verificar se o modal já foi mostrado para este usuário
    const checkAndShowModal = async () => {
      try {
        // Chave específica por usuário
        const storageKey = `${WELCOME_MODAL_KEY}_${userEmail}`;
        const hasShownModal = localStorage.getItem(storageKey);

        // Se não mostrou ainda e é primeiro acesso, mostrar modal
        if (!hasShownModal && isFirstTimeUser) {
          // Aguardar um pouco para garantir que a página carregou
          setTimeout(() => {
            setShowWelcomeModal(true);
          }, 500);
        }
      } catch (error) {
        console.error('Erro ao verificar modal de boas-vindas:', error);
      }
    };

    checkAndShowModal();
  }, [userEmail, isFirstTimeUser]);

  const handleCloseModal = () => {
    setShowWelcomeModal(false);
    
    // Marcar como mostrado
    if (userEmail) {
      const storageKey = `${WELCOME_MODAL_KEY}_${userEmail}`;
      localStorage.setItem(storageKey, 'true');
    }
  };

  return {
    showWelcomeModal,
    handleCloseModal,
  };
}

// Hook alternativo que verifica direto no banco se o usuário acabou de ser criado
export function useFirstTimeUser(userEmail: string | null) {
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    if (!userEmail) return;

    const checkFirstTime = async () => {
      try {
        const { data: profile } = await supabase
          .from('emails')
          .select('created_at')
          .eq('email', userEmail)
          .single();

        if (profile?.created_at) {
          // Verificar se foi criado nos últimos 5 minutos
          const createdAt = new Date(profile.created_at);
          const now = new Date();
          const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
          
          setIsFirstTime(diffMinutes <= 5);
        }
      } catch (error) {
        console.error('Erro ao verificar primeiro acesso:', error);
      }
    };

    checkFirstTime();
  }, [userEmail]);

  return isFirstTime;
}

