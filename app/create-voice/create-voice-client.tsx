'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import Swal from 'sweetalert2';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import type { Profile } from '@/lib/profile';

type VoiceOption = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  previewUrl?: string | null;
  type: 'native' | 'cloned';
  owned?: boolean;
  labels?: Record<string, unknown> | null;
  audioUrl?: string; // URL do áudio de referência (para vozes virtuais)
};

type AudioItem = {
  id: string;
  name: string;
  url: string;
  extension?: string | null;
  createdAt?: string | null;
};

type ClonedVoice = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  previewUrl?: string | null;
  createdAt?: string | null;
};

type VoiceFilter = 'all' | 'native' | 'cloned';

interface CreateVoiceClientProps {
  initialProfile: Profile;
  userEmail: string;
  initialAudios: AudioItem[];
  initialClonedVoices: ClonedVoice[];
}

const STORAGE_KEY_GENERATE_TEXT = 'buua_create_voice_text';

function formatDate(date?: string | null) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  } catch {
    return '';
  }
}

function formatPlaybackTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

type ThemedAudioPlayerProps = {
  src?: string | null;
  variant?: 'default' | 'compact';
  className?: string;
};

// Gerenciador global de players de áudio (pausar outros ao tocar novo)
const audioPlayers = new Set<HTMLAudioElement>();

