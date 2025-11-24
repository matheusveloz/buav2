'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import { WelcomeModal } from '@/components/welcome-modal';
import { useWelcomeModal } from '@/lib/use-welcome-modal';
import type { Profile } from '@/lib/profile';

type ImageGeneratorClientProps = {
  initialProfile: Profile;
  userEmail: string;
};

type GeneratedImage = {
  id: string;
  imageUrl: string;
  imageType: string;
  prompt: string;
  createdAt: string;
  isLoading?: boolean; // Para mostrar skeleton
  model?: string; // Modelo usado (v1-fast, v2-quality, v3-high-quality)
};

type TaskStatus = {
  taskId: string;
  generationId: string;
  status: 'processing' | 'completed' | 'failed';
  placeholderIds: string[]; // IDs dos placeholders
};

type ImageSize = {
  width: number;
  height: number;
  label: string;
};

type AspectRatio = {
  id: string;
  label: string;
  value: string; // Formato "16:9" para API do Gemini
  description: string;
};

type Resolution = {
  id: '1K' | '2K' | '4K';
  label: string;
  description: string;
};

const ASPECT_RATIOS: AspectRatio[] = [
  { id: '16:9', label: '16:9', value: '16:9', description: 'Widescreen (YouTube)' },
  { id: '1:1', label: '1:1', value: '1:1', description: 'Square (Post)' },
  { id: '4:5', label: '4:5', value: '4:5', description: 'Instagram Post' },
  { id: '9:16', label: '9:16', value: '9:16', description: 'Stories/Reels' },
];

const RESOLUTIONS: Resolution[] = [
  { id: '1K', label: '1K (1024px)', description: 'Rápido (~30s)' },
  { id: '2K', label: '2K (2048px)', description: 'Alta qualidade (~60-90s)' },
];

type ModelVersion = {
  id: 'v1-fast' | 'v2-quality' | 'v3-high-quality';
  name: string;
  description: string;
  icon: string;
  maxReferenceImages?: number;
};

const MODEL_VERSIONS: ModelVersion[] = [
  { 
    id: 'v1-fast', 
    name: 'Versão 1.0 Fast', 
    description: 'Geração rápida e econômica',
    icon: '⚡',
    maxReferenceImages: 0
  },
  { 
    id: 'v2-quality', 
    name: 'Versão 2.0 Quality', 
    description: 'Alta qualidade com DALL-E 3',
    icon: '✨',
    maxReferenceImages: 3
  },
  { 
    id: 'v3-high-quality', 
    name: 'Versão 3.0 High Quality', 
    description: 'Nano Banana 2 - Gemini 3 Pro com até 4K',
    icon: '🚀',
    maxReferenceImages: 4
  },
];

const IMAGE_SIZES: ImageSize[] = [
  { width: 512, height: 512, label: '512x512 (Padrão)' },
  { width: 768, height: 768, label: '768x768' },
  { width: 1024, height: 768, label: '1024x768 (4:3)' },
  { width: 1024, height: 1024, label: '1024x1024' },
];

