  'use client';

  import { useState, useEffect, useRef, useCallback } from 'react';
  import { createPortal } from 'react-dom';
  import Swal from 'sweetalert2';
  import { AuthenticatedShell } from '@/components/authenticated-shell';
  import { WelcomeModal } from '@/components/welcome-modal';
  import { useWelcomeModal } from '@/lib/use-welcome-modal';
  import type { Profile } from '@/lib/profile';
  import dynamic from 'next/dynamic';

  const Plyr = dynamic(() => import('plyr-react'), { ssr: false });

  type VideoGeneratorClientProps = {
    initialProfile: Profile;
    userEmail: string;
  };

  type GeneratedVideo = {
    id: string;
    videoUrl: string;
    prompt: string;
    createdAt: string;
    isLoading?: boolean;
    seconds: number;
    size: string;
    model: string;
  };

  type TaskStatus = {
    jobId: string;
    generationId: string;
    status: 'processing' | 'completed' | 'failed';
    placeholderIds: string[];
  };

  type ModelConfig = {
    id: 'buua-retrato' | 'buua-paisagem' | 'veo-retrato' | 'veo-paisagem';
    name: string;
    orientation: 'portrait' | 'landscape';
    fixedDuration: number;
    fixedSize: string;
    creditsPerVideo: number;
    description: string;
    icon: string;
    veoModel?: string; // Modelo VEO específico
  };

  // ==================== BUUA 1.0 - MODELOS ====================
  const MODEL_CONFIGS: ModelConfig[] = [
    {
      id: 'buua-retrato',
      name: 'Buua 1.0 Retrato',
      orientation: 'portrait',
      fixedDuration: 15,
      fixedSize: '704x1280',
      creditsPerVideo: 21,
      description: '📱 Formato vertical ideal para redes sociais (15s)',
      icon: '📱',
    },
    {
      id: 'buua-paisagem',
      name: 'Buua 1.0 Paisagem',
      orientation: 'landscape',
      fixedDuration: 15,
      fixedSize: '1280x704',
      creditsPerVideo: 21,
      description: '🖥️ Formato horizontal ideal para YouTube (15s)',
      icon: '🖥️',
    },
  ];

  // ==================== BUUA 2.0 - MODELOS HIGH ====================
  const VEO_MODEL_CONFIGS: ModelConfig[] = [
    {
      id: 'veo-retrato',
      name: 'Buua 2.0 Retrato',
      orientation: 'portrait',
      fixedDuration: 8, // Máximo 8s
      fixedSize: '720x1280', // 9:16
      creditsPerVideo: 35,
      description: '📱 Formato vertical 9:16 (até 8s)',
      icon: '📱',
      veoModel: 'veo-3.1', // ⚡ Modelo padrão Text-to-Video (API auto-converte para -fl se houver imagem)
    },
    {
      id: 'veo-paisagem',
      name: 'Buua 2.0 Paisagem',
      orientation: 'landscape',
      fixedDuration: 8, // Máximo 8s
      fixedSize: '1280x720', // 16:9
      creditsPerVideo: 35,
      description: '🖥️ Formato horizontal 16:9 (até 8s)',
      icon: '🖥️',
      veoModel: 'veo-3.1-landscape', // ⚡ Modelo padrão Text-to-Video (API auto-converte para -fl se houver imagem)
    },
  ];

  // Cálculo de créditos (baseado no modelo e High Quality)
  function getCreditsForConfig(model?: ModelConfig, isHighQuality?: boolean): number {
    if (isHighQuality) {
      return 56; // $0.40 (doc oficial diz) - API pode cobrar $0.15 mas cobramos doc oficial por segurança
    }
    return 21; // $0.15 = 21 créditos (Standard)
  }

  export default function VideoGeneratorClient({
    initialProfile,
    userEmail,
  }: VideoGeneratorClientProps) {
    const [videos, setVideos] = useState<GeneratedVideo[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
    const [profile, setProfile] = useState<Profile>(initialProfile);
    const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [visibleVideosCount, setVisibleVideosCount] = useState(12);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [isChatMinimized, setIsChatMinimized] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    // Buua 1.0 Retrato como padrão
    const [selectedModel, setSelectedModel] = useState<ModelConfig>(MODEL_CONFIGS[0]);
    // VEO: Retrato como padrão
    const [selectedVeoModel, setSelectedVeoModel] = useState<ModelConfig>(VEO_MODEL_CONFIGS[0]);
    const [isHighQuality, setIsHighQuality] = useState(false); // Toggle para High Quality
    
    // Modal de boas-vindas
    const [isFirstTime, setIsFirstTime] = useState(false);
    useEffect(() => {
      const firstTimeFlag = sessionStorage.getItem('isFirstTimeUser');
      if (firstTimeFlag === 'true') {
        setIsFirstTime(true);
        sessionStorage.removeItem('isFirstTimeUser');
      }
    }, []);
    const { showWelcomeModal, handleCloseModal } = useWelcomeModal(userEmail, isFirstTime);
    const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<'1.0' | '2.0'>('1.0'); // ⭐ Seletor de versão
    const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false); // ⭐ Estado do dropdown versão
    const [isOrientationDropdownOpen, setIsOrientationDropdownOpen] = useState(false); // ⭐ Estado do dropdown orientação
    const [isImageWarningExpanded, setIsImageWarningExpanded] = useState(false); // ⭐ Estado do aviso de imagem expandido

  // Bloquear scroll do body quando modal está aberto
  useEffect(() => {
    if (selectedVideo) {
      // Salvar posição atual do scroll
      const scrollY = window.scrollY;
      
      // Bloquear scroll do body em TODAS as telas (mobile, tablet e desktop)
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      // Bloquear eventos de scroll em todas as telas
      const preventScroll = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      // Adicionar listeners com { passive: false } para poder preventDefault
      window.addEventListener('wheel', preventScroll, { passive: false });
      window.addEventListener('touchmove', preventScroll, { passive: false });
      window.addEventListener('scroll', preventScroll, { passive: false });

      // Cleanup
      return () => {
        // Restaurar scroll
        document.body.style.overflow = 'unset';
        document.body.style.position = 'unset';
        document.body.style.top = 'unset';
        document.body.style.width = 'unset';
        window.scrollTo(0, scrollY);
        
        // Remover listeners
        window.removeEventListener('wheel', preventScroll);
        window.removeEventListener('touchmove', preventScroll);
        window.removeEventListener('scroll', preventScroll);
      };
    }
  }, [selectedVideo]);
    
    // Quando HIGH é ativado, forçar portrait (9:16) porque o modelo é 1024×1792
    useEffect(() => {
      if (isHighQuality && selectedModel.orientation !== 'portrait') {
        setSelectedModel(MODEL_CONFIGS[0]); // Forçar Retrato (9:16)
      }
    }, [isHighQuality, selectedModel.orientation]);
    
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const versionDropdownRef = useRef<HTMLDivElement>(null); // ⭐ Ref para o dropdown versão
    const orientationDropdownRef = useRef<HTMLDivElement>(null); // ⭐ Ref para o dropdown orientação

    // Mount
    useEffect(() => {
      setIsMounted(true);
      
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.plyr.io/3.7.8/plyr.css';
      document.head.appendChild(link);
      
      const savedPrompt = localStorage.getItem('videoGeneratorPrompt');
      const savedModel = localStorage.getItem('videoGeneratorModel');

      if (savedPrompt) setPrompt(savedPrompt);
      if (savedModel) {
        const model = MODEL_CONFIGS.find(m => m.id === savedModel);
        if (model) setSelectedModel(model);
      }

      return () => {
        document.head.removeChild(link);
      };
    }, []);

    // ==================== 🚀 VERIFICAR VÍDEOS PENDENTES AO CARREGAR ====================
    // Quando usuário abre a página, verifica se há vídeos em processamento
    useEffect(() => {
      if (!isMounted) return;

      const checkPendingVideos = async () => {
        try {
          console.log('🔍 Verificando vídeos pendentes ao carregar página...');
          
          const response = await fetch('/api/video-worker/check-pending');
          
          if (!response.ok) {
            console.warn('⚠️ Erro ao verificar vídeos pendentes:', response.status);
            return;
          }
          
          const data = await response.json();
          
          if (data.success && data.pendingCount > 0) {
            console.log(`📋 ${data.pendingCount} vídeo(s) pendente(s) encontrado(s)`);
            console.log('🔄 Worker disparado em background!');
            
            // Adicionar cards com loading para vídeos pendentes
            const pendingVideoCards: GeneratedVideo[] = data.videos.map((v: { id: string; prompt: string; created_at: string; seconds: number; size: string; model: string }) => ({
              id: v.id,
              videoUrl: '',
              prompt: v.prompt,
              createdAt: v.created_at,
              isLoading: true,
              seconds: v.seconds,
              size: v.size,
              model: v.model,
            }));
            
            setVideos((prev) => {
              // Evitar duplicatas
              const existingIds = new Set(prev.map(v => v.id));
              const newVideos = pendingVideoCards.filter(v => !existingIds.has(v.id));
              return [...newVideos, ...prev];
            });
            
            // Iniciar polling para cada vídeo pendente (EXCETO 2.0)
            data.videos.forEach((v: { id: string; model: string }) => {
              // ⚠️ Buua 2.0 não precisa de polling (retorna vídeo pronto imediatamente)
              const isBuua2Video = v.model?.includes('veo-') || v.model?.includes('Veo') || v.model?.includes('Buua 2.0');
              if (!isBuua2Video) {
                startPolling(v.id, 'async');
              } else {
                console.log('⏭️ Pulando polling para vídeo Buua 2.0:', v.id);
              }
            });
          } else {
            console.log('✅ Nenhum vídeo pendente');
          }
        } catch (error) {
          console.error('❌ Erro ao verificar vídeos pendentes:', error);
        }
      };

      checkPendingVideos();
    }, [isMounted]);

    // Salvar no localStorage
    useEffect(() => {
      if (prompt) localStorage.setItem('videoGeneratorPrompt', prompt);
    }, [prompt]);

    useEffect(() => {
      localStorage.setItem('videoGeneratorModel', selectedModel.id);
    }, [selectedModel]);

    // ⭐ Fechar dropdown ao clicar fora
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
          setIsVersionDropdownOpen(false);
        }
        if (orientationDropdownRef.current && !orientationDropdownRef.current.contains(event.target as Node)) {
          setIsOrientationDropdownOpen(false);
        }
      };

      if (isVersionDropdownOpen || isOrientationDropdownOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isVersionDropdownOpen, isOrientationDropdownOpen]);

    // Scroll
    useEffect(() => {
      const handleScroll = () => {
        if (!scrollContainerRef.current) return;

        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;

        // Minimizar ao rolar para baixo (após 100px)
        if (scrollTop > lastScrollY && scrollTop > 100) {
          setIsChatMinimized(true);
        }
        // REMOVIDO: Não expande automaticamente ao scrollar para cima
        // O usuário precisa clicar para expandir
        setLastScrollY(scrollTop);

        // Carregar mais vídeos quando chegar perto do final
        if (scrollHeight - scrollTop - clientHeight < 500) {
          setVisibleVideosCount((prev) => Math.min(prev + 12, videos.length));
        }
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }, [videos.length, lastScrollY]);

    // Histórico
    const loadHistory = useCallback(async () => {
      setIsLoadingHistory(true);
      try {
        const response = await fetch('/api/generate-video/history');
        if (response.ok) {
          const data = await response.json();
          const allVideos = data.videos || [];
          
          // Separar vídeos completos e em processamento
          const completedVideos = allVideos
            .filter((v: { status: string; video_url: string }) => v.status === 'completed' && v.video_url)
            .map((v: { id: string; video_url: string; prompt: string; created_at: string; seconds: number; size: string; model: string }) => ({
              id: v.id,
              videoUrl: v.video_url,
              prompt: v.prompt,
              createdAt: v.created_at,
              seconds: v.seconds,
              size: v.size,
              model: v.model,
              isLoading: false,
            }))
            .sort((a: GeneratedVideo, b: GeneratedVideo) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // ⭐ ORDENAR: mais recente primeiro

          const processingVideos = allVideos
            .filter((v: { status: string }) => v.status === 'processing')
            .map((v: { id: string; prompt: string; created_at: string; seconds: number; size: string; model: string }) => ({
              id: v.id,
              videoUrl: '',
              prompt: v.prompt,
              createdAt: v.created_at,
              seconds: v.seconds,
              size: v.size,
              model: v.model,
              isLoading: true,
            }))
            .sort((a: GeneratedVideo, b: GeneratedVideo) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // ⭐ ORDENAR: mais recente primeiro

          // Combinar: processing primeiro (no topo), depois completed (ambos já ordenados)
          setVideos([...processingVideos, ...completedVideos]);

          // Adicionar tarefas de processamento ao polling (EXCETO 2.0)
          const processingTasks = allVideos
            .filter((v: { status: string; job_id: string; model: string }) => {
              // Buua 2.0 não precisa de polling (retorna vídeo pronto)
              const isBuua2Video = v.model?.includes('veo-') || v.model?.includes('Veo') || v.model?.includes('Buua 2.0');
              return v.status === 'processing' && v.job_id && !isBuua2Video;
            })
            .map((v: { job_id: string; id: string }) => ({
              jobId: v.job_id,
              generationId: v.id,
              status: 'processing' as const,
              placeholderIds: [v.id],
            }));

          if (processingTasks.length > 0) {
            setActiveTasks(processingTasks);
            console.log('🔄 Retomando polling para', processingTasks.length, 'vídeo(s)');
          }
        }
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    }, []);

    useEffect(() => {
      loadHistory();
    }, [loadHistory]);

    // ==================== POLLING ANTIGO (DESABILITADO) ====================
    // NOTA: Este polling era usado para OpenAI, agora usamos startPolling() para LaoZhang
    // Mantido comentado para referência, mas não é mais usado
    // =======================================================================
    
    // Polling antigo (OpenAI) - DESABILITADO
    const pollTaskStatus = useCallback(
      async () => {
        console.warn('⚠️ pollTaskStatus() chamado mas está DESABILITADO. Use startPolling() ao invés.');
        return; // Não faz nada
      },
      []
    );

    // useEffect para activeTasks - DESABILITADO
    useEffect(() => {
      // Polling antigo desabilitado - agora usamos startPolling()
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, [activeTasks, pollTaskStatus]);

    // Função auxiliar para comprimir imagem
    const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            // Criar canvas para redimensionar
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Redimensionar se for muito grande (máximo 1024px no lado maior)
            const maxDimension = 1024;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = (height / width) * maxDimension;
                width = maxDimension;
              } else {
                width = (width / height) * maxDimension;
                height = maxDimension;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Converter para Base64 com qualidade 0.85
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            resolve(compressedBase64);
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    };

    // Upload de imagem COM COMPRESSÃO
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        Swal.fire({
          icon: 'error',
          title: 'Formato inválido',
          text: 'Apenas imagens JPG e PNG são suportadas.',
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Arquivo muito grande',
          text: 'O tamanho máximo é 10MB.',
        });
        return;
      }

      try {
        // ⭐ Mostrar loading
        Swal.fire({
          title: 'Processando imagem...',
          text: 'Comprimindo e otimizando...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        // ⭐ Comprimir imagem
        const compressedBase64 = await compressImage(file);
        
        console.log('✅ Imagem comprimida:', {
          originalSize: `${(file.size / 1024).toFixed(2)} KB`,
          compressedSize: `${(compressedBase64.length / 1024).toFixed(2)} KB`,
          reduction: `${(((file.size - compressedBase64.length) / file.size) * 100).toFixed(1)}%`,
        });
        
        setUploadedImage(compressedBase64);
        
        Swal.close();
      } catch (error) {
        console.error('Erro ao processar imagem:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erro ao processar',
          text: 'Não foi possível processar a imagem. Tente outra.',
        });
      }
    };

    // Melhorar prompt
    const handleImprovePrompt = async () => {
      if (!prompt.trim() || isImprovingPrompt) {
        return;
      }

      setIsImprovingPrompt(true);

      try {
        const response = await fetch('/api/text/improve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: prompt.trim(),
            mode: 'improve',
            contentType: 'video-prompt', // Tipo específico para prompts de vídeo
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erro ao melhorar prompt');
        }

        // Atualizar o prompt com a versão melhorada (silenciosamente)
        setPrompt(data.improvedText);
      } catch (error) {
        console.error('Erro ao melhorar prompt:', error);
        // Apenas log, sem modal de erro
      } finally {
        setIsImprovingPrompt(false);
      }
    };

    // Gerar
    const handleGenerate = async () => {
      if (!prompt.trim()) {
        Swal.fire({
          icon: 'error',
          title: 'Prompt vazio',
          text: 'Por favor, descreva o vídeo que você quer criar.',
        });
        return;
      }

      // ⚡ LIMITE DE GERAÇÕES SIMULTÂNEAS: Verificar vídeos em processamento (loading)
      const processingCount = videos.filter(v => v.isLoading).length;
      const SIMULTANEOUS_LIMIT = 3; // Máximo 2 vídeos por vez

      if (processingCount >= SIMULTANEOUS_LIMIT) {
        Swal.fire({
          icon: 'warning',
          title: 'Limite de gerações simultâneas',
          html: `
            <p>Você já tem <strong>${processingCount}</strong> vídeos sendo gerados simultaneamente.</p>
            <p class="text-sm text-gray-600 mt-2">Aguarde a conclusão de pelo menos um para iniciar nova geração.</p>
            <p class="text-xs text-gray-500 mt-1">Máximo: 2 vídeos por vez</p>
          `,
          confirmButtonText: 'OK, entendi',
        });
        return;
      }

      console.log('📊 Limite de gerações simultâneas:', {
        processing: processingCount,
        limit: SIMULTANEOUS_LIMIT,
        allowed: processingCount < SIMULTANEOUS_LIMIT,
      });

      const creditsNeeded = selectedVersion === '2.0' 
        ? 35 // Buua 2.0 High: $0.25 = 35 créditos
        : getCreditsForConfig(selectedModel, isHighQuality); // Buua 1.0: 21 ou 56 créditos
      
      const totalCredits = profile.credits + profile.extraCredits;

      if (totalCredits < creditsNeeded) {
        Swal.fire({
          icon: 'error',
          title: 'Créditos insuficientes',
          text: `Você precisa de ${creditsNeeded} créditos.`,
        });
        return;
      }

      setIsGenerating(true);

      try {
        // ==================== VERSÃO 2.0 (BUUA HIGH) ====================
        if (selectedVersion === '2.0') {
          console.log('🎬 Iniciando geração Buua 2.0 High');
          
          // Determinar modelo baseado na orientação selecionada
          const veoModel = selectedVeoModel.veoModel || 'veo-3.1-landscape';
          
          console.log('📊 Configuração Buua 2.0:', {
            model: veoModel,
            orientation: selectedVeoModel.orientation,
            duration: 8, // ⭐ FIXO
            size: selectedVeoModel.fixedSize,
          });
          
          // ⭐ CRIAR CARD COM LOADING IMEDIATAMENTE
          const placeholderId = `buua-temp-${Date.now()}`;
          const placeholderVideo: GeneratedVideo = {
            id: placeholderId,
            videoUrl: '',
            prompt: prompt.trim(),
            createdAt: new Date().toISOString(),
            isLoading: true, // ⭐ Com loading
            seconds: 8,
            size: selectedVeoModel.fixedSize,
            model: `Buua 2.0 High ${selectedVeoModel.orientation === 'portrait' ? '9:16' : '16:9'}`,
          };
          
          console.log('📹 Criando card placeholder:', placeholderVideo);
          setVideos((prev) => [placeholderVideo, ...prev]);
          
          // ⭐ LIMPAR PROMPT E IMAGEM IMEDIATAMENTE
          const savedPrompt = prompt.trim();
          const savedImage = uploadedImage;
          setPrompt('');
          setUploadedImage(null);
          
          // ⭐ LIBERAR CHAT IMEDIATAMENTE
          setIsGenerating(false);
          console.log('✅ Chat liberado - usuário pode continuar');
          
          // Fazer a requisição em background e iniciar polling
          (async () => {
            try {
              const response = await fetch('/api/generate-video/veo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  prompt: savedPrompt,
                  imageBase64: savedImage || undefined,
                  model: veoModel,
                }),
              });

              const data = await response.json();
              console.log('📦 Dados recebidos:', data);

              if (!response.ok) {
                // Remover card de loading se der erro
                setVideos((prev) => prev.filter((v) => v.id !== placeholderId));
                
                // Verificar se é erro de limite diário
                if (data.limit && data.used !== undefined) {
                  Swal.fire({
                    icon: 'warning',
                    title: '🔒 Limite Diário Atingido',
                    html: `
                      <div class="text-left space-y-4">
                        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <p class="text-sm text-amber-800 font-medium">📊 Plano FREE: ${data.used}/${data.limit} vídeos criados hoje</p>
                          <p class="text-xs text-amber-700 mt-2">
                            Você atingiu o limite diário de gerações gratuitas.
                          </p>
                        </div>
                        
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p class="text-sm text-blue-900 font-semibold mb-2">💎 Com o Plano Premium:</p>
                          <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
                            <li>Vídeos ilimitados por dia</li>
                            <li>Acesso prioritário aos servidores</li>
                            <li>Gerações mais rápidas</li>
                            <li>Suporte prioritário</li>
                          </ul>
                        </div>

                        <p class="text-xs text-gray-500 italic">
                          ℹ️ A cota é renovada às 00:00 (meia-noite).
                          Deletar vídeos não recupera a cota do dia.
                        </p>
                      </div>
                    `,
                    confirmButtonText: '✨ Ver Planos',
                    showCancelButton: true,
                    cancelButtonText: 'Voltar',
                    confirmButtonColor: '#10b981',
                    cancelButtonColor: '#6b7280',
                  }).then((result) => {
                    if (result.isConfirmed) {
                      // Redirecionar para página de planos
                      window.location.href = '/upgrade';
                    }
                  });
                  return; // Não lançar erro, já mostramos o modal
                }
                
                throw new Error(data.error || 'Erro ao gerar vídeo');
              }

              // ⭐ ATUALIZAR ID DO PLACEHOLDER COM ID REAL
              const realId = data.generationId;
              setVideos((prev) =>
                prev.map((video) =>
                  video.id === placeholderId
                    ? { ...video, id: realId }
                    : video
                )
              );
              
              setProfile((prev) => ({
                ...prev,
                credits: data.newCredits || prev.credits,
                extraCredits: data.newExtraCredits || prev.extraCredits,
              }));

              console.log('✅ Vídeo criado no banco:', realId);
              console.log('🔄 Iniciando polling para Buua 2.0...');
              
              // ⭐ INICIAR POLLING para verificar quando o vídeo ficar pronto
              startPollingBuua2(realId);

            } catch (error) {
              console.error('❌ Erro ao gerar vídeo:', error);
              
              // Remover card de loading se der erro
              setVideos((prev) => prev.filter((v) => v.id !== placeholderId));
              
              Swal.fire({
                icon: 'error',
                title: 'Erro ao gerar vídeo',
                text: error instanceof Error ? error.message : 'Erro desconhecido',
              });
            }
          })();

          return;
        }

        // ==================== VERSÃO 1.0 (BUUA LEGADO) ====================
        // Mapear para o modelo correto
        let apiEndpoint = '/api/generate-video/v3-async'; // ⭐ API Assíncrona (retorna imediatamente)
        let apiModel = '';
        let apiType: 'sync' | 'async' = 'async';
        
        if (isHighQuality) {
          // HIGH Quality usa API ASSÍNCRONA (suporta tamanho 1024x1792)
          apiEndpoint = '/api/generate-video/v3-async';
          apiModel = 'sora-2-pro-all'; // Configuração customizada (1024x1792, 15s)
          apiType = 'async'; // ⚡ MUDOU DE SYNC PARA ASYNC
        } else if (selectedModel.id === 'buua-retrato') {
          // Retrato usa async (retorna taskId e faz polling + worker backend)
          apiModel = 'sora_video2-15s';
        } else {
          // Paisagem usa async (retorna taskId e faz polling + worker backend)
          apiModel = 'sora_video2-landscape-15s';
        }

        console.log('🎬 Iniciando geração:', { 
          apiEndpoint, 
          apiModel, 
          model: selectedModel.name,
          isHighQuality,
          apiType,
          flow: 'Card+Loading → Worker Backend (async)' // Todos usam async agora
        });

        const requestBody = {
          prompt: prompt.trim(),
          imageBase64: uploadedImage || undefined,
          model: apiModel,
        };
        
        console.log('📤 Enviando requisição:', requestBody);
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        console.log('📡 Resposta da API:', response.status, response.statusText);

        const data = await response.json();
        console.log('📦 Dados recebidos:', data);

        if (!response.ok) {
          setIsGenerating(false);
          
          // Verificar se é erro de limite diário
          if (data.limit && data.used !== undefined) {
            Swal.fire({
              icon: 'warning',
              title: '🔒 Limite Diário Atingido',
              html: `
                <div class="text-left space-y-4">
                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p class="text-sm text-amber-800 font-medium">📊 Plano FREE: ${data.used}/${data.limit} vídeos criados hoje</p>
                    <p class="text-xs text-amber-700 mt-2">
                      Você atingiu o limite diário de gerações gratuitas.
                    </p>
                  </div>
                  
                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-sm text-blue-900 font-semibold mb-2">💎 Com o Plano Premium:</p>
                    <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Vídeos ilimitados por dia</li>
                      <li>Acesso prioritário aos servidores</li>
                      <li>Gerações mais rápidas</li>
                      <li>Suporte prioritário</li>
                    </ul>
                  </div>

                  <p class="text-xs text-gray-500 italic">
                    ℹ️ A cota é renovada às 00:00 (meia-noite).
                    Deletar vídeos não recupera a cota do dia.
                  </p>
                </div>
              `,
              confirmButtonText: '✨ Ver Planos',
              showCancelButton: true,
              cancelButtonText: 'Voltar',
              confirmButtonColor: '#10b981',
              cancelButtonColor: '#6b7280',
            }).then((result) => {
              if (result.isConfirmed) {
                // Redirecionar para página de planos
                window.location.href = '/upgrade';
              }
            });
            return; // Não lançar erro, já mostramos o modal
          }
          
          throw new Error(data.error || 'Erro ao gerar vídeo');
        }

        // Verificar se generationId existe
        if (!data.generationId) {
          console.error('❌ generationId não encontrado na resposta:', data);
          setIsGenerating(false);
          throw new Error('Resposta inválida da API: generationId não encontrado');
        }

        console.log('✅ generationId recebido:', data.generationId);

        // Criar card imediatamente com loading
        const placeholderVideo: GeneratedVideo = {
          id: data.generationId,
          videoUrl: '',
          prompt: prompt.trim(),
          createdAt: new Date().toISOString(),
          isLoading: true,
          seconds: 15,
          size: isHighQuality ? '1024x1792' : selectedModel.fixedSize,
          model: isHighQuality ? 'Buua 1.0 High' : selectedModel.name,
        };
        
        console.log('📹 Criando card placeholder:', placeholderVideo);
        setVideos((prev) => [placeholderVideo, ...prev]);
        
        setProfile((prev) => ({
          ...prev,
          credits: data.newCredits || prev.credits,
          extraCredits: data.newExtraCredits || prev.extraCredits,
        }));

        setPrompt('');
        setUploadedImage(null);

        // Liberar chat imediatamente
        setIsGenerating(false);
        console.log('✅ Chat liberado');

        // Iniciar polling para verificar quando o vídeo está pronto
        console.log('🔄 Iniciando polling para:', data.generationId);
        startPolling(data.generationId, isHighQuality ? 'sync' : 'async');

      } catch (error: unknown) {
        console.error('❌ Erro ao gerar vídeo:', error);
        
        const errorMessage = error instanceof Error ? error.message : '';
        const isSafetyError = errorMessage.includes('safety') || 
                            errorMessage.includes('rejected') ||
                            errorMessage.includes('policy');

        Swal.fire({
          icon: 'error',
          title: 'Erro ao gerar vídeo',
          text: isSafetyError 
            ? 'Não foi possível gerar o vídeo. Tente ajustar sua descrição.'
            : (error instanceof Error ? error.message : 'Erro desconhecido'),
        });
        
        setIsGenerating(false);
      }
    };

    // Polling para verificar se o vídeo está pronto (Sync ou Async)
    const startPolling = (generationId: string, apiType: 'sync' | 'async' = 'async') => {
      const endpoint = apiType === 'sync' 
        ? `/api/generate-video/status?id=${generationId}`
        : `/api/generate-video/status-async?id=${generationId}`;
      
      const pollIntervalTime = apiType === 'sync' ? 3000 : 5000; // 3s para sync, 5s para async
      
      console.log(`🔄 Iniciando polling ${apiType} para:`, generationId, `(verificando a cada ${pollIntervalTime/1000}s)`);
      
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(endpoint);
          const data = await response.json();

          console.log('📊 Status atual:', data);

          if (data.status === 'completed' && data.videoUrl) {
            // Atualizar o card com o vídeo pronto
            setVideos((prev) => 
              prev.map((video) => 
                video.id === generationId
                  ? { ...video, videoUrl: data.videoUrl, isLoading: false }
                  : video
              )
            );
            
            clearInterval(pollInterval);
            
            // Modal de notificação removido conforme solicitado
          } else if (data.status === 'failed') {
            // Remover card se falhou
            setVideos((prev) => prev.filter((video) => video.id !== generationId));
            clearInterval(pollInterval);
            
            Swal.fire({
              title: '❌ Erro',
              text: data.message || 'Não foi possível gerar o vídeo. Seus créditos foram reembolsados.',
              icon: 'error',
            });
          }
          // Se ainda está processing, continuar esperando
        } catch (error) {
          console.error('Erro no polling:', error);
        }
      }, pollIntervalTime);

      // Limpar após 10 minutos (timeout)
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 600000);
    };

    // ⭐ Polling específico para Buua 2.0 (verifica direto no banco)
    const startPollingBuua2 = (generationId: string) => {
      const pollIntervalTime = 5000; // 5s
      
      console.log(`🔄 Iniciando polling Buua 2.0 para:`, generationId, `(verificando a cada ${pollIntervalTime/1000}s)`);
      
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/generate-video/status-async?id=${generationId}`);
          const data = await response.json();

          console.log('📊 Status Buua 2.0:', data);

          if (data.status === 'completed' && data.videoUrl) {
            // ⭐ Vídeo pronto! Atualizar o card
            setVideos((prev) => 
              prev.map((video) => 
                video.id === generationId
                  ? { ...video, videoUrl: data.videoUrl, isLoading: false }
                  : video
              )
            );
            
            clearInterval(pollInterval);
            
            // Modal de notificação removido conforme solicitado
          } else if (data.status === 'failed') {
            // Vídeo falhou - remover card
            setVideos((prev) => prev.filter((video) => video.id !== generationId));
            clearInterval(pollInterval);
            
            Swal.fire({
              title: '❌ Erro',
              text: data.message || 'Não foi possível gerar o vídeo. Seus créditos foram reembolsados.',
              icon: 'error',
            });
          }
          // Se ainda está processing, continuar esperando
        } catch (error) {
          console.error('Erro no polling Buua 2.0:', error);
        }
      }, pollIntervalTime);

      // Limpar após 10 minutos (timeout)
      setTimeout(() => {
        clearInterval(pollInterval);
        console.log('⏰ Timeout polling Buua 2.0 - 10min');
      }, 600000);
    };

    // Deletar
    const handleDelete = async (id: string) => {
      const result = await Swal.fire({
        title: 'Deletar vídeo?',
        text: 'Esta ação não pode ser desfeita.',
        showCancelButton: true,
        confirmButtonText: 'Sim, deletar',
        cancelButtonText: 'Cancelar',
      });

      if (!result.isConfirmed) return;

      try {
        const response = await fetch(`/api/generate-video/delete?id=${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setVideos((prev) => prev.filter((v) => v.id !== id));
          Swal.fire('Deletado!', 'O vídeo foi removido.', 'success');
        }
      } catch (error) {
        console.error('Erro ao deletar:', error);
        Swal.fire('Erro', 'Não foi possível deletar o vídeo.', 'error');
      }
    };

    // Download de vídeo
    const handleDownload = async (videoUrl: string, videoId: string) => {
      try {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `video-${videoId}.mp4`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Erro ao baixar vídeo:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erro ao baixar',
          text: 'Não foi possível baixar o vídeo.',
        });
      }
    };

    // Função removida: handleUseAsReference (vídeo como referência desabilitado)

    const visibleVideos = videos.slice(0, visibleVideosCount);

    // Agrupar por data
    const videoGroups = visibleVideos.reduce((groups, video) => {
      // Validar e criar data
      const date = new Date(video.createdAt);
      
      // Se data inválida, usar data atual e adicionar mesmo assim
      let dateKey: string;
      if (isNaN(date.getTime())) {
        console.warn('Data inválida para vídeo:', video.id, video.createdAt);
        dateKey = new Date().toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'long',
        });
      } else {
        // Sempre mostrar a data formatada (ex: "17 de novembro")
        dateKey = date.toLocaleDateString('pt-BR', {
          day: 'numeric',
          month: 'long',
        });
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(video);
      return groups;
    }, {} as Record<string, GeneratedVideo[]>);

    return (
      <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
        <WelcomeModal isOpen={showWelcomeModal} onClose={handleCloseModal} />
        <div ref={scrollContainerRef} className="relative min-h-screen space-y-6 pb-64 lg:space-y-8">
          {/* Galeria */}
          {videos.length > 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:shadow-3xl lg:p-8">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-400/20 to-green-400/20 blur-3xl" />
              <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 blur-3xl" />
              
              <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">Meus Vídeos</h2>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {videos.filter(v => !v.isLoading).length} {videos.filter(v => !v.isLoading).length === 1 ? 'vídeo' : 'vídeos'}
                    </span>
                  </div>
                </div>

                {Object.entries(videoGroups).map(([dateKey, groupVideos]) => (
                  <div key={dateKey} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-2 shadow-sm">
                        <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-semibold text-emerald-900">{dateKey}</span>
                        <span className="ml-1 text-xs text-emerald-600">({groupVideos.length})</span>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent"></div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                      {groupVideos.map((video) => (
                        <div
                          key={video.id}
                          className="group relative aspect-video overflow-hidden rounded-xl border border-gray-200 bg-gray-900 shadow-sm transition-all hover:shadow-lg hover:border-emerald-300"
                        >
                          {video.isLoading ? (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                              <div className="text-center">
                                <div className="relative mx-auto mb-2 h-12 w-12">
                                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75"></div>
                                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600">
                                    <svg className="h-6 w-6 animate-spin text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </div>
                                </div>
                                <p className="text-xs font-medium text-gray-600">Gerando...</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => setSelectedVideo(video)} className="relative h-full w-full">
                                <video src={video.videoUrl} className="h-full w-full object-cover" muted loop />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                                    <svg className="h-6 w-6 text-gray-900 ml-1" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </div>
                                </div>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(video.id);
                                }}
                                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
                                title="Deletar vídeo"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(video.videoUrl, video.id);
                                }}
                                className="absolute right-11 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/90 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-emerald-600"
                                title="Baixar vídeo"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>

                              <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                                {video.seconds}s • {
                                  video.model.includes('veo-') || video.model.includes('Veo') || video.model.includes('Buua 2.0') || video.model.includes('Buua High')
                                    ? '2.0 Buua High'
                                    : video.model === 'sora-2-pro-all' || video.model.includes('High')
                                      ? '1.0 High' 
                                      : '1.0 Buua Legado'
                                }
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shimmer/Skeleton para loading inicial do histórico */}
          {isLoadingHistory && videos.length === 0 && (
            <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 shadow-2xl lg:p-8">
              <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-32 animate-pulse rounded-lg bg-gray-200"></div>
                    <div className="h-6 w-20 animate-pulse rounded-full bg-emerald-100"></div>
                  </div>
                  <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200"></div>
                </div>

                {/* Skeleton Grid - 3 colunas */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-40 animate-pulse rounded-full bg-gradient-to-r from-emerald-50 to-green-50"></div>
                    <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="group relative overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200"
                        style={{ aspectRatio: '16/9' }}
                      >
                        <div className="flex h-full w-full items-center justify-center">
                          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/30 to-transparent shimmer"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vazio */}
          {videos.length === 0 && !isLoadingHistory && (
            <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 shadow-2xl lg:p-8">
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-4 text-sm text-gray-500">
                    Nenhum vídeo gerado ainda. Descreva o que você quer criar abaixo!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat */}
        {!isLoadingHistory && (
          <div 
            className={`fixed bottom-0 left-0 right-0 z-50 mb-4 sm:mb-6 md:mb-8 flex justify-center px-2 sm:px-4 md:px-6 transition-all duration-300 lg:left-56 lg:px-8 ${
              isChatMinimized ? 'translate-y-[calc(100%-60px)] sm:translate-y-[calc(100%-70px)] scale-95' : 'translate-y-0 scale-100'
            }`}
            onClick={() => {
              if (isChatMinimized) {
                setIsChatMinimized(false);
              }
            }}
          >
            <div className={`w-full max-w-4xl rounded-2xl sm:rounded-3xl border border-gray-200/50 bg-white/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
              isChatMinimized ? 'p-2 sm:p-3 cursor-pointer hover:shadow-3xl' : 'p-2 sm:p-3 md:p-4'
            }`}>
              {/* Botão de minimizar/expandir - sempre visível no topo */}
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600">
                    <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700">Criar novo vídeo</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsChatMinimized(!isChatMinimized);
                  }}
                  className="flex items-center justify-center rounded-full p-1 sm:p-1.5 transition-all hover:bg-gray-100 active:scale-95"
                  title={isChatMinimized ? 'Expandir chat' : 'Minimizar chat'}
                >
                  <svg 
                    className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-500 transition-transform duration-300 ${isChatMinimized ? 'animate-bounce' : 'rotate-180'}`}
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth={2} 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              </div>

              <div className={`space-y-2 transition-all duration-300 ${
                isChatMinimized ? 'hidden' : 'sm:space-y-3'
              }`}>
                {/* Conteúdo completo quando expandido */}
                {!isChatMinimized && (
                  <>
                {/* Linha de Controles: Upload de Imagem + Seletor de Versão */}
                <div className="flex items-center justify-between gap-3">

                  {/* Upload de Imagem */}
                  <div className="flex items-center gap-2">
                    {uploadedImage ? (
                      <div className="flex items-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50/80 px-2 py-1.5 sm:px-3 sm:py-2">
                        {/* Preview Mini */}
                        <div className="relative h-6 w-6 sm:h-7 sm:w-7 overflow-hidden rounded-md border border-emerald-300">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={uploadedImage}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-emerald-700 sm:text-xs">Imagem</span>
                        <button
                          onClick={() => setUploadedImage(null)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                          title="Remover imagem"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <label 
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-white/70 px-2 py-1.5 transition-all hover:border-emerald-400 hover:bg-emerald-50/80 sm:gap-2 sm:px-3 sm:py-2"
                        title="Adicionar imagem de referência (use fotos reais, não avatares de IA)"
                      >
                        <svg className="h-4 w-4 text-gray-600 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] font-medium text-gray-600 sm:text-xs">Imagem</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Seletor de Versão */}
                  <div className="relative" ref={versionDropdownRef}>
                    <button
                      onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                      disabled={isGenerating}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-emerald-600">
                        {selectedVersion} {selectedVersion === '1.0' ? 'Buua Legado' : 'Buua High'}
                      </span>
                      <svg 
                        className={`h-3 w-3 text-gray-500 transition-transform ${isVersionDropdownOpen ? '' : 'rotate-180'}`} 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth={2} 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {/* Dropdown (abre para cima) */}
                    {isVersionDropdownOpen && (
                    <div className="absolute bottom-full right-0 mb-1 w-full min-w-[200px] rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg z-10">
                      <button
                        onClick={() => {
                          setSelectedVersion('1.0');
                          setIsVersionDropdownOpen(false);
                        }}
                        disabled={isGenerating}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          selectedVersion === '1.0'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold">1.0 Buua Legado</div>
                          <div className="text-[10px] text-gray-500">Standard - 15s</div>
                        </div>
                        {selectedVersion === '1.0' && (
                          <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVersion('2.0');
                          setIsVersionDropdownOpen(false);
                        }}
                        disabled={isGenerating}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          selectedVersion === '2.0'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-semibold">2.0 Buua High</div>
                          <div className="text-[10px] text-gray-500">High Quality - 8s</div>
                        </div>
                        {selectedVersion === '2.0' && (
                          <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                    )}
                  </div>
                </div>

                {/* Dicas de Uso quando há imagem - DIFERENTE POR VERSÃO */}
                {uploadedImage && selectedVersion === '1.0' && (
                  <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <button
                          onClick={() => setIsImageWarningExpanded(!isImageWarningExpanded)}
                          className="flex items-center justify-between w-full text-left group"
                        >
                          <h3 className="text-xs font-bold text-amber-900 sm:text-sm">
                            ⚠️ Buua 1.0 - Limitações de Animação
                          </h3>
                          <svg 
                            className={`h-4 w-4 text-amber-700 transition-transform flex-shrink-0 ${isImageWarningExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth={2} 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isImageWarningExpanded && (
                          <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-[10px] text-amber-800 sm:text-xs font-semibold">
                              ❌ NÃO pode animar:
                            </p>
                            <ul className="text-[10px] text-amber-700 sm:text-xs space-y-1 ml-4 list-disc">
                              <li>Pessoas (fotos reais)</li>
                              <li>Imagens geradas por IA</li>
                              <li>Crianças</li>
                            </ul>
                            <p className="text-[10px] text-amber-800 sm:text-xs font-semibold mt-2">
                              ✅ Pode animar apenas:
                            </p>
                            <ul className="text-[10px] text-amber-700 sm:text-xs space-y-1 ml-4 list-disc">
                              <li>Desenhos e ilustrações</li>
                              <li>Arte digital</li>
                              <li>Personagens animados</li>
                            </ul>
                            <div className="mt-3 rounded-lg bg-blue-100 border border-blue-300 p-2">
                              <p className="text-[9px] text-blue-800 sm:text-[10px] font-medium">
                                💎 <strong>Buua 2.0 High</strong> permite animar pessoas e imagens IA!
                              </p>
                              <button
                                onClick={() => setSelectedVersion('2.0')}
                                className="mt-1.5 text-[9px] font-semibold text-blue-700 underline hover:text-blue-900 sm:text-[10px]"
                              >
                                → Mudar para Buua 2.0 High
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {uploadedImage && selectedVersion === '2.0' && (
                  <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <button
                          onClick={() => setIsImageWarningExpanded(!isImageWarningExpanded)}
                          className="flex items-center justify-between w-full text-left group"
                        >
                          <h3 className="text-xs font-bold text-purple-900 sm:text-sm">
                            💡 Modo Animação - Buua 2.0 High
                          </h3>
                          <svg 
                            className={`h-4 w-4 text-purple-700 transition-transform flex-shrink-0 ${isImageWarningExpanded ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth={2} 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isImageWarningExpanded && (
                          <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <p className="text-[10px] text-purple-700 sm:text-xs">
                              Sua imagem será animada. Descreva os movimentos desejados.
                            </p>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              <button
                                onClick={() => setPrompt('person speaking and gesturing naturally')}
                                className="rounded-full bg-purple-100 px-2 py-1 text-[9px] font-medium text-purple-700 hover:bg-purple-200 transition-colors sm:px-3 sm:text-[10px]"
                              >
                                🗣️ Falando
                              </button>
                              <button
                                onClick={() => setPrompt('person smiling and waving')}
                                className="rounded-full bg-purple-100 px-2 py-1 text-[9px] font-medium text-purple-700 hover:bg-purple-200 transition-colors sm:px-3 sm:text-[10px]"
                              >
                                👋 Acenando
                              </button>
                              <button
                                onClick={() => setPrompt('subtle head and body movements')}
                                className="rounded-full bg-purple-100 px-2 py-1 text-[9px] font-medium text-purple-700 hover:bg-purple-200 transition-colors sm:px-3 sm:text-[10px]"
                              >
                                ↔️ Movimentos sutis
                              </button>
                            </div>
                            <p className="text-[9px] text-purple-700 sm:text-[10px] font-semibold mt-2">
                              ✅ Pode animar:
                            </p>
                            <ul className="text-[9px] text-purple-600 sm:text-[10px] space-y-1 ml-4 list-disc">
                              <li>Pessoas (fotos reais)</li>
                              <li>Imagens geradas por IA</li>
                              <li>Desenhos e ilustrações</li>
                            </ul>
                            <div className="mt-2 rounded-lg bg-red-100 border border-red-300 p-2">
                              <p className="text-[9px] text-red-800 sm:text-[10px] font-medium">
                                ⚠️ <strong>Proibido:</strong> Animação de crianças
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Campo de Texto */}
                <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => {
                      if (e.target.value.length <= 1000) {
                        setPrompt(e.target.value);
                      }
                    }}
                    placeholder="Descreva o vídeo que você quer criar..."
                    rows={isChatMinimized ? 4 : 6}
                    className="w-full resize-none rounded-2xl border-2 border-gray-200/50 bg-white/70 py-2.5 px-3 text-xs text-gray-900 placeholder-gray-500 backdrop-blur-md transition-all focus:border-emerald-500 focus:bg-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:py-3 sm:px-4 sm:text-sm"
                    disabled={isGenerating}
                  />

                  {/* Linha de controles: Orientação + Duração + High + Melhorar */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-gray-500 sm:text-xs">
                      <span className={prompt.length >= 1000 ? 'font-semibold text-red-500' : 'font-medium'}>
                        {prompt.length}/1000
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Orientação: 9:16 ou 16:9 (apenas na v1.0) - DROPDOWN */}
                      {selectedVersion === '1.0' && (
                      <div className="relative" ref={orientationDropdownRef}>
                        <button
                          onClick={() => setIsOrientationDropdownOpen(!isOrientationDropdownOpen)}
                          disabled={isGenerating || isHighQuality}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="h-4 w-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            {selectedModel.orientation === 'portrait' ? (
                              <rect x="8" y="3" width="8" height="18" rx="1" />
                            ) : (
                              <rect x="3" y="8" width="18" height="8" rx="1" />
                            )}
                          </svg>
                          <span className="text-gray-700">
                            {selectedModel.orientation === 'portrait' ? '9:16' : '16:9'}
                          </span>
                          <svg 
                            className={`h-3 w-3 text-gray-500 transition-transform ${isOrientationDropdownOpen ? '' : 'rotate-180'}`} 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth={2} 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Dropdown Orientação (abre para cima) */}
                        {isOrientationDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-1 w-full min-w-[160px] rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg z-10">
                          <button
                            onClick={() => {
                              setSelectedModel(MODEL_CONFIGS[0]); // Retrato
                              setIsOrientationDropdownOpen(false);
                            }}
                            disabled={isGenerating || isHighQuality}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                              selectedModel.orientation === 'portrait'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            } ${isHighQuality ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <rect x="8" y="3" width="8" height="18" rx="1" />
                            </svg>
                            <div className="flex-1">
                              <div className="font-semibold">9:16</div>
                              <div className="text-[10px] text-gray-500">Retrato</div>
                            </div>
                            {selectedModel.orientation === 'portrait' && (
                              <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedModel(MODEL_CONFIGS[1]); // Paisagem
                              setIsOrientationDropdownOpen(false);
                            }}
                            disabled={isGenerating || isHighQuality}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                              selectedModel.orientation === 'landscape'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            } ${isHighQuality ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <rect x="3" y="8" width="18" height="8" rx="1" />
                            </svg>
                            <div className="flex-1">
                              <div className="font-semibold">16:9</div>
                              <div className="text-[10px] text-gray-500">Paisagem</div>
                            </div>
                            {selectedModel.orientation === 'landscape' && (
                              <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                        )}
                      </div>
                      )}

                      {/* ========== BUUA 2.0 CONTROLES ========== */}
                      {/* Orientação: 9:16 ou 16:9 (versão 2.0) - DROPDOWN */}
                      {selectedVersion === '2.0' && (
                      <div className="relative" ref={orientationDropdownRef}>
                        <button
                          onClick={() => setIsOrientationDropdownOpen(!isOrientationDropdownOpen)}
                          disabled={isGenerating}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold shadow-sm transition-all hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="h-4 w-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            {selectedVeoModel.orientation === 'portrait' ? (
                              <rect x="8" y="3" width="8" height="18" rx="1" />
                            ) : (
                              <rect x="3" y="8" width="18" height="8" rx="1" />
                            )}
                          </svg>
                          <span className="text-gray-700">
                            {selectedVeoModel.orientation === 'portrait' ? '9:16' : '16:9'}
                          </span>
                          <svg 
                            className={`h-3 w-3 text-gray-500 transition-transform ${isOrientationDropdownOpen ? '' : 'rotate-180'}`} 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth={2} 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Dropdown Orientação (abre para cima) */}
                        {isOrientationDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-1 w-full min-w-[160px] rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm shadow-lg z-10">
                          <button
                            onClick={() => {
                              setSelectedVeoModel(VEO_MODEL_CONFIGS[0]); // Retrato
                              setIsOrientationDropdownOpen(false);
                            }}
                            disabled={isGenerating}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                              selectedVeoModel.orientation === 'portrait'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <rect x="8" y="3" width="8" height="18" rx="1" />
                            </svg>
                            <div className="flex-1">
                              <div className="font-semibold">9:16</div>
                              <div className="text-[10px] text-gray-500">Retrato</div>
                            </div>
                            {selectedVeoModel.orientation === 'portrait' && (
                              <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedVeoModel(VEO_MODEL_CONFIGS[1]); // Paisagem
                              setIsOrientationDropdownOpen(false);
                            }}
                            disabled={isGenerating}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                              selectedVeoModel.orientation === 'landscape'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <rect x="3" y="8" width="18" height="8" rx="1" />
                            </svg>
                            <div className="flex-1">
                              <div className="font-semibold">16:9</div>
                              <div className="text-[10px] text-gray-500">Paisagem</div>
                            </div>
                            {selectedVeoModel.orientation === 'landscape' && (
                              <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                        )}
                      </div>
                      )}

                      {/* Duração Fixa */}
                      {selectedVersion === '1.0' && (
                      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm">
                        <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700">15s</span>
                      </div>
                      )}

                      {/* Duração - FIXO 8s (versão 2.0) */}
                      {selectedVersion === '2.0' && (
                      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm">
                        <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                        </svg>
                        <span className="text-xs font-semibold text-gray-700">8s</span>
                      </div>
                      )}

                      {/* Botão HIGH (apenas na v1.0) */}
                      {selectedVersion === '1.0' && (
                      <button
                        onClick={() => setIsHighQuality(!isHighQuality)}
                        disabled={isGenerating}
                        className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all shadow-sm ${
                          isHighQuality
                            ? 'border-emerald-500 bg-emerald-500 text-white shadow-md'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-emerald-400 hover:bg-emerald-50'
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <span>HIGH</span>
                      </button>
                      )}

                      {/* Melhorar com IA */}
                      <button
                        onClick={handleImprovePrompt}
                        disabled={!prompt.trim() || isImprovingPrompt || isGenerating}
                        className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 transition hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed sm:text-xs"
                      >
                        {isImprovingPrompt ? (
                          <>
                            <svg className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Melhorando...</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Melhorar com IA</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt.trim() || isGenerating || videos.filter(v => v.isLoading).length >= 2}
                    className="ml-auto flex h-8 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 px-3 text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
                    title={videos.filter(v => v.isLoading).length >= 2 ? 'Limite de 2 gerações simultâneas atingido' : ''}
                  >
                    {isGenerating ? (
                      <>
                        <svg className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Enviando</span>
                      </>
                    ) : videos.filter(v => v.isLoading).length >= 2 ? (
                      <>
                        <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Aguarde (2/2)</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{selectedVersion === '2.0' ? '35' : getCreditsForConfig(selectedModel, isHighQuality)}</span>
                        <span>Criar</span>
                      </>
                    )}
                  </button>
                </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        {isMounted && selectedVideo && typeof document !== 'undefined' && createPortal(
          (() => {
          // Calcular dimensões e aspect ratio do vídeo
          const [width, height] = selectedVideo.size.split('x').map(Number);
          const aspectRatio = `${width}/${height}`;
          const isVertical = height > width;
          
          // Determinar o modelo display correto
          let displayModel = 'Buua 1.0';
            if (selectedVideo.model.includes('veo-') || selectedVideo.model.includes('Veo') || 
                selectedVideo.model.includes('Buua 2.0') || selectedVideo.model.includes('Buua High')) {
              displayModel = 'Buua 2.0';
            } else if (selectedVideo.model === 'sora-2-pro-all' || selectedVideo.model.includes('High')) {
              displayModel = 'Buua 1.0';
            }

            // Função para copiar o prompt
            const handleCopyPrompt = async () => {
              try {
                await navigator.clipboard.writeText(selectedVideo.prompt);
                Swal.fire({
                  icon: 'success',
                  title: 'Prompt copiado!',
                  text: 'O prompt foi copiado para a área de transferência.',
                  timer: 1500,
                  showConfirmButton: false,
                });
              } catch (error) {
                console.error('Erro ao copiar prompt:', error);
                Swal.fire({
                  icon: 'error',
                  title: 'Erro ao copiar',
                  text: 'Não foi possível copiar o prompt.',
                });
              }
            };

          return (
            <>
              {/* Backdrop - Fixo sem scroll */}
              <div
                className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm cursor-pointer"
                onClick={() => setSelectedVideo(null)}
                style={{ 
                  overscrollBehavior: 'contain',
                  overflow: 'hidden', // ⭐ Bloqueia scroll no backdrop
                }}
              />
              
              {/* Container do Modal - Fixo e centralizado */}
              <div
                className="fixed inset-0 z-[100000] flex items-center justify-center p-2 sm:p-4"
                onClick={(e) => {
                  // Se clicar fora do conteúdo, fechar modal
                  if (e.target === e.currentTarget) {
                    setSelectedVideo(null);
                  }
                }}
                style={{ 
                  overscrollBehavior: 'contain',
                  overflow: 'hidden', // ⭐ Bloqueia scroll
                }}
              >
                <div
                  className="relative flex flex-col lg:flex-row gap-3 lg:gap-0 items-stretch lg:items-start"
                  onClick={(e) => e.stopPropagation()}
                  data-modal-content
                  style={{
                    maxHeight: 'calc(100vh - 1rem)', // Altura máxima com margem
                    overflowY: 'auto', // ⭐ Scroll apenas dentro do conteúdo
                    overflowX: 'hidden',
                  }}
                >
                  {/* Container do Vídeo - Responsivo */}
                  <div className="relative group flex items-center justify-center lg:justify-end">
                    <div 
                      className="overflow-hidden rounded-xl lg:rounded-r-none sm:rounded-2xl lg:sm:rounded-r-none bg-black w-full lg:w-auto h-auto relative" 
                      style={{ 
                        aspectRatio,
                        // Mobile: 90vw para ambos os tipos
                        // Desktop: vertical = auto (baseado em altura), horizontal = grande
                        ...(typeof window !== 'undefined' && window.innerWidth >= 1024 
                          ? {
                              maxWidth: isVertical ? '90vw' : 'calc(100vw - 24rem)',
                              width: isVertical ? 'auto' : 'max(70vw, 900px)',
                              height: isVertical ? '85vh' : 'auto',
                            }
                          : {
                              maxWidth: '90vw',
                              width: '90vw',
                              height: isVertical ? '85vh' : 'auto',
                            }
                        ),
                        maxHeight: '85vh',
                      }}
                    >
                      <Plyr
                        source={{
                          type: 'video',
                          sources: [{ src: selectedVideo.videoUrl, type: 'video/mp4' }],
                        }}
                        options={{
                          controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                          ratio: `${width}:${height}`, // Força o aspect ratio correto
                        }}
                      />
                      
                      {/* Botões flutuantes (apenas mobile/tablet) */}
                      <div className="absolute top-2 right-2 flex items-center gap-2 lg:hidden z-50">
                        {/* Botão Download */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(selectedVideo.videoUrl, selectedVideo.id);
                          }}
                          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow-lg transition hover:bg-emerald-600 active:scale-95 backdrop-blur-sm"
                          title="Baixar vídeo"
                        >
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>

                        {/* Botão Fechar */}
                        <button
                          onClick={() => setSelectedVideo(null)}
                          className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg transition hover:bg-white active:scale-95 backdrop-blur-sm"
                          title="Fechar"
                        >
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card de Informações - Apenas Desktop */}
                  <div 
                    className="hidden lg:flex rounded-xl lg:rounded-l-none bg-white/10 p-3 sm:p-4 backdrop-blur-sm w-full lg:w-80 lg:flex-shrink-0 flex-col gap-3 sm:gap-4 max-h-[80vh] overflow-y-auto"
                    style={{
                      WebkitOverflowScrolling: 'touch', // Scroll suave no iOS
                    }}
                  >
                    {/* Botões e Informações */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      {/* Informações do vídeo */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-emerald-500/80 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold text-white">
                          {selectedVideo.size} • {selectedVideo.seconds}s
                        </span>
                        <span className="rounded-full bg-blue-500/80 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold text-white">
                          {displayModel}
                        </span>
                      </div>

                      {/* Botões */}
                      <div className="flex items-center gap-2">
                        {/* Botão Download */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(selectedVideo.videoUrl, selectedVideo.id);
                          }}
                          className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow-lg transition hover:bg-emerald-600 active:scale-95 sm:hover:scale-110"
                          title="Baixar vídeo"
                        >
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>

                        {/* Botão Fechar */}
                        <button
                          onClick={() => setSelectedVideo(null)}
                          className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg transition hover:bg-white active:scale-95 sm:hover:scale-110"
                          title="Fechar"
                        >
                          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Prompt com título e copiável */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-semibold text-white">Prompt:</h3>
                      <p 
                        onClick={handleCopyPrompt}  
                        className="text-xs sm:text-sm text-white cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors leading-relaxed"
                        title="Clique para copiar"
                      >
                        {selectedVideo.prompt}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              </>
            );
          })(),
          document.body
        )}
      </AuthenticatedShell>
    );
  }