function ThemedAudioPlayer({ src, variant = 'default', className }: ThemedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Registrar/desregistrar player no set global
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audioPlayers.add(audio);
      return () => {
        audioPlayers.delete(audio);
      };
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const handleTimeUpdate = () => {
      setProgress(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset do player quando o src muda
    const resetPlayer = () => {
      audio.pause();
      audio.currentTime = 0;
      
      if (src) {
        audio.load();
      }
    };

    resetPlayer();
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      // Pausar TODOS os outros players antes de tocar este
      audioPlayers.forEach((player) => {
        if (player !== audio && !player.paused) {
          player.pause();
        }
      });

      void audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleProgressClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const clickPosition = event.clientX - rect.left;
      const ratio = Math.min(Math.max(clickPosition / rect.width, 0), 1);
      audio.currentTime = ratio * duration;
      setProgress(audio.currentTime);
    },
    [duration],
  );

  if (!src) {
    return (
      <div
        className={`rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 ${className ?? ''}`}
      >
        Prévia indisponível
      </div>
    );
  }

  const containerBase =
    'flex items-center gap-3 rounded-2xl border border-gray-200 bg-white shadow-sm transition';
  const containerSizing = variant === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const playButtonSize = variant === 'compact' ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5';
  const progressHeight = variant === 'compact' ? 'h-1' : 'h-1.5';
  const labelText = variant === 'compact' ? 'text-[10px]' : 'text-xs';

  const progressPercentage = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div className={`${containerBase} ${containerSizing} ${className ?? ''}`}>
      <button
        type="button"
        onClick={togglePlay}
        className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 text-white shadow-md transition hover:shadow-lg ${playButtonSize}`}
        aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {isPlaying ? (
          <svg className={iconSize} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19V5M14 19V5" />
          </svg>
        ) : (
          <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="flex-1">
        <div className={`flex items-center justify-between text-gray-500 ${labelText}`}>
          <span>{formatPlaybackTime(progress)}</span>
          <span>{formatPlaybackTime(duration)}</span>
        </div>
        <div
          className={`mt-2 w-full cursor-pointer overflow-hidden rounded-full bg-gray-200 ${progressHeight}`}
          onClick={handleProgressClick}
          role="presentation"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-green-500 to-teal-500 transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <audio key={src} ref={audioRef} src={src ?? undefined} preload="metadata" className="hidden" />
    </div>
  );
}

export default function CreateVoiceClient({
  initialProfile,
  userEmail,
  initialAudios,
  initialClonedVoices,
}: CreateVoiceClientProps) {
  const [audios, setAudios] = useState<AudioItem[]>(initialAudios);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(
    initialClonedVoices[0]?.id ?? null,
  );
  const [filter, setFilter] = useState<VoiceFilter>('all');
  const [generateText, setGenerateText] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isImprovingText, setIsImprovingText] = useState(false);
  const [isPunctuating, setIsPunctuating] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [voicesWarning, setVoicesWarning] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [dailyLimit, setDailyLimit] = useState<{
    hasLimit: boolean;
    limit?: number;
    used?: number;
    remaining?: number;
    canGenerate?: boolean;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadAudioFile, setUploadAudioFile] = useState<File | null>(null);
  const [uploadAudioPreviewName, setUploadAudioPreviewName] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newAudioId, setNewAudioId] = useState<string | null>(null); // Para animação de novo áudio
  
  // Estados para edição de nome de áudio
  const [editingAudioId, setEditingAudioId] = useState<string | null>(null);
  const [editingAudioName, setEditingAudioName] = useState('');
  const [isSavingAudioName, setIsSavingAudioName] = useState(false);
  
  // Estados para criar voz virtual
  const [cloneVoiceName, setCloneVoiceName] = useState('');
  const [cloneVoiceDescription, setCloneVoiceDescription] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  
  /**
   * Configurações avançadas de síntese de voz
   * 
   * Estas configurações permitem ajustar finamente a qualidade e características da voz gerada:
   * 
   * - voiceSpeed: Controla a velocidade de reprodução da fala (0.70x a 1.20x)
   *   Padrão: 1.0 (velocidade normal)
   * 
   * - voiceStability: Ajusta a consistência e estabilidade da entonação (0.0 a 1.0)
   *   Valores mais altos = voz mais consistente e previsível
   *   Padrão: 0.5 (50%)
   * 
   * - voiceSimilarity: Define o quão próxima a voz gerada está da voz original (0.0 a 1.0)
   *   Valores mais altos = maior similaridade com a voz de referência
   *   Padrão: 0.75 (75%) - otimizado para melhor qualidade
   * 
   * - voiceStyleExaggeration: Controla a intensidade das características estilísticas (0.0 a 1.0)
   *   Valores mais altos = estilo mais exagerado e expressivo
   *   Padrão: 0.0 (0% - estilo neutro)
   */
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceStability, setVoiceStability] = useState(0.5);        // Padrão otimizado: 0.5
  const [voiceSimilarity, setVoiceSimilarity] = useState(0.75);     // Padrão otimizado: 0.75 (melhor qualidade)
  const [voiceStyleExaggeration, setVoiceStyleExaggeration] = useState(0.0);

  useEffect(() => {
    setIsMounted(true);
    
    // Carregar texto salvo do localStorage
    if (typeof window !== 'undefined') {
      const savedText = localStorage.getItem(STORAGE_KEY_GENERATE_TEXT);
      if (savedText) {
        setGenerateText(savedText);
      }
    }
  }, []);

  // Salvar texto no localStorage quando mudar
  useEffect(() => {
    if (typeof window !== 'undefined' && generateText) {
      localStorage.setItem(STORAGE_KEY_GENERATE_TEXT, generateText);
    }
  }, [generateText]);

  const handleOpenUploadModal = useCallback(() => {
    setIsUploadModalOpen(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('modalOpened'));
    }
  }, []);

  const handleCloseUploadModal = useCallback(() => {
    setIsUploadModalOpen(false);
    setUploadAudioFile(null);
    setUploadAudioPreviewName(null);
    setCloneVoiceName('');
    setCloneVoiceDescription('');
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = '';
    }
  }, []);

  const handleOpenVoiceModal = useCallback(() => {
    setIsVoiceModalOpen(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('modalOpened'));
    }
  }, []);

  const handleCloseVoiceModal = useCallback(() => {
    setIsVoiceModalOpen(false);
  }, []);


  const handleSelectVoice = useCallback((voice: VoiceOption) => {
    setSelectedVoiceId(voice.id);
    setIsVoiceModalOpen(false);
  }, []);

  const fetchDailyLimit = useCallback(async () => {
    try {
      const response = await fetch('/api/voice/daily-limit');
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 [DEBUG] Limite diário recebido:', {
          hasLimit: data.hasLimit,
          plan: data.plan,
          limit: data.limit,
          used: data.used,
          remaining: data.remaining,
          canGenerate: data.canGenerate,
          warning: data.warning,
        });
        setDailyLimit(data);
      } else {
        console.error('[CreateVoiceClient] Erro HTTP ao buscar limite:', response.status);
      }
    } catch (error) {
      console.error('[CreateVoiceClient] Erro ao buscar limite diário:', error);
    }
  }, []);

  const fetchVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    setVoicesWarning(null);

    try {
      const response = await fetch('/api/voice/voices', { method: 'GET' });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const data = (await response.json()) as { voices: VoiceOption[]; warning?: string | null };
      setVoices(data.voices ?? []);
      if (data.warning) {
        setVoicesWarning(data.warning);
      }

      if (!selectedVoiceId && data.voices && data.voices.length > 0) {
        const preferred = data.voices.find((voice) => voice.type === 'cloned') ?? data.voices[0];
        setSelectedVoiceId(preferred?.id ?? null);
      }
    } catch (error) {
      console.error('[CreateVoiceClient] Falha ao carregar vozes:', error);
      setVoicesWarning('Não foi possível carregar a lista de vozes. Tente novamente mais tarde.');
    } finally {
      setIsLoadingVoices(false);
    }
  }, [selectedVoiceId]);

  // Handler para deletar voz clonada
  const handleDeleteVoice = useCallback(
    async (voiceId: string, voiceName: string) => {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Deletar voz clonada?',
        text: `Tem certeza que deseja deletar "${voiceName}"? Esta ação não pode ser desfeita.`,
        showCancelButton: true,
        confirmButtonText: 'Sim, deletar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
      });

      if (!result.isConfirmed) {
        return;
      }

      try {
        const response = await fetch('/api/voice/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voiceId }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Erro desconhecido.' }));
          throw new Error(error?.error ?? 'Falha ao deletar voz.');
        }

        // Remover do estado local
        setVoices((prev) => prev.filter((v) => v.id !== voiceId));
        
        // Se a voz deletada estava selecionada, limpar seleção
        if (selectedVoiceId === voiceId) {
          setSelectedVoiceId(null);
        }

        await Swal.fire({
          icon: 'success',
          title: 'Voz deletada!',
          text: 'A voz foi removida com sucesso.',
          confirmButtonColor: '#10b981',
        });
      } catch (error) {
        console.error('[CreateVoiceClient] Erro ao deletar voz:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Falha ao deletar',
          text: error instanceof Error ? error.message : 'Erro desconhecido.',
          confirmButtonColor: '#ef4444',
        });
      }
    },
    [selectedVoiceId],
  );

  // Handler para deletar áudio do histórico
  const handleDeleteAudio = useCallback(
    async (audioId: string, audioName: string) => {
      const result = await Swal.fire({
        icon: 'warning',
        title: 'Deletar áudio?',
        text: `Tem certeza que deseja deletar "${audioName}"? Esta ação não pode ser desfeita.`,
        showCancelButton: true,
        confirmButtonText: 'Sim, deletar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
      });

      if (!result.isConfirmed) {
        return;
      }

      try {
        const response = await fetch('/api/audio/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioIds: [audioId] }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Erro desconhecido.' }));
          throw new Error(error?.error ?? 'Falha ao deletar áudio.');
        }

        // Remover do estado local
        setAudios((prev) => prev.filter((a) => a.id !== audioId));

        await Swal.fire({
          icon: 'success',
          title: 'Áudio deletado!',
          text: 'O arquivo foi removido com sucesso.',
          confirmButtonColor: '#10b981',
        });
      } catch (error) {
        console.error('[CreateVoiceClient] Erro ao deletar áudio:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Falha ao deletar',
          text: error instanceof Error ? error.message : 'Erro desconhecido.',
          confirmButtonColor: '#ef4444',
        });
      }
    },
    [],
  );

  // Handler para editar nome do áudio
  const handleStartEditAudioName = useCallback((audioId: string, currentName: string) => {
    setEditingAudioId(audioId);
    // Remover a extensão do nome para edição
    const nameWithoutExt = currentName.replace(/\.[^/.]+$/, '');
    setEditingAudioName(nameWithoutExt);
  }, []);

  const handleCancelEditAudioName = useCallback(() => {
    setEditingAudioId(null);
    setEditingAudioName('');
  }, []);

  const handleSaveAudioName = useCallback(
    async (audioId: string, originalName: string) => {
      const newName = editingAudioName.trim();
      
      if (!newName) {
        await Swal.fire({
          icon: 'warning',
          title: 'Nome inválido',
          text: 'O nome do áudio não pode estar vazio.',
          confirmButtonColor: '#10b981',
        });
        return;
      }

      // Manter a extensão original
      const extension = originalName.split('.').pop() || 'mp3';
      const newNameWithExt = `${newName}.${extension}`;

      if (newNameWithExt === originalName) {
        handleCancelEditAudioName();
        return;
      }

      setIsSavingAudioName(true);

      try {
        console.log('[handleSaveAudioName] Enviando requisição:', {
          audioId,
          originalName,
          newName,
          newNameWithExt,
        });

        const response = await fetch('/api/audio/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            audioId, 
            newName: newNameWithExt 
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Erro desconhecido.' }));
          console.error('[handleSaveAudioName] Erro na resposta:', error);
          throw new Error(error?.error ?? 'Falha ao renomear áudio.');
        }

        // Atualizar no estado local
        setAudios((prev) =>
          prev.map((a) =>
            a.id === audioId ? { ...a, name: newNameWithExt } : a
          )
        );

        handleCancelEditAudioName();

        await Swal.fire({
          icon: 'success',
          title: 'Nome atualizado!',
          text: 'O nome do áudio foi alterado com sucesso.',
          confirmButtonColor: '#10b981',
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error('[CreateVoiceClient] Erro ao renomear áudio:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Falha ao renomear',
          text: error instanceof Error ? error.message : 'Erro desconhecido.',
          confirmButtonColor: '#ef4444',
        });
      } finally {
        setIsSavingAudioName(false);
      }
    },
    [editingAudioName, handleCancelEditAudioName],
  );

  // Handler para melhorar texto com IA
  const handleImproveText = useCallback(
    async (mode: 'improve' | 'punctuation' | 'correct') => {
      if (!generateText.trim()) {
        await Swal.fire({
          icon: 'warning',
          title: 'Texto vazio',
          text: 'Escreva um texto antes de melhorá-lo.',
          confirmButtonColor: '#10b981',
        });
        return;
      }

      // Define o estado de loading específico para cada modo
      if (mode === 'improve') {
        setIsImprovingText(true);
      } else if (mode === 'punctuation') {
        setIsPunctuating(true);
      } else if (mode === 'correct') {
        setIsCorrecting(true);
      }

      try {
        const response = await fetch('/api/text/improve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: generateText,
            mode,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Erro desconhecido.' }));
          throw new Error(error?.error ?? 'Falha ao melhorar texto.');
        }

        const data = (await response.json()) as {
          improvedText: string;
          mode: string;
        };

        setGenerateText(data.improvedText);

        const successMessages = {
          improve: 'Texto otimizado no formato AIDA!',
          punctuation: 'Pontuação corrigida!',
          correct: 'Texto corrigido!',
        };

        await Swal.fire({
          icon: 'success',
          title: 'Texto melhorado!',
          text: successMessages[mode as keyof typeof successMessages],
          confirmButtonColor: '#10b981',
          timer: 2000,
          timerProgressBar: true,
        });
      } catch (error) {
        console.error('[CreateVoiceClient] Erro ao melhorar texto:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Falha ao melhorar',
          text: error instanceof Error ? error.message : 'Erro desconhecido.',
          confirmButtonColor: '#ef4444',
        });
      } finally {
        // Desativa o estado de loading específico
        if (mode === 'improve') {
          setIsImprovingText(false);
        } else if (mode === 'punctuation') {
          setIsPunctuating(false);
        } else if (mode === 'correct') {
          setIsCorrecting(false);
        }
      }
    },
    [generateText],
  );

  // Handler para clonar voz (upload + criar voz virtual)
  const handleUploadAudio = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!cloneVoiceName.trim()) {
        await Swal.fire({
          icon: 'warning',
          title: 'Informe o nome da voz',
          text: 'Dê um nome para identificar esta voz clonada.',
          confirmButtonColor: '#10b981',
        });
        return;
      }

      if (!uploadAudioFile) {
        await Swal.fire({
          icon: 'warning',
          title: 'Selecione um arquivo',
          text: 'Escolha um arquivo de áudio para clonar a voz.',
          confirmButtonColor: '#10b981',
        });
        return;
      }

      const fileSizeMB = uploadAudioFile.size / (1024 * 1024);
      if (fileSizeMB > 10) {
        await Swal.fire({
          icon: 'warning',
          title: 'Arquivo muito grande',
          text: 'O arquivo deve ter no máximo 10MB.',
          confirmButtonColor: '#10b981',
        });
        return;
      }

      setIsUploadingAudio(true);

      try {
        console.log('[CreateVoiceClient] Iniciando clone de voz:', {
          nome: cloneVoiceName,
          arquivo: uploadAudioFile.name,
          tamanho: `${fileSizeMB.toFixed(2)}MB`,
        });

        // Passo 1: Upload do áudio
        const uploadFormData = new FormData();
        uploadFormData.append('file', uploadAudioFile);

        const uploadResponse = await fetch('/api/audio/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json().catch(() => ({ error: 'Erro desconhecido.' }));
          throw new Error(error?.error ?? 'Falha ao fazer upload do áudio.');
        }

        const uploadData = (await uploadResponse.json()) as {
          audio: { id: string; url: string; name: string; extension?: string };
        };

        console.log('[CreateVoiceClient] Upload concluído:', uploadData);

        // Passo 2: Criar voz virtual usando a URL do áudio
        const cloneResponse = await fetch('/api/voice/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: cloneVoiceName.trim(),
            description: cloneVoiceDescription.trim() || undefined,
            audioUrl: uploadData.audio.url,
          }),
        });

        if (!cloneResponse.ok) {
          const error = await cloneResponse.json().catch(() => ({ error: 'Erro desconhecido.' }));
          throw new Error(error?.error ?? 'Falha ao criar voz virtual.');
        }

        const cloneData = (await cloneResponse.json()) as {
          voice: VoiceOption & { type: 'cloned'; audioUrl?: string };
        };

        console.log('[CreateVoiceClient] Voz virtual criada:', cloneData);

        // Adicionar à lista de vozes
        if (cloneData.voice) {
          setVoices((prev) => {
            const existing = prev.filter((voice) => voice.id !== cloneData.voice.id);
            return [cloneData.voice, ...existing];
          });
          setSelectedVoiceId(cloneData.voice.id);
          setFilter('cloned');
          void fetchVoices();
        }

        // NOTA: Não adicionar ao histórico de áudios
        // O histórico deve mostrar apenas áudios GERADOS (text-to-speech)
        // Os áudios de upload são usados apenas como referência para clonar voz

        handleCloseUploadModal();

        await Swal.fire({
          icon: 'success',
          title: 'Voz clonada com sucesso!',
          text: 'A voz está disponível em "Minhas vozes" para gerar áudios.',
          confirmButtonColor: '#10b981',
        });
      } catch (error) {
        console.error('[CreateVoiceClient] Erro ao clonar voz:', error);
        await Swal.fire({
          icon: 'error',
          title: 'Falha ao clonar voz',
          text: error instanceof Error ? error.message : 'Erro desconhecido.',
          confirmButtonColor: '#ef4444',
        });
      } finally {
        setIsUploadingAudio(false);
      }
    },
    [uploadAudioFile, cloneVoiceName, cloneVoiceDescription, handleCloseUploadModal, fetchVoices],
  );

  useEffect(() => {
    const mergedVoices: VoiceOption[] = initialClonedVoices.map((voice) => ({
      id: voice.id,
      name: voice.name,
      description: voice.description,
      category: voice.category,
      previewUrl: voice.previewUrl,
      type: 'cloned',
      owned: true,
      audioUrl: voice.previewUrl ?? undefined, // Incluir audioUrl para vozes virtuais
    }));

    if (mergedVoices.length > 0) {
      setVoices(mergedVoices);
    }

    void fetchVoices();
    void fetchDailyLimit();
  }, [initialClonedVoices, fetchVoices, fetchDailyLimit]);

  const filteredVoices = useMemo(() => {
    if (filter === 'cloned') {
      return voices.filter((voice) => voice.type === 'cloned' && voice.owned);
    }
    if (filter === 'native') {
      return voices.filter((voice) => voice.type === 'native');
    }
    return voices;
  }, [voices, filter]);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) ?? null,
    [voices, selectedVoiceId],
  );

  const voiceCounts = useMemo(() => {
    const nativeCount = voices.filter((voice) => voice.type === 'native').length;
    const clonedCount = voices.filter((voice) => voice.type === 'cloned' && voice.owned).length;
    return {
      all: voices.length,
      native: nativeCount,
      cloned: clonedCount,
    };
  }, [voices]);

  const selectedVoiceName = selectedVoice?.name ?? 'Selecione uma voz';

  const handleVoiceGenerate = useCallback(async () => {
    if (!selectedVoiceId) {
      await Swal.fire({
        icon: 'warning',
        title: 'Selecione uma voz',
        text: 'Escolha uma voz nativa ou clonada antes de gerar o áudio.',
        confirmButtonColor: '#10b981',
      });
      return;
    }

    if (!generateText.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Texto obrigatório',
        text: 'Informe um texto para gerar o áudio.',
        confirmButtonColor: '#10b981',
      });
      return;
    }

    setIsGenerating(true);

    try {
      /**
       * Envia requisição para gerar áudio com as configurações avançadas
       * 
       * Parâmetros enviados:
       * - voiceId: ID da voz selecionada (obrigatório)
       * - text: Texto a ser convertido em áudio (obrigatório)
       * - filename: Nome do arquivo gerado (opcional)
       * - voiceSettings: Configurações avançadas da síntese de voz
       *   - stability: Estabilidade da entonação (0.0 a 1.0)
       *   - similarity_boost: Similaridade com a voz original (0.0 a 1.0)
       *   - style: Exagero de estilo (0.0 a 1.0)
       *   - use_speaker_boost: Melhora a qualidade da voz (boolean)
       * 
       * Nota: A velocidade (voiceSpeed) pode ser aplicada no processamento do áudio
       * ou enviada como parâmetro separado dependendo da implementação da API.
       * Por enquanto, é enviada como parte das configurações de voz.
       */
      const response = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: selectedVoiceId,
          text: generateText,
          filename: selectedVoice ? `${selectedVoice.name}-${Date.now()}` : undefined,
          voiceSettings: {
            stability: voiceStability,
            similarity_boost: voiceSimilarity,
            style: voiceStyleExaggeration,
            use_speaker_boost: true,
            // Nota: Algumas versões da API ElevenLabs podem aceitar velocidade aqui
            // Se não funcionar, pode ser necessário aplicar no processamento do áudio
            speed: voiceSpeed !== 1.0 ? voiceSpeed : undefined,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido.' }));
        const errorMessage = error?.details ?? error?.error ?? 'Não foi possível gerar o áudio.';
        
        // Tratamento especial para limite diário
        if (error?.error === 'Limite diário atingido') {
      await Swal.fire({
        icon: 'error',
            title: '🚫 Limite diário atingido',
            html: `
              <div class="text-left">
                <p class="text-red-700 font-semibold mb-3">${errorMessage}</p>
                <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p class="text-sm text-gray-700 mb-2">💡 <strong>Solução:</strong></p>
                  <ul class="text-sm text-gray-600 space-y-1 ml-4">
                    <li>• Aguarde até amanhã para gerar mais áudios</li>
                    <li>• Ou faça upgrade para plano PRO (ilimitado)</li>
                  </ul>
                </div>
              </div>
            `,
        confirmButtonColor: '#ef4444',
            confirmButtonText: 'Entendi',
          });
          
          // Atualizar limite no UI
          void fetchDailyLimit();
          setIsGenerating(false);
        return;
      }

        throw new Error(errorMessage);
      }

      const data = (await response.json()) as {
        audio: { id: string; url: string; name: string; extension?: string | null };
        creditsDeducted?: number;
        newBalance?: {
          creditos: number;
          creditos_extras: number;
          total: number;
        };
      };

      // Disparar evento para atualizar créditos em tempo real (mesma lógica do avatar-video)
      if (data.creditsDeducted && typeof window !== 'undefined') {
        console.log('💰 Créditos descontados:', data.creditsDeducted);
        window.dispatchEvent(new CustomEvent('creditsDeducted', {
          detail: { amount: data.creditsDeducted }
        }));
      }

      if (data.audio) {
        const newAudio = {
          id: data.audio.id,
          url: data.audio.url,
          name: data.audio.name,
          extension: data.audio.extension ?? 'mp3',
          createdAt: new Date().toISOString(),
        };
        
        setAudios((prev) => [newAudio, ...prev]);
        setNewAudioId(data.audio.id);
        
        // Remover badge "NOVO" após 30 segundos
        setTimeout(() => {
          setNewAudioId(null);
        }, 30000);
        
        // Atualizar limite diário
        void fetchDailyLimit();
      }
      } catch (error) {
      console.error('[CreateVoiceClient] Erro ao gerar áudio:', error);
        await Swal.fire({
          icon: 'error',
        title: 'Falha ao gerar áudio',
          text: error instanceof Error ? error.message : 'Erro desconhecido.',
          confirmButtonColor: '#ef4444',
        });
      } finally {
      setIsGenerating(false);
      }
  }, [selectedVoiceId, selectedVoice, generateText, voiceSpeed, voiceStability, voiceSimilarity, voiceStyleExaggeration, fetchDailyLimit]);

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <div className="space-y-8 px-4 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <Link
              href="/home"
              aria-label="Voltar para a home"
              className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-400 via-emerald-500 to-green-600 text-white shadow-lg transition hover:scale-110 hover:shadow-xl sm:h-12 sm:w-12"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-green-500 sm:text-sm">
                Estúdio de Voz
              </p>
              <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl lg:text-3xl">
                Criação de voz personalizada
              </h1>
              <p className="max-w-2xl text-xs text-gray-600 sm:text-sm">
                Combine vozes padrão ou cadastre as suas para gerar locuções naturais alinhadas ao seu conteúdo.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)]">
          <div className="flex h-full flex-col rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg	font-semibold text-gray-900">Gerador de vozes</h2>
                <p className="text-sm text-gray-500">Escreva o roteiro e gere áudios com voz natural em instantes.</p>
              </div>
              <div
                className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                  selectedVoice
                    ? 'border border-emerald-200 bg-emerald-50/80 text-emerald-700'
                    : 'border border-gray-200 bg-gray-100 text-gray-500'
                }`}
              >
                {selectedVoice ? `Voz selecionada: ${selectedVoice.name}` : 'Selecione uma voz na biblioteca'}
              </div>
            </div>

            <div className="mt-6 flex-1 space-y-4">
              <div className="flex min-h-[300px] flex-1 flex-col rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-inner sm:min-h-[360px] lg:min-h-[420px]">
                <label htmlFor="generate-text" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Texto
                </label>
                <textarea
                  id="generate-text"
                  value={generateText}
                  onChange={(event) => setGenerateText(event.target.value)}
                  placeholder=""
                  className="mt-3 flex-1 resize-none border-none bg-transparent text-sm text-gray-700 outline-none focus:outline-none"
                  maxLength={5000}
                />
                
                {/* Sugestões de IA quando tiver texto suficiente */}
                {generateText.length >= 50 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <svg className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span className="font-medium">Sugestões IA:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImproveText('improve')}
                      disabled={isImprovingText}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isImprovingText ? (
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                      {isImprovingText ? 'Processando...' : 'Melhorar texto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImproveText('punctuation')}
                      disabled={isPunctuating}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPunctuating ? (
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                      {isPunctuating ? 'Processando...' : 'Pontuação'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleImproveText('correct')}
                      disabled={isCorrecting}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCorrecting ? (
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                      {isCorrecting ? 'Processando...' : 'Corrigir'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
              <span className={`text-xs ${generateText.length >= 5000 ? 'text-red-500' : 'text-gray-500'}`}>
                {generateText.length}/5000 caracteres
              </span>
                {generateText.length > 0 && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {(() => {
                      const estimatedSeconds = Math.ceil(generateText.length / 16);
                      const estimatedCredits = Math.max(1, Math.ceil(estimatedSeconds * 0.5));
                      return `~${estimatedCredits} créditos (~${estimatedSeconds}s)`;
                    })()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleVoiceGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Gerando...
                  </>
                ) : (
                  'Gerar áudio'
                )}
              </button>
            </div>

            <div className="mt-6" />
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Biblioteca de vozes</h2>
                <p className="text-sm text-gray-500">Escolha vozes padrão ou gerencie as suas personalizadas</p>
              </div>
              <button
                type="button"
                onClick={handleOpenUploadModal}
                className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-purple-700 hover:shadow-lg active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="whitespace-nowrap">Clonar Voz</span>
              </button>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleOpenVoiceModal}
                className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 shadow-md transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <div>
                  <span className="text-xs uppercase tracking-wide text-gray-500">Voz selecionada</span>
                  <span className="mt-1 block text-sm text-gray-900">{selectedVoiceName}</span>
                </div>
                <svg
                  className={`h-4 w-4 text-emerald-500 transition ${isVoiceModalOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 
                Configurações Avançadas de Síntese de Voz
                
                Esta seção permite ajustar finamente os parâmetros da síntese de voz para personalizar
                a qualidade, velocidade e características da voz gerada. Cada controle deslizante permite
                ajustar um aspecto específico da síntese:
                
                - Velocidade: Controla a rapidez da fala (0.25x = muito lento, 4.0x = muito rápido)
                - Estabilidade: Ajusta a consistência da entonação (maior = mais previsível)
                - Similaridade: Define proximidade com a voz original (maior = mais fiel à referência)
                - Exagero de Estilo: Controla expressividade e características estilísticas (maior = mais dramático)
                
                Todos os valores são enviados para a API ElevenLabs durante a geração do áudio.
              */}
              <div className="mt-6 space-y-5 rounded-2xl border border-gray-200 bg-gray-50/80 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Configurações Avançadas</h3>
                  <span className="text-xs text-gray-500">Ajuste os parâmetros da síntese de voz</span>
                </div>

                {/* 
                  Controle de Velocidade
                  Permite ajustar a velocidade de reprodução da fala de 0.70x (mais lento) até 1.20x (mais rápido).
                  Valor padrão: 1.0x (velocidade normal)
                */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="voice-speed" className="text-sm font-medium text-gray-700">
                      Velocidade
                    </label>
                    <span className="text-sm font-semibold text-emerald-600">{voiceSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    id="voice-speed"
                    type="range"
                    min="0.70"
                    max="1.20"
                    step="0.01"
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-emerald-500"
                    style={{
                      background: `linear-gradient(to right, rgb(16, 185, 129) 0%, rgb(16, 185, 129) ${((voiceSpeed - 0.70) / (1.20 - 0.70)) * 100}%, rgb(229, 231, 235) ${((voiceSpeed - 0.70) / (1.20 - 0.70)) * 100}%, rgb(229, 231, 235) 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0.70x</span>
                    <span className="font-medium text-emerald-600">Padrão: 1.00x</span>
                    <span>1.20x</span>
                  </div>
                </div>

                {/* 
                  Controle de Estabilidade
                  Ajusta a consistência e estabilidade da entonação e ritmo da voz.
                  Valores mais altos resultam em uma voz mais consistente e previsível.
                  Valor padrão: 0.5 (50%)
                */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="voice-stability" className="text-sm font-medium text-gray-700">
                      Estabilidade
                    </label>
                    <span className="text-sm font-semibold text-emerald-600">{Math.round(voiceStability * 100)}%</span>
                  </div>
                  <input
                    id="voice-stability"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceStability}
                    onChange={(e) => setVoiceStability(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-emerald-500"
                    style={{
                      background: `linear-gradient(to right, rgb(16, 185, 129) 0%, rgb(16, 185, 129) ${voiceStability * 100}%, rgb(229, 231, 235) ${voiceStability * 100}%, rgb(229, 231, 235) 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span className="font-medium text-emerald-600">Padrão: 50%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* 
                  Controle de Similaridade
                  Define o quão próxima a voz gerada está da voz original/referência.
                  Valores mais altos aumentam a fidelidade à voz de origem.
                  Valor padrão: 0.75 (75%) - otimizado para melhor qualidade
                */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="voice-similarity" className="text-sm font-medium text-gray-700">
                      Similaridade
                    </label>
                    <span className="text-sm font-semibold text-emerald-600">{Math.round(voiceSimilarity * 100)}%</span>
                  </div>
                  <input
                    id="voice-similarity"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceSimilarity}
                    onChange={(e) => setVoiceSimilarity(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-emerald-500"
                    style={{
                      background: `linear-gradient(to right, rgb(16, 185, 129) 0%, rgb(16, 185, 129) ${voiceSimilarity * 100}%, rgb(229, 231, 235) ${voiceSimilarity * 100}%, rgb(229, 231, 235) 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span className="font-medium text-emerald-600">Padrão: 75%</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* 
                  Controle de Exagero de Estilo
                  Controla a intensidade das características estilísticas e expressividade da voz.
                  Valores mais altos tornam a voz mais dramática e expressiva.
                  Valor padrão: 0.0 (0% - estilo neutro)
                */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="voice-style" className="text-sm font-medium text-gray-700">
                      Exagero de Estilo
                    </label>
                    <span className="text-sm font-semibold text-emerald-600">{Math.round(voiceStyleExaggeration * 100)}%</span>
                  </div>
                  <input
                    id="voice-style"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={voiceStyleExaggeration}
                    onChange={(e) => setVoiceStyleExaggeration(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-emerald-500"
                    style={{
                      background: `linear-gradient(to right, rgb(16, 185, 129) 0%, rgb(16, 185, 129) ${voiceStyleExaggeration * 100}%, rgb(229, 231, 235) ${voiceStyleExaggeration * 100}%, rgb(229, 231, 235) 100%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span className="font-medium text-emerald-600">Padrão: 0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Histórico de áudios</h2>
              <p className="text-sm text-gray-500">Reproduza, baixe ou reutilize as locuções geradas recentemente.</p>
            </div>
          </div>
          {audios.length === 0 && !isGenerating ? (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              Nenhum áudio disponível ainda. Gere sua primeira locução acima.
            </div>
          ) : (
            <div className="mt-6 max-h-[400px] overflow-y-auto pr-2">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {isGenerating && (
                  <div className="flex h-full flex-col justify-between gap-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 animate-pulse">
                    <div className="space-y-2">
                      <div className="h-4 w-3/4 rounded bg-emerald-200" />
                      <div className="h-3 w-1/2 rounded bg-emerald-100" />
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                      <svg className="h-5 w-5 animate-spin text-emerald-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span className="text-xs font-semibold text-emerald-700">Gerando áudio...</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-10 rounded bg-emerald-100" />
                      <div className="h-6 w-16 rounded-full bg-emerald-200" />
                    </div>
                  </div>
                )}
                {audios.map((audio) => {
                  const isNew = audio.id === newAudioId;
                  return (
                    <div
                      key={audio.id}
                      className={`flex h-full flex-col justify-between gap-4 rounded-2xl border p-4 shadow-sm transition-all ${
                        isNew
                          ? 'animate-[slideIn_0.5s_ease-out] border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-200'
                          : 'border-gray-200 bg-white hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          {editingAudioId === audio.id ? (
                            // Modo de edição
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editingAudioName}
                                onChange={(e) => setEditingAudioName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveAudioName(audio.id, audio.name);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditAudioName();
                                  }
                                }}
                                className="flex-1 rounded-lg border border-blue-300 bg-blue-50 px-2 py-1 text-sm font-semibold text-gray-900 outline-none ring-2 ring-blue-200 focus:border-blue-400 focus:ring-blue-300"
                                autoFocus
                                disabled={isSavingAudioName}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAudioName(audio.id, audio.name)}
                                disabled={isSavingAudioName}
                                className="flex-shrink-0 rounded-lg bg-green-500 p-1.5 text-white transition hover:bg-green-600 disabled:opacity-50"
                                title="Salvar nome"
                              >
                                {isSavingAudioName ? (
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEditAudioName}
                                disabled={isSavingAudioName}
                                className="flex-shrink-0 rounded-lg bg-gray-400 p-1.5 text-white transition hover:bg-gray-500 disabled:opacity-50"
                                title="Cancelar"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            // Modo de visualização
                            <>
                              <h3 className="flex-1 text-sm font-semibold text-gray-900 line-clamp-2">{audio.name}</h3>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditAudioName(audio.id, audio.name)}
                                  className="flex-shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"
                                  title="Editar nome"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                {isNew && (
                                  <span className="flex-shrink-0 animate-pulse rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                    NOVO
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{formatDate(audio.createdAt)}</p>
                      </div>
                      <ThemedAudioPlayer src={audio.url} />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-400">{audio.extension?.toUpperCase() ?? 'MP3'}</span>
                        <div className="flex items-center gap-2">
                      <button
                        type="button"
                            onClick={() => handleDeleteAudio(audio.id, audio.name)}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                            title="Deletar áudio"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                // Adicionar parâmetro download=true na URL do Supabase
                                const downloadUrl = audio.url.includes('?') 
                                  ? `${audio.url}&download=true`
                                  : `${audio.url}?download=true`;
                                
                                const response = await fetch(downloadUrl, {
                                  method: 'GET',
                                  headers: {
                                    'Accept': 'audio/mpeg,audio/*',
                                  },
                                });
                                
                                if (!response.ok) throw new Error('Falha ao baixar');
                                
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = audio.name || 'audio.mp3';
                                link.style.display = 'none';
                                document.body.appendChild(link);
                                link.click();
                                
                                // Cleanup após delay
                                setTimeout(() => {
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(url);
                                }, 100);
                              } catch (error) {
                                console.error('Erro ao baixar áudio:', error);
                                // Fallback: tentar abrir em nova aba
                                window.open(audio.url, '_blank');
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Baixar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {isMounted && isVoiceModalOpen
        ? createPortal(
            <div className="fixed inset-0 z-[99998] flex items-center justify-center px-4 py-6">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={handleCloseVoiceModal}
                aria-hidden="true"
              />
              <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-5">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Biblioteca de Vozes</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Escolha uma voz para gerar suas locuções ou ouça prévias antes de decidir.
                    </p>
                  </div>
                      <button
                        type="button"
                    onClick={handleCloseVoiceModal}
                    className="rounded-full bg-white p-2 text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-gray-700"
                    aria-label="Fechar modal de vozes"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-col gap-5 px-6 py-6">
                  <div
                    role="tablist"
                    aria-label="Filtros de vozes"
                    className="flex flex-wrap gap-2 rounded-full bg-gray-100 p-1 text-xs font-semibold text-gray-600"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={filter === 'all'}
                        onClick={() => setFilter('all')}
                      className={`flex-1 rounded-full px-4 py-2 transition ${
                          filter === 'all'
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : 'text-gray-600 hover:text-emerald-700'
                        }`}
                      >
                        Todas ({voiceCounts.all})
                      </button>
                      <button
                        type="button"
                      role="tab"
                      aria-selected={filter === 'native'}
                        onClick={() => setFilter('native')}
                      className={`flex-1 rounded-full px-4 py-2 transition ${
                          filter === 'native'
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : 'text-gray-600 hover:text-emerald-700'
                        }`}
                      >
                        Vozes padrão ({voiceCounts.native})
                      </button>
                      <button
                        type="button"
                      role="tab"
                      aria-selected={filter === 'cloned'}
                        onClick={() => setFilter('cloned')}
                        disabled={voiceCounts.cloned === 0}
                      className={`flex-1 rounded-full px-4 py-2 transition ${
                        filter === 'cloned'
                          ? 'bg-white text-emerald-600 shadow-sm'
                          : 'text-gray-600 hover:text-emerald-700'
                      } ${voiceCounts.cloned === 0 ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        Minhas vozes ({voiceCounts.cloned})
                      </button>
                    </div>

                    {voicesWarning ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        {voicesWarning}
                      </div>
                    ) : null}

                  <div
                    className="max-h-[65vh] space-y-3 overflow-y-auto pr-2"
                    role="listbox"
                    aria-label="Lista de vozes disponíveis"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#10b981 #f3f4f6',
                    }}
                  >
                      {isLoadingVoices && filteredVoices.length === 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div
                            key={`voice-skeleton-${index}`}
                            className="h-32 rounded-2xl border border-gray-200 bg-gray-50 animate-pulse"
                          />
                        ))}
                      </div>
                      ) : filteredVoices.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        <p className="mt-3 text-sm font-medium text-gray-900">Nenhuma voz disponível</p>
                        <p className="mt-1 text-xs text-gray-500">Tente outro filtro ou clone uma voz personalizada.</p>
                        </div>
                      ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {filteredVoices.map((voice) => {
                          const isSelected = voice.id === selectedVoiceId;
                          return (
                            <div
                              key={voice.id}
                              role="option"
                              aria-selected={isSelected}
                              tabIndex={0}
                              onClick={() => handleSelectVoice(voice)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleSelectVoice(voice);
                                }
                              }}
                              className={`group cursor-pointer rounded-2xl border p-4 transition-all ${
                                isSelected
                                  ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 shadow-lg ring-2 ring-emerald-200'
                                  : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-700">
                                    {voice.name}
                                  </h3>
                                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                                    {voice.description ?? 'Voz sintética pronta para suas locuções.'}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                <span
                                    className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                    voice.type === 'cloned'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                    {voice.type === 'cloned' ? 'Minha' : 'Padrão'}
                                </span>
                                  {voice.id.startsWith('virtual-') && (
                                    <span className="whitespace-nowrap rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700">
                                      Virtual
                                    </span>
                      )}
                    </div>
                  </div>
                              <div
                                className="mt-3"
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                              >
                                <ThemedAudioPlayer src={voice.previewUrl} variant="compact" />
                  </div>
                              <div className="mt-3 flex items-center justify-between gap-2">
                                {voice.type === 'cloned' && voice.owned && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteVoice(voice.id, voice.name);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100 hover:shadow-sm"
                                    title="Deletar voz clonada"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                                    Deletar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectVoice(voice);
                                  }}
                                  className={`ml-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md hover:shadow-lg'
                                      : 'border border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50'
                                  }`}
                                >
                                  {isSelected ? (
                                    <>
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                      Selecionada
                                    </>
                                  ) : (
                                    'Usar voz'
                                  )}
                                </button>
                  </div>
                </div>
                          );
                        })}
            </div>
          )}
      </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isMounted && isUploadModalOpen
        ? createPortal(
            <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4 py-6">
              <div className="absolute inset-0 bg-black/50" onClick={handleCloseUploadModal} aria-hidden="true" />
              <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Clonar voz</h3>
                    <p className="text-sm text-gray-500">Envie um áudio de referência e crie uma voz personalizada.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseUploadModal}
                    className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Fechar modal"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form className="space-y-5 px-6 py-6" onSubmit={handleUploadAudio}>
                  <div className="space-y-2">
                    <label htmlFor="clone-voice-name-upload" className="text-sm font-semibold text-gray-700">
                      Nome da voz
                    </label>
                    <input
                      id="clone-voice-name-upload"
                      type="text"
                      value={cloneVoiceName}
                      onChange={(event) => setCloneVoiceName(event.target.value)}
                      placeholder="Ex: Narrador Comercial"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      maxLength={80}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="clone-voice-description-upload" className="text-sm font-semibold text-gray-700">
                      Observações (opcional)
                    </label>
                    <textarea
                      id="clone-voice-description-upload"
                      value={cloneVoiceDescription}
                      onChange={(event) => setCloneVoiceDescription(event.target.value)}
                      placeholder="Descreva idioma, estilo ou detalhes importantes da voz."
                      rows={2}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      maxLength={240}
                    />
                  </div>

                  <div className="space-y-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4">
                    <p className="text-sm font-semibold text-emerald-700">Áudio de referência</p>
                    <p className="text-xs text-emerald-600">
                      Envie um áudio limpo de 30s a 5min nos formatos MP3, WAV ou M4A (máx. 10MB)
                    </p>
                    <input
                      ref={uploadFileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          setIsUploadingFile(true);
                          
                          // Verificar duração do áudio
                          try {
                            const audioElement = new Audio();
                            const objectUrl = URL.createObjectURL(file);
                            
                            await new Promise<void>((resolve, reject) => {
                              audioElement.addEventListener('loadedmetadata', () => {
                                const duration = audioElement.duration;
                                
                                if (duration < 30) {
                                  reject(new Error(`Áudio muito curto (${Math.floor(duration)}s). Mínimo: 30 segundos.`));
                                } else if (duration > 300) {
                                  reject(new Error(`Áudio muito longo (${Math.floor(duration)}s). Máximo: 5 minutos (300s).`));
                                } else {
                                  resolve();
                                }
                                
                                URL.revokeObjectURL(objectUrl);
                              });
                              
                              audioElement.addEventListener('error', () => {
                                reject(new Error('Não foi possível ler o arquivo de áudio.'));
                                URL.revokeObjectURL(objectUrl);
                              });
                              
                              audioElement.src = objectUrl;
                            });
                            
                            setUploadAudioFile(file);
                            setUploadAudioPreviewName(file.name);
                          } catch (error) {
                            await Swal.fire({
                              icon: 'error',
                              title: 'Arquivo inválido',
                              text: error instanceof Error ? error.message : 'Erro ao processar arquivo.',
                              confirmButtonColor: '#ef4444',
                            });
                            
                            if (uploadFileInputRef.current) {
                              uploadFileInputRef.current.value = '';
                            }
                          } finally {
                            setIsUploadingFile(false);
                          }
                        } else {
                          setUploadAudioFile(null);
                          setUploadAudioPreviewName(null);
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => uploadFileInputRef.current?.click()}
                        disabled={isUploadingFile}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUploadingFile ? (
                          <>
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Carregando...
                          </>
                        ) : (
                          <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Selecionar arquivo
                          </>
                        )}
                      </button>
                      {uploadAudioPreviewName ? (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                            {uploadAudioPreviewName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadAudioFile(null);
                              setUploadAudioPreviewName(null);
                              if (uploadFileInputRef.current) {
                                uploadFileInputRef.current.value = '';
                              }
                            }}
                            className="inline-flex items-center rounded-full border border-red-200 bg-red-50 p-1.5 text-red-600 transition hover:border-red-300 hover:bg-red-100"
                            title="Remover arquivo"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : !isUploadingFile && (
                        <span className="text-xs text-emerald-600">Nenhum arquivo selecionado</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCloseUploadModal}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isUploadingAudio}
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploadingAudio ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                          </svg>
                          Clonando...
                        </>
                      ) : (
                        'Clonar voz'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

    </AuthenticatedShell>
  );
}