export default function ImageGeneratorClient({
  initialProfile,
  userEmail,
}: ImageGeneratorClientProps) {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
  const [selectedSize, setSelectedSize] = useState<ImageSize>(IMAGE_SIZES[0]);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [numImages, setNumImages] = useState(1); // Quantidade de imagens (padrão: 1)
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [dailyImageCount, setDailyImageCount] = useState<{generated: number; limit: number} | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelVersion>(MODEL_VERSIONS[0]);
  const [isMounted, setIsMounted] = useState(false);
  const [visibleImagesCount, setVisibleImagesCount] = useState(12); // Reduzido de 20 para 12 inicialmente
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); // Novo estado para loading do histórico
  const [isChatMinimized, setIsChatMinimized] = useState(false); // Estado para minimizar chat ao scrollar
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>(ASPECT_RATIOS[0]); // Padrão: 16:9 (Widescreen)
  const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTIONS[0]); // Padrão: 1K
  
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
  const [lastScrollY, setLastScrollY] = useState(0); // Última posição do scroll
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isUploadingReferenceImages, setIsUploadingReferenceImages] = useState(false); // 🆕 Loading state // Imagens de referência (base64) para v2-quality
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Carregar configurações do localStorage ao iniciar
  useEffect(() => {
    setIsMounted(true);
    
    const savedPrompt = localStorage.getItem('imageGeneratorPrompt');
    const savedNumImages = localStorage.getItem('imageGeneratorNumImages');
    const savedSize = localStorage.getItem('imageGeneratorSize');
    const savedModel = localStorage.getItem('imageGeneratorModel');
    const savedAspectRatio = localStorage.getItem('imageGeneratorAspectRatio');
    const savedResolution = localStorage.getItem('imageGeneratorResolution');

    if (savedPrompt) {
      setPrompt(savedPrompt);
    }
    if (savedNumImages) {
      setNumImages(parseInt(savedNumImages, 10));
    }
    if (savedSize) {
      const parsedSize = JSON.parse(savedSize);
      const matchedSize = IMAGE_SIZES.find(
        (s) => s.width === parsedSize.width && s.height === parsedSize.height
      );
      if (matchedSize) {
        setSelectedSize(matchedSize);
      }
    }
    if (savedModel) {
      const matchedModel = MODEL_VERSIONS.find((m) => m.id === savedModel);
      if (matchedModel) {
        setSelectedModel(matchedModel);
      }
    }
    if (savedAspectRatio) {
      const matchedRatio = ASPECT_RATIOS.find((r) => r.id === savedAspectRatio);
      if (matchedRatio) {
        setSelectedAspectRatio(matchedRatio);
      }
    }
    if (savedResolution) {
      const matchedResolution = RESOLUTIONS.find((r) => r.id === savedResolution);
      if (matchedResolution) {
        setSelectedResolution(matchedResolution);
      }
    }
  }, []);

  // Salvar configurações no localStorage sempre que mudarem
  useEffect(() => {
    if (prompt) {
      localStorage.setItem('imageGeneratorPrompt', prompt);
    }
  }, [prompt]);

  useEffect(() => {
    localStorage.setItem('imageGeneratorNumImages', String(numImages));
  }, [numImages]);

  useEffect(() => {
    localStorage.setItem('imageGeneratorSize', JSON.stringify({
      width: selectedSize.width,
      height: selectedSize.height,
      label: selectedSize.label,
    }));
  }, [selectedSize]);

  useEffect(() => {
    localStorage.setItem('imageGeneratorModel', selectedModel.id);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('imageGeneratorAspectRatio', selectedAspectRatio.id);
  }, [selectedAspectRatio]);

  useEffect(() => {
    localStorage.setItem('imageGeneratorResolution', selectedResolution.id);
  }, [selectedResolution]);

  // Forçar quantidade = 1 quando v3-high-quality estiver selecionado
  useEffect(() => {
    if (selectedModel.id === 'v3-high-quality' && numImages !== 1) {
      setNumImages(1);
    }
  }, [selectedModel, numImages]);

  // Scroll infinito - carregar mais imagens conforme desce
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      // Detectar direção do scroll para minimizar chat (mas não expandir automaticamente)
      if (scrollTop > lastScrollY && scrollTop > 100) {
        // Scrollando para baixo e passou de 100px
        setIsChatMinimized(true);
      }
      // REMOVIDO: Não expande automaticamente ao scrollar para cima
      // O usuário precisa clicar para expandir
      setLastScrollY(scrollTop);

      // Se estiver a 500px do final, carregar mais 20 imagens
      if (scrollHeight - scrollTop - clientHeight < 500) {
        setVisibleImagesCount((prev) => Math.min(prev + 12, images.length)); // Reduzido de 20 para 12
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [images.length, lastScrollY]);

  // Resetar contagem de imagens visíveis quando adicionar novas imagens
  useEffect(() => {
    if (images.length > 0 && visibleImagesCount < 12) {
      setVisibleImagesCount(12); // Reduzido de 20 para 12
    }
  }, [images.length, visibleImagesCount]);

  // Definir funções antes dos useEffects
  const pollTaskStatus = useCallback(async (taskId: string, generationId: string, placeholderIds: string[]) => {
    try {
      console.log('🔄 Polling taskId:', taskId, '| generationId:', generationId);

      const response = await fetch('/api/generate-image/polling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });

      const data = await response.json();

      console.log('📥 Resposta do polling:', {
        ok: response.ok,
        status: data.status,
        hasImages: !!data.images,
        numImages: data.images?.length,
        generationId: data.generationId,
        taskId: data.taskId,
      });

      if (response.ok && data.status === 'completed' && data.images) {
        console.log('✅ Imagens completadas! Dados completos:', {
          numImages: data.images.length,
          generationId: data.generationId,
          images: data.images,
        });
        
        // Remover placeholders
        setImages((prev) => prev.filter((img) => !placeholderIds.includes(img.id)));

        // Adicionar imagens reais com ID correto do banco
        const newImages = data.images.map((img: { imageUrl: string; imageType?: string }, index: number) => ({
          id: `${data.generationId || generationId}-${index}`,
          imageUrl: img.imageUrl,
          imageType: img.imageType || 'png',
          prompt: prompt || 'Imagem gerada',
          createdAt: new Date().toISOString(),
          model: data.model || selectedModel.id, // Incluir modelo usado
        }));

        console.log('📸 Adicionando imagens à UI:', {
          numImages: newImages.length,
          ids: newImages.map((img: { id: string }) => img.id),
        });

        // ✅ EVITAR DUPLICAÇÃO: Verificar se imagens já existem antes de adicionar
        setImages((prev) => {
          // Filtrar imagens que já existem (por generationId)
          const existingIds = new Set(prev.map(img => img.id.split('-')[0])); // Pegar só o generationId
          const newGenerationId = data.generationId || generationId;
          
          // Se já existe imagem deste generationId, não adicionar
          if (existingIds.has(newGenerationId)) {
            console.log('⚠️ Imagens deste generationId já existem - não duplicando:', newGenerationId);
            return prev;
          }
          
          console.log('✅ Adicionando novas imagens (não duplicadas)');
          return [...newImages, ...prev];
        });

        // Atualizar contador diário para plano FREE
        if (profile.plan.toLowerCase() === 'free' && dailyImageCount) {
          setDailyImageCount({
            generated: dailyImageCount.generated + newImages.length,
            limit: dailyImageCount.limit,
          });
        }

        // Remover da lista de tarefas ativas
        setActiveTasks((prev) => {
          const newTasks = prev.filter((t) => t.taskId !== taskId);
          if (newTasks.length === 0) {
            setIsGenerating(false);
          }
          return newTasks;
        });

        console.log('✅ Polling concluído com sucesso!');
      } else if (data.status === 'failed') {
        console.error('❌ Geração falhou:', data);
        
        // Remover placeholders em caso de falha
        setImages((prev) => prev.filter((img) => !placeholderIds.includes(img.id)));
        setActiveTasks((prev) => {
          const newTasks = prev.filter((t) => t.taskId !== taskId);
          if (newTasks.length === 0) {
            setIsGenerating(false);
          }
          return newTasks;
        });

        // Detectar tipo de erro específico
        const errorMessage = data.error || 'Não foi possível gerar a imagem.';
        const isTimeout = errorMessage.includes('Timeout') || errorMessage.includes('timeout');
        const isPayloadTooLarge = errorMessage.includes('Payload') || errorMessage.includes('muito grande');
        const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('Rate limit');
        
        // Mensagem customizada baseada no tipo de erro
        let userMessage = 'Não foi possível gerar a imagem. Seus créditos foram reembolsados.';
        
        if (isTimeout) {
          userMessage = '⏱️ Tempo de geração excedido (90 segundos).\n\n' +
                       '🔍 Possíveis causas:\n' +
                       '• Muitas imagens de referência (recomendado: 2-3 imagens)\n' +
                       '• Imagens de referência muito grandes\n' +
                       '• Problema temporário na API da Gemini\n\n' +
                       '💡 Sugestões:\n' +
                       '• Tente com MENOS imagens de referência (2-3 ao invés de 4)\n' +
                       '• Use imagens menores (elas já são reduzidas para 768px automaticamente)\n' +
                       '• Ou tente novamente (pode ter sido problema temporário)\n\n' +
                       '✅ Seus créditos foram reembolsados automaticamente.';
        } else if (isPayloadTooLarge) {
          userMessage = '📦 Payload muito grande! Reduza:\n' +
                       '• Número de imagens de referência (máx 4-6)\n' +
                       '• Tamanho das imagens (use menos de 500KB cada)\n\n' +
                       'Seus créditos foram reembolsados.';
        } else if (isRateLimit) {
          userMessage = '🚫 Limite de requisições atingido. Aguarde alguns segundos e tente novamente.\n\n' +
                       'Seus créditos foram reembolsados.';
        }

        Swal.fire({
          icon: 'error',
          title: 'Erro ao gerar imagem',
          text: userMessage,
          timer: isTimeout || isPayloadTooLarge ? 8000 : 3000,
        });
      } else if (data.status === 'processing') {
        console.log('⏳ Tarefa ainda processando...');
      } else {
        // Status desconhecido ou erro - remover da lista após 10 tentativas
        console.warn('⚠️ Status desconhecido ou erro no polling:', data);
      }
    } catch (error) {
      console.error('❌ Erro ao fazer polling:', error);
      
      // Se der erro (ex: tarefa não encontrada), remover da lista de polling após algumas tentativas
      // para evitar polling infinito de tarefas que não existem mais
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('não encontrada') || errorMessage.includes('404')) {
        console.log('🗑️ Removendo tarefa inexistente do polling:', taskId);
        
        // Remover placeholders
        setImages((prev) => prev.filter((img) => !placeholderIds.includes(img.id)));
        
        // Remover da lista de tarefas ativas
        setActiveTasks((prev) => {
          const newTasks = prev.filter((t) => t.taskId !== taskId);
          if (newTasks.length === 0) {
            setIsGenerating(false);
          }
          return newTasks;
        });
      }
    }
  }, [prompt, profile.plan, dailyImageCount, selectedModel.id]);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      console.log('📚 [LOAD_HISTORY] Iniciando...');
      
      const response = await fetch('/api/generate-image/history?limit=20'); // Reduzido para evitar timeout com data URLs grandes
      
      console.log('📡 [LOAD_HISTORY] Response recebida:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [LOAD_HISTORY] Erro HTTP:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        setImages([]);
        return;
      }
      
      const data = await response.json();

      console.log('📦 [LOAD_HISTORY] Data recebida:', {
        hasImages: !!data.images,
        imagesLength: data.images?.length || 0,
        dataKeys: Object.keys(data),
        firstImage: data.images?.[0],
      });

      if (!data.images) {
        console.error('❌ [LOAD_HISTORY] data.images é undefined/null:', data);
        setImages([]);
        return;
      }

      if (data.images.length === 0) {
        console.warn('⚠️ [LOAD_HISTORY] Array de imagens está vazio');
        setImages([]);
        return;
      }

      console.log('🔄 [LOAD_HISTORY] Processando imagens...');
      console.log('📦 [LOAD_HISTORY] Total de imagens recebidas:', data.images.length);
      
      // Log de TODAS as imagens para debug
      data.images.forEach((img: { id: string; status: string; model?: string; task_id?: string }, idx: number) => {
        console.log(`📋 [LOAD_HISTORY] Imagem ${idx + 1}:`, {
          id: img.id,
          status: img.status,
          model: img.model,
          taskId: img.task_id,
        });
      });

      const completedImages = data.images
        .filter((img: { id: string; status: string; image_urls: unknown; model?: string }) => {
          const isValid = img.status === 'completed' && img.image_urls;
          if (!isValid) {
            console.log('⏭️ [LOAD_HISTORY] Pulando imagem:', {
              status: img.status,
              hasUrls: !!img.image_urls,
              model: img.model,
              id: img.id,
            });
          } else {
            console.log('✅ [LOAD_HISTORY] Imagem válida:', {
              id: img.id,
              model: img.model,
              numUrls: Array.isArray(img.image_urls) ? img.image_urls.length : 0,
            });
          }
          return isValid;
        })
        .flatMap((img: { id: string; image_urls: Array<{ imageUrl: string; imageType: string }>; prompt: string; completed_at?: string; created_at: string; model?: string }) => {
          console.log('✅ [LOAD_HISTORY] Processando imagem completa:', {
            id: img.id,
            numUrls: img.image_urls?.length || 0,
            model: img.model,
          });
          
          // Determinar o modelo baseado nos metadados ou defaults
          const imageModel = img.model || 'v2-quality'; // Default para v2-quality para compatibilidade
          
          return img.image_urls.map((urlData, urlIndex) => ({
            id: `${img.id}-${urlIndex}`,
            imageUrl: urlData.imageUrl,
            imageType: urlData.imageType || 'png',
            prompt: img.prompt,
            createdAt: img.completed_at || img.created_at,
            model: imageModel, // Sempre incluir modelo (com fallback)
          }));
        })
        .sort((a: { createdAt: string }, b: { createdAt: string }) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      console.log('✅ [LOAD_HISTORY] Imagens completadas:', completedImages.length);

      // Processar tarefas em andamento (apenas tarefas recentes - últimos 5 minutos)
      type ProcessingImage = {
        task_id: string;
        id: string;
        num_images?: number;
        prompt: string;
        created_at: string;
        status: string;
      };

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const processing = data.images
        .filter((img: ProcessingImage) => {
          const isProcessing = img.status === 'processing';
          const createdAt = new Date(img.created_at);
          const isRecent = createdAt > fiveMinutesAgo;
          
          if (isProcessing && !isRecent) {
            console.warn(`⏭️ [LOAD_HISTORY] Ignorando tarefa antiga (>${Math.round((Date.now() - createdAt.getTime()) / 60000)}min):`, {
              taskId: img.task_id,
              created: img.created_at,
            });
          }
          
          return isProcessing && isRecent;
        })
        .map((img: ProcessingImage) => ({
          taskId: img.task_id,
          generationId: img.id,
          status: 'processing' as const,
          placeholderIds: [],
          numImages: img.num_images || 1,
          prompt: img.prompt,
          createdAt: img.created_at,
        }));

      if (processing.length > 0) {
        console.log('⏳ [LOAD_HISTORY] Tarefas em processamento (recentes):', processing.length);
        processing.forEach((task: { taskId: string; generationId: string; numImages: number }) => {
          console.log('  📌', {
            taskId: task.taskId,
            generationId: task.generationId,
            numImages: task.numImages,
          });
        });
      } else {
        console.log('ℹ️ [LOAD_HISTORY] Nenhuma tarefa em processamento encontrada');
      }

      const processingPlaceholders = processing.flatMap((task: { 
        generationId: string; 
        numImages: number; 
        prompt: string; 
        createdAt: string;
      }) => 
        Array.from({ length: task.numImages }, (_, i) => ({
          id: `placeholder-${task.generationId}-${i}`,
          imageUrl: '',
          imageType: 'png',
          prompt: task.prompt,
          createdAt: task.createdAt,
          isLoading: true,
        }))
      );

      const allImages = [...processingPlaceholders, ...completedImages];

      console.log('📊 [LOAD_HISTORY] Total final:', {
        placeholders: processingPlaceholders.length,
        completed: completedImages.length,
        total: allImages.length,
      });

      setImages(allImages);

      if (processing.length > 0) {
        const tasksWithPlaceholders = processing.map((task: {
          taskId: string;
          generationId: string;
          status: 'processing';
          numImages: number;
          prompt: string;
          createdAt: string;
        }) => ({
          ...task,
          placeholderIds: Array.from(
            { length: task.numImages },
            (_, i) => `placeholder-${task.generationId}-${i}`
          ),
        }));

        setActiveTasks(tasksWithPlaceholders);
        console.log('🔄 [LOAD_HISTORY] Retomando polling:', tasksWithPlaceholders.length);
      }

      console.log('✅ [LOAD_HISTORY] Concluído com sucesso!');
    } catch (error) {
      console.error('❌ [LOAD_HISTORY] ERRO CRÍTICO:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : 'N/A',
      });
      setImages([]);
    } finally {
      setIsLoadingHistory(false);
      console.log('🏁 [LOAD_HISTORY] Finalizado');
    }
  }, []);

  // useEffects
  // Fechar menu de tamanho ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(event.target as Node)) {
        setShowSizeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar histórico ao montar
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Carregar contador diário para plano FREE
  useEffect(() => {
    const loadDailyCount = async () => {
      if (profile.plan.toLowerCase() === 'free') {
        try {
          const response = await fetch('/api/generate-image/history?limit=1000');
          if (response.ok) {
            const data = await response.json();
            
            // Contar imagens geradas hoje
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const todayImages = (data.images || []).filter((img: GeneratedImage) => {
              const imgDate = new Date(img.createdAt);
              imgDate.setHours(0, 0, 0, 0);
              return imgDate.getTime() === today.getTime();
            });
            
            setDailyImageCount({
              generated: todayImages.length,
              limit: 4,
            });
          }
        } catch (error) {
          console.error('Erro ao carregar contador diário:', error);
        }
      }
    };

    loadDailyCount();
  }, [profile.plan]);

  // Polling para tarefas ativas
  useEffect(() => {
    if (activeTasks.length > 0) {
      pollingIntervalRef.current = setInterval(() => {
        activeTasks.forEach((task) => {
          if (task.status === 'processing') {
            pollTaskStatus(task.taskId, task.generationId, task.placeholderIds);
          }
        });
      }, 3000); // Poll a cada 3 segundos

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    }
  }, [activeTasks, pollTaskStatus]);

  // Agrupar imagens por data (apenas as visíveis)
  const groupImagesByDate = () => {
    const groups: { [key: string]: GeneratedImage[] } = {};
    
    // Pegar apenas as imagens visíveis conforme scroll
    const visibleImages = images.slice(0, visibleImagesCount);

    visibleImages.forEach((image) => {
      const date = new Date(image.createdAt);
      const dateKey = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(image);
    });

    return groups;
  };

  const imageGroups = groupImagesByDate();

  const handleDeleteImage = async (image: GeneratedImage) => {
    if (image.isLoading) return; // Não pode deletar placeholders

    const result = await Swal.fire({
      title: 'Deletar imagem?',
      text: 'Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, deletar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) return;

    setIsDeleting(true);

    try {
      if (image.id.startsWith('placeholder-')) {
        console.warn('Tentativa de deletar placeholder:', image.id);
        return;
      }
      
      console.log('🗑️ Deletando imagem:', {
        imageId: image.id,
        prompt: image.prompt.substring(0, 50),
      });

      // Chamar API para deletar com o ID completo (formato: {generationId}-{index})
      // A API vai detectar o index e deletar apenas essa imagem específica
      const response = await fetch(`/api/generate-image/${image.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao deletar imagem');
      }

      // Remover apenas esta imagem da UI
      setImages((prev) => prev.filter((img) => img.id !== image.id));

      console.log('✅ Imagem deletada com sucesso:', image.id);

      Swal.fire({
        icon: 'success',
        title: 'Imagem deletada!',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('❌ Erro ao deletar imagem:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao deletar',
        text: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllImages = async () => {
    // Filtrar apenas imagens reais (não placeholders)
    const realImages = images.filter((img) => !img.isLoading && !img.id.startsWith('placeholder-'));
    
    if (realImages.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sem imagens',
        text: 'Não há imagens para deletar.',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Deletar todas as imagens?',
      html: `<p>Você está prestes a deletar <strong>${realImages.length}</strong> ${realImages.length === 1 ? 'imagem' : 'imagens'}.</p><p class="mt-2 text-red-600"><strong>Esta ação não pode ser desfeita!</strong></p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, deletar tudo',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) return;

    setIsDeleting(true);

    try {
      // Extrair todos os generation IDs únicos
      const generationIds = new Set<string>();
      
      realImages.forEach((image) => {
        const uuidMatch = image.id.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        
        if (uuidMatch) {
          generationIds.add(uuidMatch[1]);
        } else {
          generationIds.add(image.id.substring(0, 36));
        }
      });

      console.log('🗑️ Deletando todas as imagens:', {
        totalImages: realImages.length,
        uniqueGenerations: generationIds.size,
      });

      // Deletar todas as gerações em paralelo
      const deletePromises = Array.from(generationIds).map((generationId) =>
        fetch(`/api/generate-image/${generationId}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.allSettled(deletePromises);

      // Verificar resultados
      const failed = results.filter((r) => r.status === 'rejected');
      
      if (failed.length > 0) {
        console.warn(`⚠️ ${failed.length} deleções falharam`);
      }

      // Remover todas as imagens da lista local
      setImages([]);

      console.log('✅ Todas as imagens deletadas com sucesso!');

      Swal.fire({
        icon: 'success',
        title: 'Imagens deletadas!',
        text: `${generationIds.size} ${generationIds.size === 1 ? 'geração deletada' : 'gerações deletadas'} com sucesso.`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('❌ Erro ao deletar todas as imagens:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao deletar',
        text: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadImage = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `buua-${image.id}.${image.imageType || 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      Swal.fire({
        icon: 'success',
        title: 'Download iniciado!',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
      });
    } catch (error) {
      console.error('Erro ao baixar imagem:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro ao baixar',
        text: 'Não foi possível baixar a imagem.',
      });
    }
  };

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
          contentType: 'image-prompt', // Tipo específico para prompts de imagem
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

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limitar baseado no modelo selecionado
    const MAX_REFERENCE_IMAGES = selectedModel.maxReferenceImages || 3;
    const filesToProcess = Array.from(files).slice(0, MAX_REFERENCE_IMAGES - referenceImages.length);

    try {
      // ✅ Ativar loading visual no botão (sem modal)
      setIsUploadingReferenceImages(true);
      
      const uploadedUrls = await Promise.all(
        filesToProcess.map(async (file, index) => {
          try {
            // Validar tipo de arquivo
            if (!file.type.startsWith('image/')) {
              throw new Error(`Arquivo ${file.name} não é uma imagem válida`);
            }

            // Comprimir imagem antes de fazer upload
            const compressedBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  // ✅ REDUZIR AINDA MAIS: 384px (era 512px)
                  const MAX_SIZE = 384;
                  
                  let width = img.width;
                  let height = img.height;
                  
                  if (width > height && width > MAX_SIZE) {
                    height = (height * MAX_SIZE) / width;
                    width = MAX_SIZE;
                  } else if (height > MAX_SIZE) {
                    width = (width * MAX_SIZE) / height;
                    height = MAX_SIZE;
                  }
                  
                  canvas.width = width;
                  canvas.height = height;
                  
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  // ✅ COMPRESSÃO MÁXIMA: 0.5 (era 0.6)
                  const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5);
                  resolve(compressedBase64);
                };
                img.onerror = () => reject(new Error(`Erro ao carregar ${file.name}`));
                img.src = event.target?.result as string;
              };
              reader.onerror = () => reject(new Error(`Erro ao ler ${file.name}`));
              reader.readAsDataURL(file);
            });

            console.log(`✅ Imagem ${index + 1} comprimida: ${file.name}`);
            
            // 🛡️ MODERAÇÃO INSTANTÂNEA - Validar imagem ANTES de fazer upload
            console.log(`🛡️ Moderando imagem de referência ${index + 1}...`);

            // ✅ v2-quality e v3-high-quality: regras flexíveis (apenas nudez explícita bloqueada)
            // ✅ Celebridades, crianças, biquini/maiô = PERMITIDOS
            // 🚫 Apenas nudez explícita = BLOQUEADA
            const moderationVersion = (selectedModel.id === 'v2-quality' || selectedModel.id === 'v3-high-quality') ? '3.0' : '2.0';
            
            console.log(`📋 Usando regras de moderação versão ${moderationVersion} para ${selectedModel.id}`);

            const moderationResponse = await fetch('/api/moderate-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                imageBase64: compressedBase64,
                version: moderationVersion, // v2/v3: regras flexíveis | v1: regras padrão
              }),
            });

            const moderationResult = await moderationResponse.json();

            // Se bloqueada, mostrar erro específico
            if (moderationResult.blocked) {
              console.warn(`🚫 Imagem ${index + 1} bloqueada:`, moderationResult);
              
              throw new Error(
                `Imagem ${index + 1} não permitida:\n${moderationResult.message.substring(0, 150)}`
              );
            }

            console.log(`✅ Imagem ${index + 1} aprovada pela moderação (${moderationVersion})`);
            
            // ✅ Fazer upload para Storage e obter URL pública
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 9);
            const fileName = `temp-references/${userEmail}/${timestamp}-${randomId}-${index}.jpg`;
            
            // Converter base64 para Blob
            const base64Data = compressedBase64.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            
            console.log(`📤 Uploading ${fileName} (~${Math.round(blob.size / 1024)}KB)...`);
            
            // Upload via API endpoint
            const formData = new FormData();
            formData.append('file', blob, `ref-${index}.jpg`);
            formData.append('path', fileName);
            
            const uploadResponse = await fetch('/api/upload-temp-image', {
              method: 'POST',
              body: formData,
            });
            
            if (!uploadResponse.ok) {
              console.error(`❌ Erro ao fazer upload de ${file.name}`);
              // Fallback para base64 se upload falhar
              return compressedBase64;
            }
            
            const uploadData = await uploadResponse.json();
            const publicUrl = uploadData.publicUrl;
            
            console.log(`✅ Upload ${index + 1} completo: ${publicUrl.substring(0, 50)}...`);
            console.log(`📊 Economia: ${Math.round(compressedBase64.length / 1024)}KB → ${publicUrl.length} bytes (~99%!)`);
            
            return publicUrl; // ✅ Retorna URL ao invés de base64!
            
          } catch (error) {
            console.error(`❌ Erro ao processar ${file.name}:`, error);
            throw error;
          }
        })
      );

      Swal.close();
      
      setReferenceImages((prev) => [...prev, ...uploadedUrls].slice(0, MAX_REFERENCE_IMAGES));
      setIsUploadingReferenceImages(false);
      
      console.log(`✅ ${uploadedUrls.length} imagens prontas (URLs públicas)`);
      console.log(`📦 Payload total: ~${uploadedUrls.reduce((sum, url) => sum + url.length, 0)} bytes (ao invés de MB!)`);
      
    } catch (error) {
      console.error('Erro ao carregar imagem:', error);
      setIsUploadingReferenceImages(false);
      
      // ⭐ SÓ AGORA mostra modal (apenas se houver erro)
      Swal.fire({
        icon: 'error',
        title: 'Erro ao processar',
        html: error instanceof Error ? error.message.replace(/\n/g, '<br>') : 'Não foi possível processar a imagem.',
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#ef4444',
      });
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Prompt vazio',
        text: 'Por favor, descreva a imagem que você quer criar.',
      });
      return;
    }

    // Verificar limite de gerações simultâneas
    const SIMULTANEOUS_LIMIT = 4;
    if (activeTasks.length >= SIMULTANEOUS_LIMIT) {
      Swal.fire({
        icon: 'warning',
        title: 'Limite de gerações simultâneas',
        html: `
          <p>Você já tem <strong>${activeTasks.length}</strong> imagens sendo geradas simultaneamente.</p>
          <p class="text-sm text-gray-600 mt-2">Aguarde a conclusão de pelo menos uma para iniciar nova geração.</p>
        `,
        confirmButtonText: 'OK, entendi',
      });
      return;
    }

    // Calcular créditos baseado no modelo
    let creditsPerImage: number;
    if (selectedModel.id === 'v3-high-quality') {
      // v3-high-quality (Nano Banana 2):
      // - Custo FIXO: 10 créditos por imagem ($0.05/imagem)
      // - Não importa resolução (1K, 2K ou 4K)
      // - Não importa se tem imagens de referência ou não
      creditsPerImage = 10;
    } else if (selectedModel.id === 'v2-quality') {
      // v2-quality: 8 créditos FIXOS (API não cobra extra por imagens de referência)
      creditsPerImage = 8;
    } else {
      // v1-fast: 2
      creditsPerImage = 2;
    }
    
    const creditsNeeded = numImages * creditsPerImage;
    const totalCredits = profile.credits + profile.extraCredits;

    if (totalCredits < creditsNeeded) {
      Swal.fire({
        icon: 'error',
        title: 'Créditos insuficientes',
        html: `
          <p>Você precisa de <strong>${creditsNeeded} créditos</strong> para gerar ${numImages} imagem(ns) com ${selectedModel.name}.</p>
          <p class="text-sm text-gray-500 mt-2">Você tem ${totalCredits} créditos disponíveis.</p>
        `,
      });
      return;
    }

    setIsGenerating(true);

    // Criar placeholders ANTES de fazer a requisição
    const placeholderIds = Array.from({ length: numImages }, (_, i) => `placeholder-${Date.now()}-${i}`);
    const placeholders: GeneratedImage[] = placeholderIds.map((id) => ({
      id,
      imageUrl: '',
      imageType: 'png',
      prompt: prompt.trim(),
      createdAt: new Date().toISOString(),
      isLoading: true,
    }));

    setImages((prev) => [...placeholders, ...prev]);

    // Atualizar créditos localmente (otimista)
    const updatedProfile = {
      ...profile,
      credits: Math.max(0, profile.credits - creditsNeeded),
      extraCredits: Math.max(0, profile.extraCredits - Math.max(0, creditsNeeded - profile.credits)),
    };

    setProfile(updatedProfile);

    // Disparar evento para atualizar header em tempo real
    window.dispatchEvent(new CustomEvent('creditsDeducted', {
      detail: {
        credits: updatedProfile.credits,
        extraCredits: updatedProfile.extraCredits,
      }
    }));

    try {
      const generationType = 'text2image'; // Apenas Text-to-Image
      
      // Roteamento de API:
      // - v3-high-quality → /api/generate-image (Nano Banana 2 - Gemini 3 Pro)
      // - v2-quality → /api/generate-image (Nano Banana - Gemini)
      // - v1-fast → /api/generate-image (Newport AI - Flux)
      // - gpt-image-1 (DALL-E) → /api/generate-image/dalle (se precisar no futuro)
      const apiEndpoint = '/api/generate-image';

      console.log('🚀 Enviando requisição para API:', {
        generationType,
        model: selectedModel.id,
        prompt: prompt.substring(0, 50),
        width: selectedSize.width,
        height: selectedSize.height,
        aspectRatio: selectedModel.id === 'v3-high-quality' ? selectedAspectRatio.value : undefined,
        resolution: selectedModel.id === 'v3-high-quality' ? '1K' : undefined, // FIXO: Sempre 1K
        num: numImages,
        endpoint: apiEndpoint,
      });

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          // Dimensões para v1-fast (Flux)
          width: selectedModel.id === 'v1-fast' ? selectedSize.width : (selectedModel.id === 'v2-quality' ? 1024 : undefined),
          height: selectedModel.id === 'v1-fast' ? selectedSize.height : (selectedModel.id === 'v2-quality' ? 1024 : undefined),
          // Parâmetros específicos do v3 (Gemini Native Format)
          aspectRatio: selectedModel.id === 'v3-high-quality' ? selectedAspectRatio.value : undefined,
          resolution: selectedModel.id === 'v3-high-quality' ? '1K' : undefined, // FIXO: Sempre 1K
          num: numImages,
          seed: -1,
          referenceImageUrl: null,
          referenceImages: (selectedModel.id === 'v2-quality' || selectedModel.id === 'v3-high-quality') ? referenceImages : undefined, // Enviar para v2 e v3
          generationType,
          model: selectedModel.id,
        }),
      });

      const data = await response.json();

      console.log('📥 [GENERATE] Resposta da API completa:', {
        ok: response.ok,
        status: response.status,
        dataStatus: data.status,
        hasImageUrls: !!data.imageUrls,
        numImageUrls: data.imageUrls?.length,
        model: selectedModel.id,
        generationId: data.generationId,
        taskId: data.taskId,
        fullData: data,
      });

      if (!response.ok) {
        // Capturar informações de limite diário
        if (response.status === 429) {
          // Pode ser limite diário ou rate limit
          const generatedToday = data.generatedToday;
          const dailyLimit = data.dailyLimit;
          
          console.log('🚨 Status 429 - Verificando tipo de erro:', {
            generatedToday,
            dailyLimit,
            hasGeneratedToday: generatedToday !== undefined,
            hasDailyLimit: dailyLimit !== undefined,
            responseData: data
          });
          
          if (generatedToday !== undefined && dailyLimit !== undefined) {
            console.log('✅ Limite diário detectado! Mostrando modal...');
            
            setDailyImageCount({
              generated: generatedToday,
              limit: dailyLimit,
            });
            
            // Mostrar modal de upgrade bonito para limite diário
            Swal.fire({
              icon: 'warning',
              title: '🔒 Limite Diário Atingido',
              html: `
                <div class="text-left space-y-4">
                  <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p class="text-sm text-amber-800 font-medium">📊 Plano FREE: ${generatedToday}/${dailyLimit} imagens criadas hoje</p>
                    <p class="text-xs text-amber-700 mt-2">
                      Você atingiu o limite diário de imagens gratuitas.
                    </p>
                  </div>
                  
                  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-sm text-blue-900 font-semibold mb-2">💎 Com o Plano Premium:</p>
                    <ul class="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Imagens ilimitadas por dia</li>
                      <li>Acesso prioritário aos servidores</li>
                      <li>Gerações mais rápidas</li>
                      <li>Suporte prioritário</li>
                    </ul>
                  </div>

                  <p class="text-xs text-gray-500 italic">
                    ℹ️ A cota é renovada às 00:00 (meia-noite).
                    Deletar imagens não recupera a cota do dia.
                  </p>
                </div>
              `,
              confirmButtonText: '✨ Fazer Upgrade',
              showCancelButton: true,
              cancelButtonText: 'Voltar',
              confirmButtonColor: '#10b981',
              cancelButtonColor: '#6b7280',
            }).then((result) => {
              if (result.isConfirmed) {
                // Redirecionar para página de upgrade
                window.location.href = '/upgrade';
              }
            });
            
            throw new Error('Limite diário atingido'); // Será capturado pelo catch mas não mostrará outro modal
          }
        }
        throw new Error(data.message || data.error || 'Erro ao gerar imagem');
      }

      // v2-quality e v3-high-quality retornam imagem imediatamente (síncrono)
      if (data.status === 'completed' && data.imageUrls) {
        console.log('✅ [GENERATE] Entrando no bloco SÍNCRONO (imagem pronta)!', {
          model: selectedModel.id,
          numImages: data.imageUrls.length,
          placeholderIds,
        });
        
        // Remover placeholders
        console.log('🗑️ [GENERATE] Removendo placeholders:', placeholderIds);
        setImages((prev) => prev.filter((img) => !placeholderIds.includes(img.id)));

        // Adicionar imagem real
        const newImages = data.imageUrls.map((img: { imageUrl: string; imageType?: string }, index: number) => ({
          id: `${data.generationId || Date.now()}-${index}`,
          imageUrl: img.imageUrl,
          imageType: img.imageType || 'png',
          prompt: prompt.trim(),
          createdAt: new Date().toISOString(),
          model: selectedModel.id, // Incluir modelo usado
        }));

        console.log('📸 [GENERATE] Adicionando novas imagens:', newImages.map((img: { id: string; imageUrl: string }) => ({ id: img.id, url: img.imageUrl.substring(0, 50) })));
        setImages((prev) => [...newImages, ...prev]);

        // Atualizar contador diário para plano FREE
        if (profile.plan.toLowerCase() === 'free' && dailyImageCount) {
          setDailyImageCount({
            generated: dailyImageCount.generated + newImages.length,
            limit: dailyImageCount.limit,
          });
        }

        console.log('✅ [GENERATE] Liberando chat (setIsGenerating false)');
        setIsGenerating(false);

        // Atualizar créditos com valores reais do servidor
        setProfile((prev) => ({
          ...prev,
          credits: data.creditsRemaining - (initialProfile.extraCredits || 0),
          extraCredits: initialProfile.extraCredits || 0,
        }));

        console.log('✅ [GENERATE] Fluxo síncrono completo!');
        return;
      }

      console.log('⚠️ [GENERATE] NÃO entrou no bloco síncrono. Verificando assíncrono...');

      // Para gerações assíncronas (v1-fast e v3-4K), adicionar à lista de polling
      if (data.taskId && data.status === 'processing') {
        console.log('🔄 [GENERATE] Geração assíncrona - adicionando ao polling', {
          taskId: data.taskId,
          generationId: data.generationId,
        });
        
        setActiveTasks((prev) => [
          ...prev,
          {
            taskId: data.taskId,
            generationId: data.generationId,
            status: 'processing',
            placeholderIds,
          },
        ]);

        console.log('✅ Tarefa adicionada à lista de polling:', data.taskId);
        console.log('📋 Tarefas ativas:', activeTasks.length + 1);
        
        // LIBERAR CHAT IMEDIATAMENTE - não espera conclusão
        setIsGenerating(false);
        
        console.log('✅ Chat liberado! Usuário pode fazer nova geração.');
      }

      // Atualizar créditos com valores reais do servidor
      setProfile((prev) => ({
        ...prev,
        credits: data.creditsRemaining - (initialProfile.extraCredits || 0),
        extraCredits: initialProfile.extraCredits || 0,
      }));

      // NÃO limpar nada (prompt, referenceImageUrl, numImages, selectedSize)
      // Tudo fica salvo no localStorage para facilitar variações
      
      // Nota: isGenerating será setado para false quando todas as tarefas completarem
      // (ver pollTaskStatus)
    } catch (error) {
      console.error('❌ ERRO ao gerar imagem:', error);
      setIsGenerating(false);

      // Remover placeholders
      setImages((prev) => prev.filter((img) => !placeholderIds.includes(img.id)));

      // Reverter créditos
      setProfile(initialProfile);

      // Verificar se é erro de safety system do OpenAI
      const errorMessage = error instanceof Error ? error.message : '';
      
      // Se for erro de limite diário, não mostrar o modal genérico (já mostramos o modal de upgrade)
      if (errorMessage === 'Limite diário atingido') {
        setIsGenerating(false);
        return;
      }
      
      const isSafetyError = errorMessage.includes('safety system') || 
                           errorMessage.includes('rejected') ||
                           errorMessage.includes('req_');
      
      const isGeminiError = errorMessage.includes('processar imagem gerada') ||
                           errorMessage.includes('Gemini') ||
                           errorMessage.includes('não retornou uma imagem válida');

      Swal.fire({
        icon: 'error',
        title: 'Erro ao gerar imagem',
        html: isSafetyError 
          ? '<p>Não foi possível gerar a imagem. Tente ajustar sua descrição e gere novamente.</p>' 
          : isGeminiError
          ? `<div class="text-left space-y-2">
               <p class="text-sm text-gray-800">O modelo <strong>v2-quality</strong> está com problemas no momento.</p>
               <p class="text-xs text-gray-600 mt-2">💡 Tente usar o modelo <strong>v1-fast</strong> (funciona normalmente)</p>
               <p class="text-xs text-gray-500 mt-2">Seus créditos foram reembolsados.</p>
             </div>`
          : '<p>Ocorreu um erro ao gerar a imagem. Tente novamente.</p>',
      });
      
      setIsGenerating(false);
    }
  };

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <WelcomeModal isOpen={showWelcomeModal} onClose={handleCloseModal} />
      <div ref={scrollContainerRef} className="relative min-h-screen space-y-6 pb-64 lg:space-y-8">
        {/* Galeria de Imagens Geradas por Data */}
        {images.length > 0 && (
          <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 shadow-2xl transition-all duration-300 hover:shadow-3xl lg:p-8">
            {/* Decorative glass orbs */}
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-400/20 to-lime-400/20 blur-3xl" />
            <div className="absolute -left-16 -bottom-16 h-40 w-40 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 blur-3xl" />
            
            <div className="relative z-10 space-y-8">
              {/* Cabeçalho com botão Deletar Tudo */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">Minhas Imagens</h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {images.filter(img => !img.isLoading).length} {images.filter(img => !img.isLoading).length === 1 ? 'imagem' : 'imagens'}
                  </span>
                </div>
                <button
                  onClick={handleDeleteAllImages}
                  disabled={isDeleting || images.filter(img => !img.isLoading).length === 0}
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-all hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Deletar todas as imagens"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  {isDeleting ? 'Deletando...' : 'Deletar Tudo'}
                </button>
              </div>

            {Object.entries(imageGroups).map(([dateKey, groupImages]) => (
              <div key={dateKey} className="space-y-4">
                {/* Cabeçalho da data */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-2 shadow-sm">
                    <svg
                      className="h-4 w-4 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-sm font-semibold text-emerald-900">{dateKey}</span>
                    <span className="ml-1 text-xs text-emerald-600">({groupImages.length})</span>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent"></div>
                </div>

                {/* Grid de imagens - 4 por linha com cards menores */}
                <div className="grid grid-cols-4 gap-3">
                  {groupImages.map((image, imageIndex) => (
                    <div
                      key={image.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm transition-all hover:shadow-lg hover:border-emerald-300"
                    >
                      {image.isLoading ? (
                        /* Skeleton loader */
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                          <div className="text-center">
                            <div className="relative mx-auto mb-2 h-12 w-12">
                              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75"></div>
                              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600">
                                <svg
                                  className="h-6 w-6 animate-spin text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                </svg>
                              </div>
                            </div>
                            <p className="text-xs font-medium text-gray-600">Gerando...</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Imagem clicável */}
                          <button
                            onClick={() => setSelectedImage(image)}
                            className="h-full w-full"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={image.imageUrl}
                              alt={image.prompt}
                              loading={imageIndex < 8 ? "eager" : "lazy"}
                              decoding="async"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                          </button>
                          
                          {/* Botões de ação (aparecem ao hover) */}
                          <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {/* Botão de download */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadImage(image);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow-md transition-all hover:bg-emerald-600 hover:scale-110"
                              title="Baixar imagem"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                              </svg>
                            </button>

                            {/* Botão de deletar */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteImage(image);
                              }}
                              disabled={isDeleting}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white shadow-md transition-all hover:bg-red-600 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Deletar imagem"
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                          
                          {/* Overlay com prompt ao hover */}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="absolute bottom-0 left-0 right-0 p-2">
                              <p className="line-clamp-2 text-[10px] leading-tight text-white">{image.prompt}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Indicador de carregamento de mais imagens */}
            {visibleImagesCount < images.length && (
              <div className="py-8 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-6 py-3 text-sm font-medium text-emerald-700 backdrop-blur-sm">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent"></div>
                  <span>Carregando mais imagens... ({visibleImagesCount} de {images.filter(img => !img.isLoading).length})</span>
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Shimmer/Skeleton para loading inicial do histórico - só mostra se estiver carregando E não houver imagens */}
        {isLoadingHistory && images.length === 0 && (
          <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 shadow-2xl lg:p-8">
            <div className="relative z-10 space-y-8">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-32 animate-pulse rounded-lg bg-gray-200"></div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-emerald-100"></div>
                </div>
                <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200"></div>
              </div>

              {/* Skeleton Grid - 4 colunas */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-40 animate-pulse rounded-full bg-gradient-to-r from-emerald-50 to-green-50"></div>
                  <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent"></div>
                </div>
                
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-100 to-gray-200"
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

        {/* Área vazia inicial - só mostra se NÃO estiver carregando */}
        {images.length === 0 && !isGenerating && !isLoadingHistory && (
          <div className="relative overflow-hidden rounded-3xl border border-white/30 bg-white/20 backdrop-blur-xl p-6 shadow-2xl lg:p-8">
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <svg
                  className="mx-auto h-16 w-16 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-4 text-sm text-gray-500">
                  Nenhuma imagem gerada ainda. Descreva o que você quer criar abaixo!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat flutuante fixo na parte inferior - Só aparece após carregar histórico */}
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
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700">Criar nova imagem</span>
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

            {/* Container do input */}
            <div className={`space-y-2 transition-all duration-300 ${
              isChatMinimized ? 'hidden' : 'sm:space-y-3'
            }`}>
              {/* Conteúdo completo quando expandido */}
              {!isChatMinimized && (
                <>
              {/* Seletor de Modelo - Dropdown minimalista */}
              {/* Seletor de Modelo - Dropdown minimalista */}
              <div className="flex items-center gap-2">
                <label htmlFor="model-select" className="text-[10px] font-medium text-gray-500 sm:text-xs">
                  Modelo:
                </label>
                <select
                  id="model-select"
                  value={selectedModel.id}
                  onChange={(e) => {
                    const model = MODEL_VERSIONS.find((m) => m.id === e.target.value);
                    if (model) setSelectedModel(model);
                  }}
                  disabled={isGenerating}
                  className="w-auto rounded-xl border-2 border-gray-200/50 bg-white/70 px-3 py-1.5 text-[10px] font-semibold text-gray-700 backdrop-blur-md transition-all hover:border-emerald-300 focus:border-emerald-500 focus:bg-white/90 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-xs"
                >
                  {MODEL_VERSIONS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Textarea com card + dentro */}
              <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => {
                  if (e.target.value.length <= 1500) {
                    setPrompt(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (prompt.trim() && !isGenerating) {
                      handleGenerate();
                    }
                  }
                }}
                placeholder="Descreva a imagem que você quer criar..."
                rows={isChatMinimized ? 2 : 4}
                className="w-full resize-none rounded-2xl border-2 border-gray-200/50 bg-white/70 py-2.5 px-3 text-xs text-gray-900 placeholder-gray-500 backdrop-blur-md transition-all focus:border-emerald-500 focus:bg-white/90 focus:backdrop-blur-lg focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:py-3 sm:px-4 sm:text-sm"
                disabled={isGenerating}
              />
              </div>

              {/* Card de Upload de Imagens - para v2-quality e v3-high-quality */}
              {(selectedModel.id === 'v2-quality' || selectedModel.id === 'v3-high-quality') && (
                <div className="rounded-xl border-2 border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-green-50/50 p-3 backdrop-blur-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-semibold text-emerald-700 sm:text-sm">Imagens de Referência (opcional)</span>
                      <span className="text-[10px] text-emerald-600">{referenceImages.length}/{selectedModel.maxReferenceImages || 3}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {/* Preview das imagens carregadas */}
                    {referenceImages.map((img, index) => (
                      <div key={index} className="group relative h-16 w-16 overflow-hidden rounded-lg border-2 border-emerald-300">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Referência ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          onClick={() => removeReferenceImage(index)}
                          className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remover"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    
                    {/* Botão de upload se ainda não atingiu o limite */}
                    {referenceImages.length < (selectedModel.maxReferenceImages || 3) && (
                      <label className={`flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${
                        isUploadingReferenceImages
                          ? 'border-blue-400 bg-blue-50 animate-pulse cursor-wait'
                          : 'border-emerald-300 bg-white/50 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50'
                      }`}>
                        {isUploadingReferenceImages ? (
                          <>
                            <svg className="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="mt-1 text-[10px] font-medium text-blue-700">Validando...</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="mt-1 text-[10px] font-medium text-emerald-700">Add</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleReferenceImageUpload}
                          className="hidden"
                          disabled={isGenerating || isUploadingReferenceImages}
                        />
                      </label>
                    )}
                  </div>
                  
                  <p className="mt-2 text-[10px] text-emerald-600">
                    {selectedModel.id === 'v3-high-quality' 
                      ? `✨ v3: Adicione até ${selectedModel.maxReferenceImages} imagens (celebridades, crianças, biquini OK). Apenas nudez explícita bloqueada. JPG, PNG, WEBP, GIF.`
                      : selectedModel.id === 'v2-quality'
                      ? '✨ v2: Adicione até 3 imagens (celebridades, crianças, biquini OK). Apenas nudez explícita bloqueada. JPG, PNG, WEBP, GIF.'
                      : 'Adicione até 3 imagens para edição/combinação com IA. Aceita JPG, PNG, WEBP, GIF.'
                    }
                  </p>
                  
                  {/* ⚠️ AVISO: 4 imagens = geração mais lenta */}
                  {selectedModel.id === 'v3-high-quality' && referenceImages.length >= 4 && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
                      <p className="text-[9px] text-amber-800">
                        <strong>⚠️ Aviso:</strong> Com {referenceImages.length} imagens de referência, a geração pode demorar até <strong>1-2 minutos</strong>. Para melhor performance, recomendamos usar <strong>2-3 imagens</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Linha inferior: contador à esquerda, seletor de quantidade, tamanho e botão criar à direita */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              {/* Contador de caracteres + Limite diário + Gerações ativas + Botão Melhorar */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-[10px] text-gray-500 sm:text-xs">
                  <span className={prompt.length >= 1500 ? 'font-semibold text-red-500' : 'font-medium'}>
                    {prompt.length}/1500
                  </span>
                  <span className="ml-1.5 hidden sm:inline">•</span>
                  <span className="ml-1.5 hidden sm:inline">Enter para criar</span>
                </div>

                {/* Botão Melhorar Prompt */}
                <button
                  onClick={handleImprovePrompt}
                  disabled={!prompt.trim() || isGenerating || isImprovingPrompt}
                  className="flex items-center gap-1 rounded-lg border border-amber-200/50 bg-gradient-to-r from-amber-50/70 to-yellow-50/70 px-2 py-1 text-[10px] font-medium text-amber-700 backdrop-blur-sm transition-all hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
                  title="Melhorar prompt com IA"
                >
                  {isImprovingPrompt ? (
                    <svg
                      className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                      />
                    </svg>
                  )}
                  <span className="hidden sm:inline">{isImprovingPrompt ? 'Melhorando...' : 'Melhorar'}</span>
                  <span className="sm:hidden">✨</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                {/* Seletor de quantidade - compacto (apenas 1 para v3-high-quality) */}
                <div className="flex items-center gap-0.5 rounded-lg border border-gray-200/50 bg-white/70 px-1 py-0.5 backdrop-blur-sm sm:px-1.5 sm:py-1">
                  <span className="text-[9px] font-medium text-gray-600 mr-0.5 sm:text-[10px]">Qtd:</span>
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNumImages(num)}
                      disabled={isGenerating || (selectedModel.id === 'v3-high-quality' && num > 1)}
                      className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold transition-all sm:h-6 sm:w-6 sm:text-[11px] ${
                        numImages === num
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                      title={selectedModel.id === 'v3-high-quality' && num > 1 ? 'v3-high-quality: apenas 1 imagem por vez' : ''}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                {/* Seletor de tamanho/resolução - compacto */}
                <div className="relative" ref={sizeMenuRef}>
                  <button
                    onClick={() => setShowSizeMenu(!showSizeMenu)}
                    className={`flex items-center gap-1 rounded-lg border border-gray-200/50 px-1.5 py-1 text-[10px] font-medium backdrop-blur-sm transition-all sm:gap-1.5 sm:px-2 sm:py-1.5 sm:text-[11px] ${
                      selectedModel.id === 'v2-quality'
                        ? 'cursor-not-allowed bg-gray-100/50 text-gray-400'
                        : 'bg-white/70 text-gray-700 hover:border-emerald-500 hover:bg-white/90'
                    }`}
                    disabled={isGenerating || selectedModel.id === 'v2-quality'}
                    title={
                      selectedModel.id === 'v2-quality' 
                        ? 'Tamanho fixo 1024x1024 para v2-quality' 
                        : selectedModel.id === 'v3-high-quality'
                        ? 'Clique para selecionar resolução'
                        : 'Clique para selecionar tamanho'
                    }
                  >
                    <svg
                      className="h-3 w-3 text-gray-500 sm:h-3.5 sm:w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                    {/* v3: Mostrar aspect ratio, v1/v2: Mostrar dimensões */}
                    {selectedModel.id === 'v3-high-quality' ? (
                      <>
                        <span className="hidden sm:inline">
                          {selectedAspectRatio.label} • {selectedAspectRatio.description}
                        </span>
                        <span className="text-[9px] sm:hidden">
                          {selectedAspectRatio.label}
                        </span>
                      </>
                    ) : selectedModel.id === 'v2-quality' ? (
                      <>
                        <span className="hidden sm:inline">1024x1024 (fixo)</span>
                        <span className="text-[9px] sm:hidden">1024×1024</span>
                      </>
                    ) : (
                      <>
                        <span className="hidden sm:inline">
                          {selectedSize.label}
                        </span>
                        <span className="text-[9px] sm:hidden">
                          {selectedSize.width}×{selectedSize.height}
                        </span>
                      </>
                    )}
                  </button>

                  {/* Dropdown - v3: Aspect Ratio, v1: Tamanhos */}
                  {showSizeMenu && selectedModel.id !== 'v2-quality' && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-gray-200/50 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl sm:w-52 sm:p-2">
                      {selectedModel.id === 'v3-high-quality' ? (
                        // v3: Menu de Aspect Ratio
                        ASPECT_RATIOS.map((ratio) => (
                          <button
                            key={ratio.id}
                            onClick={() => {
                              setSelectedAspectRatio(ratio);
                              setShowSizeMenu(false);
                            }}
                            className={`w-full rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors sm:px-3 sm:py-2 sm:text-xs ${
                              selectedAspectRatio.id === ratio.id
                                ? 'bg-emerald-100 font-semibold text-emerald-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="font-semibold">{ratio.label} • {ratio.description}</div>
                          </button>
                        ))
                      ) : (
                        // v1: Menu de Tamanhos
                        IMAGE_SIZES.map((size) => (
                          <button
                            key={size.label}
                            onClick={() => {
                              setSelectedSize(size);
                              setShowSizeMenu(false);
                            }}
                            className={`w-full rounded-lg px-2 py-1.5 text-left text-[10px] transition-colors sm:px-3 sm:py-2 sm:text-xs ${
                              selectedSize.label === size.label
                                ? 'bg-emerald-100 font-semibold text-emerald-700'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {size.label}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Botão de criar com créditos */}
                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isGenerating || activeTasks.length >= 4}
                  className="flex h-8 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 px-3 text-xs font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
                  title={activeTasks.length >= 4 ? 'Limite de 4 gerações simultâneas atingido' : ''}
                >
                  {isGenerating ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5 animate-spin sm:h-4 sm:w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      <span>Enviando</span>
                    </>
                  ) : activeTasks.length >= 4 ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Aguarde</span>
                    </>
                  ) : (
                    <>
                      {/* Ícone de moeda */}
                      <svg
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>
                        {(() => {
                          if (selectedModel.id === 'v3-high-quality') {
                            // v3: Custo fixo de 10 créditos por imagem
                            return numImages * 10;
                          } else if (selectedModel.id === 'v2-quality') {
                            // v2: Custo fixo de 8 créditos (com ou sem referência)
                            return numImages * 8;
                          } else {
                            // v1-fast: 2 créditos
                            return numImages * 2;
                          }
                        })()}
                      </span>
                      <span>Criar</span>
                    </>
                  )}
                </button>
              </div>
              </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualização da imagem - renderizado via Portal para ficar acima de tudo */}
      {isMounted && selectedImage && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* Imagem */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.prompt}
              className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl"
            />

            {/* Botões sobre a imagem - canto superior direito */}
            <div className="absolute right-3 top-3 z-10 flex gap-2">
              {/* Botão de usar como referência (lápis) - Apenas para v2 e v3 */}
              {selectedImage.model && (selectedImage.model === 'v2-quality' || selectedImage.model === 'v3-high-quality' || selectedImage.model.includes('gemini')) && (
                <button
                  onClick={async () => {
                    try {
                      // Verificar limite de imagens
                      const MAX_IMAGES = selectedModel.maxReferenceImages || 3;
                      if (referenceImages.length >= MAX_IMAGES) {
                        Swal.fire({
                          icon: 'warning',
                          title: 'Limite atingido',
                          text: `Você já tem ${referenceImages.length} imagens de referência (máximo: ${MAX_IMAGES}). Remova algumas antes de adicionar mais.`,
                        });
                        return;
                      }

                      // Mostrar loading
                      Swal.fire({
                        title: 'Carregando imagem...',
                        text: 'Preparando imagem para uso como referência',
                        allowOutsideClick: false,
                        didOpen: () => {
                          Swal.showLoading();
                        }
                      });

                      const imageUrl = selectedImage.imageUrl;
                      
                      // Se já é base64, adicionar direto
                      if (imageUrl.startsWith('data:image')) {
                        setReferenceImages((prev) => [...prev, imageUrl]);
                        setSelectedImage(null);
                        
                        Swal.fire({
                          icon: 'success',
                          title: 'Imagem adicionada!',
                          text: 'A imagem foi adicionada às referências.',
                          timer: 2000,
                          showConfirmButton: false,
                        });
                        return;
                      }
                      
                      // Se é URL, já usar ela diretamente (não converter para base64!)
                      // A API agora aceita URLs e faz o fetch lá
                      console.log('✅ Usando URL pública diretamente (sem converter para base64)');
                      
                      // ✅ Adicionar URL diretamente (backend vai fazer fetch)
                      setReferenceImages((prev) => [...prev, imageUrl]);
                      setSelectedImage(null);
                      
                      Swal.fire({
                        icon: 'success',
                        title: 'Imagem adicionada!',
                        text: 'A imagem foi adicionada às referências.',
                        timer: 2000,
                        showConfirmButton: false,
                      });
                    } catch (error) {
                      console.error('❌ Erro ao adicionar imagem como referência:', error);
                      Swal.fire({
                        icon: 'error',
                        title: 'Erro ao adicionar imagem',
                        text: error instanceof Error ? error.message : 'Não foi possível processar a imagem. Tente novamente.',
                      });
                    }
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-500/90 text-white shadow-xl backdrop-blur-sm transition-all hover:scale-110 hover:bg-purple-600"
                  title="Usar como referência"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              )}
              
              {/* Botão de download */}
              <button
                onClick={() => handleDownloadImage(selectedImage)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow-xl backdrop-blur-sm transition-all hover:scale-110 hover:bg-emerald-600"
                title="Baixar imagem"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>

              {/* Botão de deletar */}
              <button
                onClick={() => {
                  setSelectedImage(null);
                  handleDeleteImage(selectedImage);
                }}
                disabled={isDeleting}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/90 text-white shadow-xl backdrop-blur-sm transition-all hover:scale-110 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                title="Deletar imagem"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>

              {/* Botão X para fechar */}
              <button
                onClick={() => setSelectedImage(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-xl backdrop-blur-sm transition-all hover:scale-110 hover:bg-white"
                title="Fechar"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Prompt usado - abaixo da imagem */}
            {selectedImage.prompt && (
              <div className="absolute bottom-0 left-0 right-0 rounded-b-2xl bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 pt-8">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white/70 mb-1">Prompt usado:</p>
                    <p className="text-sm text-white/90 line-clamp-3">{selectedImage.prompt}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedImage.prompt);
                      Swal.fire({
                        icon: 'success',
                        title: 'Copiado!',
                        text: 'Prompt copiado para a área de transferência.',
                        timer: 1500,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end',
                      });
                    }}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:scale-110"
                    title="Copiar prompt"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </AuthenticatedShell>
  );
}

