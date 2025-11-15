'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  memo,
} from 'react';
import type { ReactNode, VideoHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';
import Swal from 'sweetalert2';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import type { Profile } from '@/lib/profile';
import type { AvatarLibraryItem } from '@/lib/avatar-library';
import { getPlanLimits } from '@/lib/plan-limits';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type AvatarOption = AvatarLibraryItem & { createdAt?: string };

type AudioItem = {
  id: string;
  name: string;
  url: string;
  duration?: number; // Duração em segundos
  generatedByVoiceApi?: boolean; // Se foi gerado pela API de voz
};

type AvatarEntry = {
  id: string;
  avatar: AvatarOption;
  audio: AudioItem | null;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  taskId?: string;
};

type HistoryItem = {
  id: string;
  taskId: string;
  status: string;
  createdAt: string;
  localVideoPath: string | null;
  remoteVideoUrl: string | null;
  creditosUtilizados: number | null;
  avatarLabel: string;
  previewVideoUrl?: string | null; // URL do avatar para mostrar enquanto processa
};

interface AvatarVideoClientProps {
  initialProfile: Profile;
  userEmail: string;
  userId: string;
  builtinAvatars: AvatarOption[];
  userAvatars: AvatarOption[];
  userAudios: AudioItem[];
  initialHistory: HistoryItem[];
}

type UploadAvatarResponse = {
  avatar?: AvatarOption & { createdAt?: string };
};

type VideoThumbnailProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  src?: string | null;
  containerClassName?: string;
  videoClassName?: string;
  blurClassName?: string;
  showBlurBackground?: boolean;
  children?: ReactNode;
};

const ShimmerPlaceholder = ({ className }: { className?: string }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ''}`} style={{ zIndex: 0 }}>
    <div
      className="h-full w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-[avatarVideoShimmer_1.4s_linear_infinite]"
      style={{ backgroundSize: '200% 100%' }}
    />
  </div>
);

function VideoThumbnail({
  src,
  containerClassName,
  videoClassName,
  blurClassName,
  showBlurBackground = true,
  children,
  onLoadedData,
  onError,
  ...videoProps
}: VideoThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const normalizedSrc = src ?? undefined;

  const handleLoadedData: React.VideoHTMLAttributes<HTMLVideoElement>['onLoadedData'] = (event) => {
    setIsLoaded(true);
    onLoadedData?.(event);
  };

  const handleError: React.VideoHTMLAttributes<HTMLVideoElement>['onError'] = (event) => {
    setHasError(true);
    onError?.(event);
  };

  const showShimmer = !isLoaded || hasError || !src;

  const baseVideoClasses = videoClassName ?? 'object-cover';

  return (
    <div className={`relative overflow-hidden ${containerClassName ?? ''}`} style={{ borderRadius: 'inherit' }}>
      {showShimmer && <ShimmerPlaceholder />}

      {showBlurBackground && normalizedSrc ? (
        <video
          src={normalizedSrc}
          muted
          loop
          playsInline
          className={`absolute inset-0 h-full w-full object-cover blur-2xl transition-opacity duration-500 ${
            isLoaded && !hasError ? 'opacity-60' : 'opacity-0'
          } ${blurClassName ?? ''}`}
          style={{ zIndex: 5 }}
        />
      ) : null}

      {normalizedSrc ? (
        <video
          {...videoProps}
          src={normalizedSrc}
          onLoadedData={handleLoadedData}
          onError={handleError}
          className={`relative z-10 h-full w-full transition-opacity duration-500 ${
            isLoaded && !hasError ? 'opacity-100' : 'opacity-0'
          } ${baseVideoClasses}`}
        />
      ) : (
        <div className="relative z-10 flex h-full w-full items-center justify-center text-xs text-gray-400">
          Prévia indisponível
        </div>
      )}

      {children}
    </div>
  );
}

const DEFAULT_AVATAR_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET?.trim() || 'avatars';

function resolveClientFileExtension(name: string, fallback: string) {
  if (!name) return fallback;
  const trimmed = name.trim();
  const dotIndex = trimmed.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return fallback;
  }
  return trimmed.slice(dotIndex + 1).toLowerCase();
}

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 4000;

const createClientId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

// Componente memoizado para thumbnail de vídeo no histórico
const VideoHistoryCard = memo(function VideoHistoryCard({ 
  item, 
  isRecentlyCompleted,
  onDelete,
  onClick,
}: { 
  item: HistoryItem;
  isRecentlyCompleted: boolean;
  onDelete: (id: string) => void;
  onClick: (item: HistoryItem) => void;
}) {
  const isProcessing = item.status === 'processing' || item.status === 'pending';
  const videoUrl = item.localVideoPath || item.remoteVideoUrl || item.previewVideoUrl;

  return (
    <div
      className={`group relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-sm transition hover:shadow-md ${
        isProcessing ? 'processing-video' : ''
      }`}
    >
      {/* Thumbnail/Preview */}
      <button
        type="button"
        onClick={() => onClick(item)}
        className="relative h-full w-full"
        disabled={isProcessing}
      >
        <VideoThumbnail
          src={videoUrl}
          muted
          loop
          autoPlay={isProcessing}
          playsInline
          containerClassName="h-full w-full"
          videoClassName={`h-full w-full object-cover ${isProcessing ? 'opacity-30' : ''}`}
        />
        
        {/* Loading spinner for processing videos */}
        {isProcessing && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900/70 backdrop-blur-[2px]">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/10 border-t-emerald-400"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="h-8 w-8 text-emerald-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
          </div>
        )}
        
        {/* Play button overlay for completed videos - sempre visível */}
        {!isProcessing && item.status === 'completed' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <svg className="h-8 w-8 text-gray-900 ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </button>
      
      {/* Badge de status */}
      {(isRecentlyCompleted || item.status === 'failed') && (
        <span
          className={`absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            item.status === 'completed'
              ? 'bg-emerald-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}
        >
          {item.status === 'completed' ? 'Novo' : 'Falhou'}
        </span>
      )}
      
      {/* Botão de download - só aparece ao passar o mouse */}
      {item.status === 'completed' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/api/video/download?id=${item.id}`;
          }}
          className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/90 text-white shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-emerald-600"
          aria-label="Baixar vídeo"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      )}
      
      {/* Botão de deletar - só aparece ao passar o mouse - posicionado abaixo do download */}
      {item.status === 'completed' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="absolute right-2 top-12 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90 text-white shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
          aria-label="Deletar vídeo"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
});

export default function AvatarVideoClient({
  initialProfile,
  userEmail,
  userId,
  builtinAvatars,
  userAvatars,
  userAudios,
  initialHistory,
}: AvatarVideoClientProps) {
  const [uploadedAvatars, setUploadedAvatars] = useState<AvatarOption[]>(userAvatars);
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch (error) {
      console.error('Falha ao criar cliente Supabase no navegador:', error);
      return null;
    }
  }, []);
  const avatarBucket = DEFAULT_AVATAR_BUCKET;
  const avatarUploadProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const avatarUploadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null);
  
  const audioUploadProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUploadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [audioUploadProgress, setAudioUploadProgress] = useState<number | null>(null);

  const clearAvatarUploadTimers = useCallback(() => {
    if (avatarUploadProgressRef.current) {
      clearInterval(avatarUploadProgressRef.current);
      avatarUploadProgressRef.current = null;
    }
    if (avatarUploadTimeoutRef.current) {
      clearTimeout(avatarUploadTimeoutRef.current);
      avatarUploadTimeoutRef.current = null;
    }
  }, []);

  const startAvatarUploadProgress = useCallback(() => {
    clearAvatarUploadTimers();
    setAvatarUploadProgress(5);

    avatarUploadProgressRef.current = setInterval(() => {
      setAvatarUploadProgress((prev) => {
        if (prev === null || prev >= 95) {
          return prev;
        }
        const increment = Math.random() * 9 + 4; // 4% - 13%
        const nextValue = Math.min(95, Math.round(prev + increment));
        return nextValue === prev ? prev + 1 : nextValue;
      });
    }, 600);
  }, [clearAvatarUploadTimers]);

  const finishAvatarUploadProgress = useCallback(
    (finalValue: number) => {
      clearAvatarUploadTimers();

      setAvatarUploadProgress((prev) => {
        const target = Math.max(0, Math.min(100, Math.round(finalValue)));
        if (prev === null && target === 0) {
          return target;
        }
        return target;
      });

      avatarUploadTimeoutRef.current = setTimeout(() => {
        setAvatarUploadProgress(null);
        avatarUploadTimeoutRef.current = null;
      }, finalValue >= 100 ? 1200 : 1800);
    },
    [clearAvatarUploadTimers],
  );

  const clearAudioUploadTimers = useCallback(() => {
    if (audioUploadProgressRef.current) {
      clearInterval(audioUploadProgressRef.current);
      audioUploadProgressRef.current = null;
    }
    if (audioUploadTimeoutRef.current) {
      clearTimeout(audioUploadTimeoutRef.current);
      audioUploadTimeoutRef.current = null;
    }
  }, []);

  const startAudioUploadProgress = useCallback(() => {
    clearAudioUploadTimers();
    setAudioUploadProgress(5);

    audioUploadProgressRef.current = setInterval(() => {
      setAudioUploadProgress((prev) => {
        if (prev === null || prev >= 95) {
          return prev;
        }
        const increment = Math.random() * 9 + 4; // 4% - 13%
        const nextValue = Math.min(95, Math.round(prev + increment));
        return nextValue === prev ? prev + 1 : nextValue;
      });
    }, 600);
  }, [clearAudioUploadTimers]);

  const finishAudioUploadProgress = useCallback(
    (finalValue: number) => {
      clearAudioUploadTimers();

      setAudioUploadProgress((prev) => {
        const target = Math.max(0, Math.min(100, Math.round(finalValue)));
        if (prev === null && target === 0) {
          return target;
        }
        return target;
      });

      audioUploadTimeoutRef.current = setTimeout(() => {
        setAudioUploadProgress(null);
        audioUploadTimeoutRef.current = null;
      }, finalValue >= 100 ? 1200 : 1800);
    },
    [clearAudioUploadTimers],
  );

  useEffect(() => {
    return () => {
      if (avatarUploadProgressRef.current) {
        clearInterval(avatarUploadProgressRef.current);
        avatarUploadProgressRef.current = null;
      }
      if (avatarUploadTimeoutRef.current) {
        clearTimeout(avatarUploadTimeoutRef.current);
        avatarUploadTimeoutRef.current = null;
      }
      if (audioUploadProgressRef.current) {
        clearInterval(audioUploadProgressRef.current);
        audioUploadProgressRef.current = null;
      }
      if (audioUploadTimeoutRef.current) {
        clearTimeout(audioUploadTimeoutRef.current);
        audioUploadTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Carregar avatares selecionados do localStorage
  const [selectedEntries, setSelectedEntries] = useState<AvatarEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('selectedAvatarEntries');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Erro ao carregar avatares salvos:', error);
    }
    return [];
  });
  
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [audioLibrary, setAudioLibrary] = useState<AudioItem[]>(userAudios);
  const [audioLibraryFilter, setAudioLibraryFilter] = useState<'all' | 'uploaded' | 'generated'>('all');
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarModalSelection, setAvatarModalSelection] = useState<Set<string>>(new Set());
  const [avatarModalTab, setAvatarModalTab] = useState<'builtin' | 'user'>('builtin');

  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [pendingAudioEntryId, setPendingAudioEntryId] = useState<string | null>(null);
  const [selectedAudioIds, setSelectedAudioIds] = useState<Set<string>>(new Set());
  const [isDeletingAudios, setIsDeletingAudios] = useState(false);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadingAudioForEntry, setUploadingAudioForEntry] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarModalError, setAvatarModalError] = useState<string | null>(null);
  const [, setProcessingTaskIds] = useState<Set<string>>(new Set());
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState(false);
  const [videoModalItem, setVideoModalItem] = useState<HistoryItem | null>(null);

  // Garantir que está no cliente antes de usar Portal
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const avatarUploadInputRef = useRef<HTMLInputElement>(null);
  const audioUploadInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLElement>(null);

  const allAvatars = useMemo<AvatarOption[]>(() => {
    const uploadedIds = new Set(uploadedAvatars.map((avatar) => avatar.id));
    const filteredBuiltin = builtinAvatars.filter((avatar) => !uploadedIds.has(avatar.id));
    return [...uploadedAvatars, ...filteredBuiltin];
  }, [uploadedAvatars, builtinAvatars]);

  // Filtrar áudios com base na aba selecionada
  const filteredAudioLibrary = useMemo(() => {
    if (audioLibraryFilter === 'all') {
      return audioLibrary;
    }
    if (audioLibraryFilter === 'uploaded') {
      return audioLibrary.filter((audio) => !audio.generatedByVoiceApi);
    }
    if (audioLibraryFilter === 'generated') {
      return audioLibrary.filter((audio) => audio.generatedByVoiceApi);
    }
    return audioLibrary;
  }, [audioLibrary, audioLibraryFilter]);



  useEffect(() => {
    if (selectedEntries.length === 0) {
      setActiveEntryId(null);
      return;
    }
    if (!activeEntryId || !selectedEntries.some((entry) => entry.id === activeEntryId)) {
      setActiveEntryId(selectedEntries[0].id);
    }
  }, [selectedEntries, activeEntryId]);

  // Salvar avatares selecionados no localStorage sempre que mudar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (selectedEntries.length > 0) {
        localStorage.setItem('selectedAvatarEntries', JSON.stringify(selectedEntries));
      } else {
        localStorage.removeItem('selectedAvatarEntries');
      }
    } catch (error) {
      console.warn('Erro ao salvar avatares selecionados:', error);
    }
  }, [selectedEntries]);

  // Verificar vídeos em processamento ao carregar a página
  useEffect(() => {
    const processingVideos = initialHistory.filter(
      (item) => item.status === 'processing' || item.status === 'pending'
    );

    if (processingVideos.length > 0) {
      const taskIds = new Set(processingVideos.map((v) => v.taskId));
      setProcessingTaskIds(taskIds);

      // Criar uma função local para evitar dependência circular
      const resumePolling = async (taskId: string, videoId: string, label: string) => {
        setProcessingTaskIds((prev) => new Set(prev).add(taskId));
        let attempt = 0;

        try {
          while (attempt < MAX_POLL_ATTEMPTS) {
            attempt += 1;
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

            const response = await fetch('/api/lipsync/poll', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId }),
            });

            if (!response.ok) continue;

            const payload = await response.json();

            if (payload.status === 'processing' || payload.status === 'unknown') {
              setStatusMessage(`Gerando "${label}"...`);
              setHistory((prev) =>
                prev.map((item) =>
                  item.taskId === taskId ? { ...item, status: 'processing' } : item
                )
              );
              continue;
            }

            if (payload.status === 'completed') {
              const record = payload.record;
              const historyItem: HistoryItem = {
                id: record?.id ?? videoId,
                taskId,
                status: 'completed',
                createdAt: record?.created_at ?? new Date().toISOString(),
                localVideoPath: record?.local_video_path ?? null,
                remoteVideoUrl: record?.remote_video_url ?? null,
                creditosUtilizados: record?.creditos_utilizados ?? null,
                avatarLabel: label,
              };

              setHistory((prev) => {
                const filtered = prev.filter((item) => item.taskId !== taskId);
                return [historyItem, ...filtered];
              });

              // Marcar como recém-concluído (1 minuto)
              setRecentlyCompleted((prev) => new Set(prev).add(taskId));
              setTimeout(() => {
                setRecentlyCompleted((prev) => {
                  const next = new Set(prev);
                  next.delete(taskId);
                  return next;
                });
              }, 60000);

              if (payload.creditsUsed && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('creditsDeducted', { 
                  detail: { amount: payload.creditsUsed } 
                }));
              }
              
              
              return;
            }

            if (payload.status === 'failed') {
              // Remover vídeo falho do histórico (não mostrar)
              setHistory((prev) => prev.filter((item) => item.taskId !== taskId));
              
              // Disparar evento para atualizar créditos na interface se houver reembolso
              const creditsRefunded = payload.creditsRefunded || 0;
              if (creditsRefunded > 0) {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('creditsDeducted', { 
                    detail: { amount: -creditsRefunded } // Negativo para adicionar
                  }));
                }
              }
              
              return;
            }
          }
        } finally {
          setProcessingTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
        }
      };

      // Iniciar polling para cada vídeo em processamento
      processingVideos.forEach((video) => {
        resumePolling(video.taskId, video.id, video.avatarLabel || 'Avatar');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas ao montar

  const updateEntry = useCallback(
    (entryId: string, updater: (entry: AvatarEntry) => AvatarEntry) => {
      setSelectedEntries((prev) =>
        prev.map((entry) => (entry.id === entryId ? updater(entry) : entry)),
      );
    },
    [],
  );

  const toAbsoluteUrl = useCallback((url: string) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (typeof window === 'undefined') return url;
    return url.startsWith('/') ? `${window.location.origin}${url}` : `${window.location.origin}/${url}`;
  }, []);

  const getAvatarById = useCallback(
    (avatarId: string) => allAvatars.find((avatar) => avatar.id === avatarId) ?? null,
    [allAvatars],
  );

  const openAvatarModal = useCallback(() => {
    const selection = new Set(selectedEntries.map((entry) => entry.avatar.id));
    setAvatarModalSelection(selection);
    setIsAvatarModalOpen(true);
    setErrorMessage(null);
    setAvatarModalError(null);
    
    // Notificar que um modal foi aberto (para fechar o menu do header)
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new Event('modalOpened'));
    }
  }, [selectedEntries]);

  const toggleAvatarSelection = useCallback((avatarId: string) => {
    setAvatarModalSelection((prev) => {
      const next = new Set(prev);
      if (next.has(avatarId)) {
        next.delete(avatarId);
      } else {
        next.add(avatarId);
      }
      return next;
    });
  }, []);

  const confirmAvatarSelection = useCallback(() => {
    const selectedIds = Array.from(avatarModalSelection);
    setSelectedEntries((prev) => {
      const existingMap = new Map(prev.map((entry) => [entry.avatar.id, entry]));
      const nextEntries: AvatarEntry[] = [];

      selectedIds.forEach((avatarId) => {
        const existing = existingMap.get(avatarId);
        if (existing) {
          nextEntries.push(existing);
          return;
        }
        const avatar = getAvatarById(avatarId);
        if (!avatar) return;
        nextEntries.push({
          id: createClientId(),
          avatar,
          audio: null,
          status: 'idle',
        });
      });

      return nextEntries;
    });
    setIsAvatarModalOpen(false);
  }, [avatarModalSelection, getAvatarById]);

  const removeEntry = useCallback((entryId: string) => {
    setSelectedEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  }, []);

  const assignAudioToEntry = useCallback(
    (entryId: string, audio: AudioItem | null) => {
      updateEntry(entryId, (entry) => ({
        ...entry,
        audio,
        status: audio ? entry.status : 'idle',
        taskId: audio ? entry.taskId : undefined,
      }));
    },
    [updateEntry],
  );

  const uploadAvatarFile = useCallback(
    async (file: File) => {
      setAvatarModalError(null);

      const planLimits = getPlanLimits(initialProfile.plan);

      if (planLimits.maxUploadsAvatars !== null && uploadedAvatars.length >= planLimits.maxUploadsAvatars) {
        setAvatarModalError(
          `Seu plano ${initialProfile.plan.toUpperCase()} permite até ${planLimits.maxUploadsAvatars} avatar(es) personalizado(s). Faça upgrade para enviar mais.`,
        );
        return;
      }

      const maxSizeBytes = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSizeBytes) {
        setAvatarModalError(
          `O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). O tamanho máximo permitido é 50MB.`,
        );
        return;
      }

      startAvatarUploadProgress();
      setIsUploadingAvatar(true);

      const extension = resolveClientFileExtension(file.name, 'mp4');
      let responsePayload: UploadAvatarResponse | null = null;
      let directUploadError: Error | null = null;

      try {
        if (supabase && userId) {
          try {
            const fileId =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : createClientId();
            const storagePath = `${userId}/${fileId}.${extension}`;
            const contentType = file.type || `video/${extension}`;

            const { error: uploadError } = await supabase.storage.from(avatarBucket).upload(storagePath, file, {
              cacheControl: '3600',
              contentType,
              upsert: false,
            });

            if (uploadError) {
              throw uploadError;
            }

            const { data: publicUrlResult } = supabase.storage.from(avatarBucket).getPublicUrl(storagePath);
            const publicUrl = publicUrlResult.publicUrl;

            const registerResponse = await fetch('/api/avatar/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                strategy: 'direct',
                fileId,
                storagePath,
                storageBucket: avatarBucket,
                publicUrl,
                originalFilename: file.name,
                contentType,
              }),
            });

            const registerPayload = (await registerResponse.json().catch(() => null)) as
              | UploadAvatarResponse
              | { error?: string }
              | null;

            if (!registerResponse.ok) {
              const errorMessage =
                (registerPayload as { error?: string } | null)?.error ?? 'Falha ao registrar avatar após upload.';
              throw new Error(errorMessage);
            }

            if (!registerPayload || !(registerPayload as UploadAvatarResponse).avatar) {
              throw new Error('Resposta inesperada ao registrar o avatar.');
            }

            responsePayload = registerPayload as UploadAvatarResponse;
          } catch (error) {
            directUploadError =
              error instanceof Error ? error : new Error('Falha desconhecida ao enviar avatar diretamente.');
            console.warn('Upload direto do avatar falhou. Tentando fallback via API.', directUploadError);
          }
        }

        if (!responsePayload) {
          const formData = new FormData();
          formData.append('file', file);

          const fallbackResponse = await fetch('/api/avatar/upload', {
            method: 'POST',
            body: formData,
          });

          const fallbackPayload = (await fallbackResponse.json().catch(() => null)) as
            | UploadAvatarResponse
            | { error?: string }
            | null;

          if (!fallbackResponse.ok) {
            const fallbackMessage =
              (fallbackPayload as { error?: string } | null)?.error ??
              directUploadError?.message ??
              'Não foi possível enviar o avatar.';
            throw new Error(fallbackMessage);
          }

          responsePayload = fallbackPayload as UploadAvatarResponse;
        }

        const avatar = responsePayload?.avatar;
        if (!avatar) {
          throw new Error('Resposta inesperada ao enviar avatar.');
        }

        setUploadedAvatars((prev) => [avatar, ...prev]);
        setAvatarModalSelection((prev) => {
          const next = new Set(prev);
          next.add(avatar.id);
          return next;
        });
        finishAvatarUploadProgress(100);
        setAvatarModalError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao enviar avatar.';
        setAvatarModalError(message);
        finishAvatarUploadProgress(0);
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [
      avatarBucket,
      finishAvatarUploadProgress,
      initialProfile.plan,
      startAvatarUploadProgress,
      supabase,
      uploadedAvatars.length,
      userId,
    ],
  );

  const getAudioDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        // Truncar (descartar decimais) - 11.8 vira 11
        const duration = Math.floor(audio.duration);
        console.log('🎵 Duração do áudio:', {
          fileName: file.name,
          durationRaw: audio.duration,
          durationTruncated: duration,
        });
        resolve(duration);
      });
      audio.addEventListener('error', () => {
        console.warn('⚠️ Não foi possível ler duração do áudio:', file.name);
        resolve(0); // Se falhar, retorna 0
      });
      audio.src = URL.createObjectURL(file);
    });
  }, []);

  const uploadAudioFile = useCallback(
    async (file: File, targetEntryId: string) => {
      if (!targetEntryId) {
        setErrorMessage('Selecione um avatar antes de enviar o áudio.');
        throw new Error('Entrada nao selecionada');
      }

      // Validar tamanho do arquivo no cliente (100MB - limite maior para Supabase)
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        const errorMsg = `Arquivo muito grande (${sizeMB}MB). O tamanho máximo é 100MB. Comprima o áudio ou use um arquivo menor.`;
        setErrorMessage(errorMsg);
        await Swal.fire({
          title: 'Arquivo muito grande',
          html: `
            <div style="text-align: left;">
              <p><strong>Tamanho do arquivo:</strong> ${sizeMB}MB</p>
              <p><strong>Tamanho máximo:</strong> 100MB</p>
              <br>
              <p>💡 <strong>Sugestões:</strong></p>
              <ul style="text-align: left; margin-left: 20px;">
                <li>Use um conversor online para reduzir o tamanho</li>
                <li>Reduza a taxa de bits (bitrate) do áudio</li>
                <li>Converta para MP3 com qualidade menor</li>
              </ul>
            </div>
          `,
          icon: 'error',
          confirmButtonText: 'Entendi',
          confirmButtonColor: '#10b981',
        });
        throw new Error(errorMsg);
      }

      // Calcular duração do áudio
      const audioDuration = await getAudioDuration(file);

      startAudioUploadProgress();
      setUploadingAudioForEntry(targetEntryId);
      setErrorMessage(null);
      
      try {
        // UPLOAD DIRETO PARA SUPABASE STORAGE (sem passar pelo Next.js)
        if (supabase && userId) {
          const fileId = createClientId();
          const extension = resolveClientFileExtension(file.name, 'mp3');
          const audioBucket = process.env.NEXT_PUBLIC_SUPABASE_AUDIO_BUCKET?.trim() || 'audio';
          const storagePath = `${userId}/${fileId}.${extension}`;
          const contentType = file.type || `audio/${extension}`;

          console.log('📤 Upload direto para Supabase Storage:', {
            nome: file.name,
            tamanho: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
            bucket: audioBucket,
            path: storagePath,
          });

          // Upload direto do cliente para Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from(audioBucket)
            .upload(storagePath, file, {
              cacheControl: '3600',
              contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error('❌ Erro no upload direto:', uploadError);
            throw new Error(uploadError.message || 'Falha ao enviar áudio para o storage');
          }

          // Obter URL pública
          const { data: publicUrlResult } = supabase.storage
            .from(audioBucket)
            .getPublicUrl(storagePath);
          
          const publicUrl = publicUrlResult.publicUrl;

          // Registrar no banco via API
          const registerResponse = await fetch('/api/audio/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              strategy: 'direct',
              fileId,
              storagePath,
              storageBucket: audioBucket,
              publicUrl,
              originalFilename: file.name,
              contentType,
              extension,
            }),
          });

          if (!registerResponse.ok) {
            const payload = await registerResponse.json().catch(() => ({}));
            throw new Error(payload.error ?? 'Não foi possível registrar o áudio.');
          }

          const payload = await registerResponse.json();

          if (!payload.audio?.url) {
            throw new Error('Resposta inesperada ao registrar áudio.');
          }

          const audio: AudioItem = {
            id: payload.audio.id,
            name: payload.audio.name,
            url: payload.audio.url,
            duration: audioDuration,
          };

          setAudioLibrary((prev) => {
            if (prev.some((item) => item.id === audio.id)) {
              return prev;
            }
            return [audio, ...prev];
          });

          assignAudioToEntry(targetEntryId, audio);
          setPendingAudioEntryId(null);
          setIsAudioModalOpen(false);
          finishAudioUploadProgress(100);
          return;
        }

        // FALLBACK: Upload via FormData (para arquivos menores)
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/audio/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const errorMessage = payload.error ?? 'Não foi possível enviar o áudio.';
          const errorDetails = payload.details ?? '';
          
          // Mostrar erro detalhado se disponível
          if (errorDetails) {
            await Swal.fire({
              title: 'Erro no upload',
              html: `
                <div style="text-align: left;">
                  <p><strong>Erro:</strong> ${errorMessage}</p>
                  <p><strong>Detalhes:</strong> ${errorDetails}</p>
                </div>
              `,
              icon: 'error',
              confirmButtonText: 'Entendi',
              confirmButtonColor: '#10b981',
            });
          }
          
          throw new Error(errorMessage);
        }

        const payload = (await response.json()) as {
          audio: { id: string; url: string; name: string };
        };

        if (!payload.audio?.url) {
          throw new Error('Resposta inesperada ao enviar áudio.');
        }

        const audio: AudioItem = {
          id: payload.audio.id,
          name: payload.audio.name,
          url: payload.audio.url,
          duration: audioDuration,
        };

        setAudioLibrary((prev) => {
          if (prev.some((item) => item.id === audio.id)) {
            return prev;
          }
          return [audio, ...prev];
        });

        assignAudioToEntry(targetEntryId, audio);
        setPendingAudioEntryId(null);
        setIsAudioModalOpen(false);
        finishAudioUploadProgress(100);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao enviar áudio.';
        setErrorMessage(message);
        finishAudioUploadProgress(0);
        throw error;
      } finally {
        setUploadingAudioForEntry(null);
      }
    },
    [assignAudioToEntry, getAudioDuration, startAudioUploadProgress, finishAudioUploadProgress, supabase, userId],
  );

  const handleAvatarFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await uploadAvatarFile(file);
      } finally {
        event.target.value = '';
      }
    },
    [uploadAvatarFile],
  );

  const handleAudioFileInput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const targetEntryId = pendingAudioEntryId ?? activeEntryId;
      if (!targetEntryId) {
        setErrorMessage('Selecione um avatar antes de enviar o áudio.');
        event.target.value = '';
        return;
      }
      try {
        await uploadAudioFile(file, targetEntryId);
      } finally {
        event.target.value = '';
      }
    },
    [uploadAudioFile, pendingAudioEntryId, activeEntryId],
  );


  const getAudioDurationFromUrl = useCallback((url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener('loadedmetadata', () => {
        const duration = Math.floor(audio.duration);
        resolve(duration);
      });
      audio.addEventListener('error', () => {
        resolve(0);
      });
      audio.src = url;
    });
  }, []);

  const handleAudioSelection = useCallback(
    async (audioId: string) => {
      if (!pendingAudioEntryId) return;
      let audio = audioLibrary.find((item) => item.id === audioId);
      if (!audio) return;

      // Se o áudio não tem duração, calcular agora
      if (!audio.duration && audio.url) {
        const duration = await getAudioDurationFromUrl(audio.url);
        audio = { ...audio, duration };
        
        // Atualizar na biblioteca também
        setAudioLibrary((prev) =>
          prev.map((item) => (item.id === audioId ? { ...item, duration } : item))
        );
      }

      assignAudioToEntry(pendingAudioEntryId, audio);
      setIsAudioModalOpen(false);
      setPendingAudioEntryId(null);
    },
    [audioLibrary, pendingAudioEntryId, assignAudioToEntry, getAudioDurationFromUrl],
  );

  const pollTaskUntilComplete = useCallback(
    async (taskId: string, entryId: string, avatarLabel: string) => {
      setProcessingTaskIds((prev) => new Set(prev).add(taskId));
      let attempt = 0;

      try {
        while (attempt < MAX_POLL_ATTEMPTS) {
          attempt += 1;
          await new Promise((resolve) =>
            setTimeout(resolve, attempt === 1 ? 2000 : POLL_INTERVAL_MS),
          );

          const response = await fetch('/api/lipsync/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error ?? 'Falha ao consultar o status da task.');
          }

          const payload = (await response.json()) as {
            status: 'processing' | 'failed' | 'completed' | 'unknown';
            reason?: string | null;
            videoUrl?: string;
            remoteVideoUrl?: string;
            creditsUsed?: number;
            record?: {
              id: string;
              task_id: string;
              status: string;
              created_at: string;
              local_video_path: string | null;
              remote_video_url: string | null;
              creditos_utilizados: number | null;
            } | null;
          };

          if (payload.status === 'processing' || payload.status === 'unknown') {
            setStatusMessage(`Gerando "${avatarLabel}"...`);
            
            // Atualizar histórico com status processing
            setHistory((prev) =>
              prev.map((item) =>
                item.taskId === taskId ? { ...item, status: 'processing' } : item
              )
            );
            continue;
          }

          if (payload.status === 'failed') {
            updateEntry(entryId, (entry) => ({ ...entry, status: 'failed' }));
            setHistory((prev) =>
              prev.map((item) =>
                item.taskId === taskId ? { ...item, status: 'failed' } : item
              )
            );
            throw new Error(payload.reason ?? 'A geração do avatar falhou.');
          }

          const record = payload.record;

          const historyItem: HistoryItem = {
            id: record?.id ?? taskId,
            taskId,
            status: record?.status ?? 'completed',
            createdAt: record?.created_at ?? new Date().toISOString(),
            localVideoPath: record?.local_video_path ?? payload.videoUrl ?? null,
            remoteVideoUrl: record?.remote_video_url ?? payload.remoteVideoUrl ?? null,
            creditosUtilizados: record?.creditos_utilizados ?? payload.creditsUsed ?? null,
            avatarLabel,
          };

          setHistory((prev) => {
            const filtered = prev.filter((item) => item.taskId !== taskId);
            return [historyItem, ...filtered];
          });

          // Marcar como recém-concluído (para mostrar badge temporariamente)
          setRecentlyCompleted((prev) => new Set(prev).add(taskId));
          
          // Remover badge "Concluído" após 1 minuto (60 segundos)
          setTimeout(() => {
            setRecentlyCompleted((prev) => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
          }, 60000);

          updateEntry(entryId, (entry) => ({ ...entry, status: 'completed' }));
          setStatusMessage(`Avatar "${avatarLabel}" gerado com sucesso!`);
          
          // Emitir evento customizado para atualizar créditos em tempo real
          if (payload.creditsUsed && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('creditsDeducted', { 
              detail: { amount: payload.creditsUsed } 
            }));
          }
          
          return;
        }

        updateEntry(entryId, (entry) => ({ ...entry, status: 'failed' }));
        setHistory((prev) =>
          prev.map((item) =>
            item.taskId === taskId ? { ...item, status: 'failed' } : item
          )
        );
        throw new Error('Tempo limite ao processar o vídeo. Tente novamente em instantes.');
      } finally {
        setProcessingTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [setHistory, setStatusMessage, updateEntry],
  );

  const handleGenerate = useCallback(async () => {
    if (selectedEntries.length === 0) {
      setErrorMessage('Selecione pelo menos um avatar para gerar o vídeo.');
      return;
    }

    if (selectedEntries.some((entry) => !entry.audio)) {
      setErrorMessage('Atribua um áudio para cada avatar antes de gerar os vídeos.');
      return;
    }

    const entriesToProcess = selectedEntries.filter((entry) => entry.audio);
    
    // Verificar limites do plano
    const planLimits = getPlanLimits(initialProfile.plan);
    
    // Validar quantidade de processamentos
    if (entriesToProcess.length > planLimits.maxProcessamentos) {
      await Swal.fire({
        title: 'Limite do plano atingido',
        html: `Seu plano <strong>${initialProfile.plan.toUpperCase()}</strong> permite processar até <strong>${planLimits.maxProcessamentos}</strong> vídeo(s) simultaneamente.<br><br>Você selecionou <strong>${entriesToProcess.length}</strong> vídeos.`,
        icon: 'warning',
        confirmButtonText: 'Entendi',
      });
      return;
    }

    // Validar duração dos áudios
    const maxDuration = planLimits.maxDurationVideoSeg;
    const audiosExcedidos = entriesToProcess.filter((entry) => {
      const duration = entry.audio?.duration || 0;
      return duration > maxDuration;
    });

    if (audiosExcedidos.length > 0) {
      const listaExcedidos = audiosExcedidos
        .map((entry) => `• ${entry.avatar.label}: ${entry.audio?.duration || 0}s`)
        .join('<br>');
      
      await Swal.fire({
        title: 'Vídeos excedem o limite de tempo',
        html: `Seu plano <strong>${initialProfile.plan.toUpperCase()}</strong> permite vídeos de até <strong>${maxDuration} segundos</strong>.<br><br><strong>Áudios que excedem o limite:</strong><br>${listaExcedidos}<br><br>Faça upgrade ou use áudios mais curtos.`,
        icon: 'warning',
        confirmButtonText: 'Entendi',
      });
      return;
    }

    // VALIDAÇÃO CRÍTICA: Verificar se o usuário tem créditos suficientes
    // Calcular total de créditos necessários (duração + 1 por vídeo)
    let totalCreditsNeeded = 0;
    const creditosDetalhados = entriesToProcess.map((entry) => {
      const duration = entry.audio?.duration || 0;
      const credits = Math.max(1, duration + 1); // Mínimo 1 crédito, senão duração + 1
      totalCreditsNeeded += credits;
      return {
        avatar: entry.avatar.label,
        duration,
        credits
      };
    });

    // Créditos disponíveis do usuário
    const totalCreditsAvailable = initialProfile.credits + initialProfile.extraCredits;

    // Verificar se tem créditos suficientes
    if (totalCreditsNeeded > totalCreditsAvailable) {
      const detalhamento = creditosDetalhados
        .map((item) => `• ${item.avatar}: ${item.duration}s = ${item.credits} crédito${item.credits > 1 ? 's' : ''}`)
        .join('<br>');
      
      console.log('⚠️ Tentativa de gerar vídeo sem créditos suficientes:', {
        creditosNecessarios: totalCreditsNeeded,
        creditosDisponiveis: totalCreditsAvailable,
        deficit: totalCreditsNeeded - totalCreditsAvailable,
        detalhamento: creditosDetalhados
      });

      await Swal.fire({
        title: 'Créditos insuficientes',
        html: `
          <div style="text-align: left;">
            <p><strong>Créditos necessários:</strong> ${totalCreditsNeeded}</p>
            <p><strong>Seus créditos:</strong> ${totalCreditsAvailable}</p>
            <p><strong>Faltam:</strong> <span style="color: #ef4444;">${totalCreditsNeeded - totalCreditsAvailable} créditos</span></p>
            <br>
            <p><strong>Detalhamento:</strong></p>
            ${detalhamento}
            <br>
            <p style="margin-top: 12px;">Compre mais créditos para continuar.</p>
          </div>
        `,
        icon: 'error',
        confirmButtonText: 'Entendi',
        confirmButtonColor: '#10b981',
      });
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage(`Iniciando geração de ${entriesToProcess.length} vídeo(s)...`);

    // Processar TODOS os vídeos SIMULTANEAMENTE
    const processingPromises = entriesToProcess.map(async (entry) => {
      const audio = entry.audio;
      if (!audio) return;

      const tempId = createClientId();
      
      updateEntry(entry.id, (current) => ({ ...current, status: 'processing' }));
      try {
        // Iniciar geração na API Newport
        const response = await fetch('/api/lipsync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srcVideoUrl: toAbsoluteUrl(entry.avatar.videoUrl),
            audioUrl: toAbsoluteUrl(audio.url),
            estimatedDuration: audio.duration || 0,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          
          // Tratamento especial para erro de créditos insuficientes
          if (response.status === 403 && payload.error === 'Créditos insuficientes') {
            throw new Error('Créditos insuficientes! Por favor, recarregue a página e tente novamente.');
          }
          
          throw new Error(payload.error ?? 'Não foi possível iniciar a geração.');
        }

        const payload = (await response.json()) as { 
          taskId?: string; 
          creditsDeducted?: number;
          newBalance?: {
            creditos: number;
            creditos_extras: number;
            total: number;
          };
        };
        
        if (!payload.taskId) {
          throw new Error('Task criada, mas não recebemos o identificador.');
        }

        const taskId = payload.taskId;
        
        // Emitir evento para atualizar créditos na interface IMEDIATAMENTE
        if (payload.creditsDeducted && typeof window !== 'undefined') {
          console.log('💰 Créditos descontados imediatamente:', payload.creditsDeducted);
          window.dispatchEvent(new CustomEvent('creditsDeducted', { 
            detail: { amount: payload.creditsDeducted } 
          }));
        }
        updateEntry(entry.id, (current) => ({ ...current, taskId }));

        // Adicionar ao histórico IMEDIATAMENTE com status pending
        const pendingHistoryItem: HistoryItem = {
          id: tempId,
          taskId,
          status: 'processing',
          createdAt: new Date().toISOString(),
          localVideoPath: null,
          remoteVideoUrl: null,
          creditosUtilizados: null,
          avatarLabel: entry.avatar.label,
          previewVideoUrl: entry.avatar.videoUrl, // Mostrar preview do avatar
        };

        setHistory((prev) => {
          const newHistory = [pendingHistoryItem, ...prev];
          return newHistory;
        });

        // Scroll suave para o histórico após adicionar
        setTimeout(() => {
          historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

        // Iniciar polling (não bloqueia os outros)
        pollTaskUntilComplete(taskId, entry.id, entry.avatar.label);
      } catch (error) {
        updateEntry(entry.id, (current) => ({ ...current, status: 'failed' }));
        const message =
          error instanceof Error
            ? error.message
            : `Falha ao gerar "${entry.avatar.label}".`;
        setErrorMessage(message);
      }
    });

    // Aguardar TODAS as tasks serem criadas
    await Promise.all(processingPromises);

    setIsGenerating(false);
    setStatusMessage('Vídeos em processamento. Acompanhe no histórico abaixo.');
  }, [pollTaskUntilComplete, selectedEntries, toAbsoluteUrl, updateEntry, initialProfile.plan, initialProfile.credits, initialProfile.extraCredits]);

  const formatDateTime = useCallback((value: string) => {
    const date = new Date(value);
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }, []);

  const truncateText = useCallback((value: string, maxLength = 36) => {
    if (!value) return value;
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
  }, []);

  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return history.slice(startIndex, endIndex);
  }, [history, currentPage, itemsPerPage]);

  const plyrOptions = useMemo(() => ({
    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
    hideControls: true,
    clickToPlay: true,
  }), []);

  const totalPages = Math.ceil(history.length / itemsPerPage);

  const deleteUserAvatar = useCallback(async (avatarId: string) => {
    const result = await Swal.fire({
      title: 'Deletar avatar?',
      text: 'Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, deletar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) return;
    
    try {
      const response = await fetch('/api/avatar/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId }),
      });

      if (!response.ok) {
        throw new Error('Falha ao deletar avatar');
      }

      setUploadedAvatars((prev) => prev.filter((a) => a.id !== avatarId));
      setAvatarModalSelection((prev) => {
        const next = new Set(prev);
        next.delete(avatarId);
        return next;
      });

      await Swal.fire({
        title: 'Deletado!',
        text: 'Avatar removido com sucesso.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        timer: 2000,
      });
    } catch (error) {
      await Swal.fire({
        title: 'Erro!',
        text: error instanceof Error ? error.message : 'Erro ao deletar avatar',
        icon: 'error',
        confirmButtonColor: '#10b981',
      });
    }
  }, []);

  const deleteHistoryVideo = useCallback(async (videoId: string) => {
    const result = await Swal.fire({
      title: 'Deletar vídeo?',
      text: 'Esta ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, deletar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) return;
    
    try {
      const response = await fetch('/api/video/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });

      if (!response.ok) {
        throw new Error('Falha ao deletar vídeo');
      }

      setHistory((prev) => prev.filter((v) => v.id !== videoId));

      await Swal.fire({
        title: 'Deletado!',
        text: 'Vídeo removido com sucesso.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        timer: 2000,
      });
    } catch (error) {
      await Swal.fire({
        title: 'Erro!',
        text: error instanceof Error ? error.message : 'Erro ao deletar vídeo',
        icon: 'error',
        confirmButtonColor: '#10b981',
      });
    }
  }, []);

  const toggleAudioSelection = useCallback((audioId: string) => {
    setSelectedAudioIds((prev) => {
      const next = new Set(prev);
      if (next.has(audioId)) {
        next.delete(audioId);
      } else {
        next.add(audioId);
      }
      return next;
    });
  }, []);

  const toggleSelectAllAudios = useCallback(() => {
    if (selectedAudioIds.size === filteredAudioLibrary.length && filteredAudioLibrary.length > 0) {
      setSelectedAudioIds(new Set());
    } else {
      setSelectedAudioIds(new Set(filteredAudioLibrary.map((a) => a.id)));
    }
  }, [filteredAudioLibrary, selectedAudioIds.size]);

  const deleteSelectedAudios = useCallback(async (audioIdsToDelete?: string[]) => {
    const idsToDelete = audioIdsToDelete || Array.from(selectedAudioIds);
    
    if (idsToDelete.length === 0) return;
    
    const result = await Swal.fire({
      title: 'Deletar áudios?',
      text: `Você está prestes a deletar ${idsToDelete.length} áudio(s). Esta ação não pode ser desfeita.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sim, deletar',
      cancelButtonText: 'Cancelar',
    });

    if (!result.isConfirmed) return;
    
    setIsDeletingAudios(true);
    try {
      const response = await fetch('/api/audio/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioIds: idsToDelete }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao deletar áudios');
      }

      const idsSet = new Set(idsToDelete);
      setAudioLibrary((prev) => prev.filter((a) => !idsSet.has(a.id)));
      setSelectedAudioIds(new Set());

      await Swal.fire({
        title: 'Deletado!',
        text: `${idsToDelete.length} áudio(s) removido(s) com sucesso.`,
        icon: 'success',
        confirmButtonColor: '#10b981',
        timer: 2000,
      });
    } catch (error) {
      await Swal.fire({
        title: 'Erro!',
        text: error instanceof Error ? error.message : 'Erro ao deletar áudios',
        icon: 'error',
        confirmButtonColor: '#10b981',
      });
    } finally {
      setIsDeletingAudios(false);
    }
  }, [selectedAudioIds]);

  const renderUploadedAvatarsContent = useCallback(() => {
    return (
      <>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-800 sm:text-base">Meus avatares</h4>
            <p className="text-xs text-gray-500">Vídeos enviados por você ficam disponíveis apenas na sua conta.</p>
          </div>
          <button
            type="button"
            onClick={() => avatarUploadInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {isUploadingAvatar ? 'Enviando...' : 'Enviar avatar'}
          </button>
        </div>
        {avatarUploadProgress !== null ? (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                {avatarUploadProgress === 0 && !isUploadingAvatar ? 'Falha no envio' : 'Enviando avatar'}
              </span>
              <span className="font-semibold text-gray-800">{avatarUploadProgress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all duration-500 ${
                  avatarUploadProgress === 0 && !isUploadingAvatar
                    ? 'bg-red-400'
                    : 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-500'
                }`}
                style={{
                  width: `${Math.max(0, Math.min(100, avatarUploadProgress))}%`,
                }}
              />
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {uploadedAvatars.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              Nenhum avatar personalizado enviado ainda.
            </div>
          ) : (
            uploadedAvatars.map((avatar) => {
              const isSelected = avatarModalSelection.has(avatar.id);
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => toggleAvatarSelection(avatar.id)}
                  className={`relative overflow-hidden rounded-xl border transition sm:rounded-2xl ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-200'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  <VideoThumbnail
                    src={avatar.videoUrl}
                    muted
                    loop
                    autoPlay
                    playsInline
                    containerClassName="relative aspect-square w-full bg-gray-900"
                    videoClassName="object-contain"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteUserAvatar(avatar.id);
                      }}
                      className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white shadow-sm transition hover:bg-red-600 sm:h-8 sm:w-8"
                      aria-label="Deletar avatar"
                    >
                      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {isSelected ? (
                      <span className="absolute left-2 bottom-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg sm:left-3 sm:bottom-3 sm:h-8 sm:w-8">
                        <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M12.207 4.793a1 1 0 010 1.414L7.414 11l-.024.024a1 1 0 01-1.39-.024l-2-2a1 1 0 111.414-1.414L6.05 9.536l4.743-4.743a1 1 0 011.414 0z" />
                        </svg>
                      </span>
                    ) : null}
                  </VideoThumbnail>
                </button>
              );
            })
          )}
        </div>
      </>
    );
  }, [avatarModalSelection, avatarUploadProgress, isUploadingAvatar, uploadedAvatars, deleteUserAvatar, toggleAvatarSelection]);

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <style jsx global>{`
        @keyframes avatarVideoShimmer {
          0% {
            background-position: -120% 0;
          }
          100% {
            background-position: 220% 0;
          }
        }
      `}</style>
      <div className="space-y-6 px-4 sm:px-6 lg:space-y-8 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
              <p className="text-xs font-medium uppercase tracking-widest text-green-500 sm:text-sm">Avatar Vídeo</p>
              <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl lg:text-3xl">Criação de avatar em vídeo</h1>
              <p className="max-w-2xl text-xs text-gray-600 sm:text-sm">
                Selecione um ou mais avatares, vincule os respectivos áudios e gere vídeos com sincronização labial em poucos cliques.
              </p>
            </div>
          </div>
          {errorMessage ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856C19.403 19 20 18.403 20 17.657V6.343C20 5.597 19.403 5 18.657 5H5.343C4.597 5 4 5.597 4 6.343v11.314C4 18.403 4.597 19 5.343 19z" />
                </svg>
                {errorMessage}
              </span>
            </div>
          ) : null}
        </div>

        <input
          ref={avatarUploadInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/avi"
          className="hidden"
          onChange={handleAvatarFileInput}
        />
        <input
          ref={audioUploadInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioFileInput}
        />

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm sm:space-y-6 sm:rounded-3xl sm:p-6 lg:p-8">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Avatares selecionados</h2>
              <p className="text-sm text-gray-500">
                Vincule um áudio para cada avatar abaixo antes de iniciar a geração.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openAvatarModal}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Selecionar avatares
              </button>
            </div>
          </div>

          {selectedEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              Nenhum avatar selecionado ate o momento.
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {selectedEntries.map((entry) => {
                  const isActive = entry.id === activeEntryId;
                  const hasAudio = Boolean(entry.audio);
                  return (
                    <div
                      key={entry.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveEntryId(entry.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setActiveEntryId(entry.id);
                          event.preventDefault();
                        }
                      }}
                      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-lg ${
                        isActive
                          ? 'border-emerald-500 ring-2 ring-emerald-200'
                          : hasAudio
                            ? 'border-gray-200 hover:border-emerald-300'
                            : 'border-amber-300 hover:border-amber-400'
                      } ${isGenerating ? 'opacity-60 pointer-events-none' : ''}`}
                    >
                      {/* Vídeo do Avatar */}
                      <VideoThumbnail
                        src={entry.avatar.videoUrl}
                        muted
                        loop
                        autoPlay
                        playsInline
                        containerClassName="relative aspect-square w-full bg-gray-900"
                        videoClassName="object-contain transition duration-500 group-hover:scale-105"
                      >
                        {/* Botões de ação no vídeo */}
                        <div className="absolute right-2 top-2 z-20 flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedEntries((prev) => [
                                ...prev,
                                {
                                  id: createClientId(),
                                  avatar: entry.avatar,
                                  audio: null,
                                  status: 'idle',
                                },
                              ]);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-lg transition hover:bg-emerald-500 hover:text-white hover:scale-110"
                            aria-label="Duplicar avatar"
                            title="Duplicar"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeEntry(entry.id);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-lg transition hover:bg-red-500 hover:text-white hover:scale-110"
                            aria-label="Remover avatar"
                            title="Remover"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </VideoThumbnail>

                      {/* Conteúdo do Card */}
                      <div className="flex flex-1 flex-col p-4 space-y-3">
                        {/* Nome do Avatar */}
                        <div className="border-b border-gray-100 pb-2">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">
                            {entry.avatar.label}
                          </h3>
                        </div>

                        {/* Informações do Áudio */}
                        <div className="flex-1 space-y-2">
                          {entry.audio ? (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 mb-1">Áudio selecionado:</p>
                                  <p className="text-xs font-medium text-gray-900 truncate">
                                    {truncateText(entry.audio.name, 30)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    assignAudioToEntry(entry.id, null);
                                  }}
                                  className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 hover:border-red-300"
                                  aria-label="Remover áudio"
                                  title="Remover áudio"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              {/* Duração e Custo */}
                              <div className="flex items-center gap-3 pt-1">
                                {entry.audio.duration && (
                                  <>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                                      entry.audio.duration > getPlanLimits(initialProfile.plan).maxDurationVideoSeg
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {entry.audio.duration}s
                                    </span>
                                    <span 
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 cursor-help"
                                      title="Custo: 1 crédito por segundo"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
                                      </svg>
                                      {Math.max(1, entry.audio.duration + 1)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingAudioEntryId(entry.id);
                                setIsAudioModalOpen(true);
                                setErrorMessage(null);
                                if (typeof window !== 'undefined') {
                                  window.dispatchEvent(new Event('modalOpened'));
                                }
                              }}
                              className="w-full flex flex-col items-center justify-center h-16 rounded-lg border-2 border-dashed border-amber-200 bg-amber-50 transition hover:border-amber-300 hover:bg-amber-100 cursor-pointer group"
                            >
                              <svg className="h-6 w-6 text-amber-600 mb-1 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                              <p className="text-xs font-medium text-amber-700">Clique para selecionar áudio</p>
                            </button>
                          )}
                        </div>

                        {/* Barra de progresso de upload */}
                        {uploadingAudioForEntry === entry.id && audioUploadProgress !== null && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>Enviando áudio...</span>
                              <span className="font-semibold">{audioUploadProgress}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-500 transition-all duration-500"
                                style={{
                                  width: `${Math.max(0, Math.min(100, audioUploadProgress))}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Botão de Ação - Biblioteca */}
                        <div className="pt-2 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingAudioEntryId(entry.id);
                              setIsAudioModalOpen(true);
                              setErrorMessage(null);
                              if (typeof window !== 'undefined') {
                                window.dispatchEvent(new Event('modalOpened'));
                              }
                            }}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Biblioteca
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={
                    isGenerating ||
                    selectedEntries.length === 0 ||
                    selectedEntries.some((entry) => !entry.audio)
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      Gerando vídeos...
                    </>
                  ) : (
                    'Gerar vídeos'
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        <section ref={historyRef} className="space-y-4 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm sm:space-y-6 sm:rounded-3xl sm:p-6 lg:p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Histórico</h2>
              <p className="text-sm text-gray-500">
                Os vídeos gerados permanecem disponíveis para download por 24 horas.
              </p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              Nenhum vídeo gerado até agora.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                {paginatedHistory.map((item) => (
                  <VideoHistoryCard
                    key={item.id}
                    item={item}
                    isRecentlyCompleted={item.status === 'completed' && recentlyCompleted.has(item.taskId)}
                    onDelete={deleteHistoryVideo}
                    onClick={(item) => {
                      if (item.status === 'completed') {
                        setVideoModalItem(item);
                      }
                    }}
                  />
                ))}
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                      currentPage === page
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:text-emerald-600'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:border-emerald-200 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : null}
          </>
          )}
        </section>

      </div>


      {isMounted && isAvatarModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsAvatarModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="border-b border-gray-100 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-gray-900 sm:text-lg">Selecionar avatares</h3>
                  <p className="text-xs text-gray-500 sm:text-sm">
                    Escolha os avatares que deseja incluir na geração.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarModalOpen(false);
                    setAvatarModalError(null);
                  }}
                  className="flex-shrink-0 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900 sm:px-4 sm:py-2"
                >
                  Fechar
                </button>
              </div>
              
              {avatarModalError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 sm:px-4 sm:py-3 sm:text-sm">
                  <div className="flex items-start gap-2">
                    <svg className="h-4 w-4 flex-shrink-0 text-red-600 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{avatarModalError}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-b border-gray-100 px-4 sm:px-6">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setAvatarModalTab('builtin')}
                  className={`px-4 py-2.5 text-xs font-semibold transition sm:px-6 sm:py-3 sm:text-sm ${
                    avatarModalTab === 'builtin'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Biblioteca padrão
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarModalTab('user')}
                  className={`px-4 py-2.5 text-xs font-semibold transition sm:px-6 sm:py-3 sm:text-sm ${
                    avatarModalTab === 'user'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Meus avatares
                </button>
              </div>
            </div>

            <div className="h-[65vh] overflow-y-auto sm:h-[60vh]">
              {avatarModalTab === 'builtin' ? (
                <div className="grid grid-cols-2 gap-3 px-3 py-4 sm:gap-4 sm:px-6 sm:py-6 md:grid-cols-3 lg:grid-cols-4">
                  {builtinAvatars.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => toggleAvatarSelection(avatar.id)}
                        className={`group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md sm:rounded-2xl ${
                          avatarModalSelection.has(avatar.id)
                            ? 'border-emerald-400 ring-2 ring-emerald-200'
                            : ''
                        }`}
                      >
                        <VideoThumbnail
                          src={avatar.videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          containerClassName="relative aspect-square w-full bg-gray-900"
                          videoClassName="object-contain opacity-90 transition duration-500 group-hover:opacity-100"
                        />

                        {avatarModalSelection.has(avatar.id) ? (
                          <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg sm:h-8 sm:w-8 z-20">
                            <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M12.207 4.793a1 1 0 010 1.414L7.414 11l-.024.024a1 1 0 01-1.39-.024l-2-2a1 1 0 111.414-1.414L6.05 9.536l4.743-4.743a1 1 0 011.414 0z" />
                            </svg>
                          </span>
                        ) : null}
                      </button>
                    ))}
                </div>
              ) : (
                <div className="px-3 py-4 sm:px-6 sm:py-6">
                  {renderUploadedAvatarsContent()}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500 sm:text-sm">
                  {`Selecionados: ${avatarModalSelection.size}`}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarModalOpen(false);
                      setAvatarModalError(null);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 sm:px-5"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmAvatarSelection}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:py-2.5"
                    disabled={avatarModalSelection.size === 0}
                  >
                    Confirmar seleção
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isMounted && isAudioModalOpen && pendingAudioEntryId && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsAudioModalOpen(false);
              setPendingAudioEntryId(null);
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 mx-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:mx-0 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Biblioteca de áudio</h3>
                <p className="text-xs text-gray-500">
                  Selecione um áudio para vincular ou gerencie seus arquivos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAudioModalOpen(false);
                  setPendingAudioEntryId(null);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
              >
                Fechar
              </button>
            </div>

            {/* Abas de Filtro */}
            <div className="border-b border-gray-100 px-6 pt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAudioLibraryFilter('all')}
                  className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                    audioLibraryFilter === 'all'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Todos ({audioLibrary.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAudioLibraryFilter('uploaded')}
                  className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                    audioLibraryFilter === 'uploaded'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Upload ({audioLibrary.filter((a) => !a.generatedByVoiceApi).length})
                </button>
                <button
                  type="button"
                  onClick={() => setAudioLibraryFilter('generated')}
                  className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
                    audioLibraryFilter === 'generated'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Gerados Buua ({audioLibrary.filter((a) => a.generatedByVoiceApi).length})
                </button>
              </div>
            </div>

            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => audioUploadInputRef.current?.click()}
                    disabled={audioUploadProgress !== null}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {audioUploadProgress !== null ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      'Enviar áudio'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectAllAudios}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                  >
                    {selectedAudioIds.size === filteredAudioLibrary.length ? 'Limpar seleção' : 'Selecionar todos'}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    {selectedAudioIds.size} selecionado(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteSelectedAudios()}
                    disabled={selectedAudioIds.size === 0 || isDeletingAudios}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeletingAudios ? 'Removendo...' : 'Excluir selecionados'}
                  </button>
                </div>
              </div>
              
              {audioUploadProgress !== null && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                      {audioUploadProgress === 0 && uploadingAudioForEntry === null ? 'Falha no envio' : 'Enviando áudio'}
                    </span>
                    <span className="font-semibold text-gray-800">{audioUploadProgress}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full transition-all duration-500 ${
                        audioUploadProgress === 0 && uploadingAudioForEntry === null
                          ? 'bg-red-400'
                          : 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-500'
                      }`}
                      style={{
                        width: `${Math.max(0, Math.min(100, audioUploadProgress))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-6">
              {filteredAudioLibrary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  {audioLibraryFilter === 'all' && 'Nenhum áudio disponível. Utilize o botão "Enviar áudio" para adicionar um novo arquivo.'}
                  {audioLibraryFilter === 'uploaded' && 'Nenhum áudio de upload encontrado.'}
                  {audioLibraryFilter === 'generated' && 'Nenhum áudio gerado pelo Buua encontrado.'}
                </div>
              ) : (
                filteredAudioLibrary.map((audio) => {
                  const isSelected = selectedAudioIds.has(audio.id);
                  return (
                    <div
                      key={audio.id}
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 transition hover:border-emerald-200"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAudioSelection(audio.id)}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAudioSelection(audio.id)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                      >
                        <span className="truncate text-sm font-medium text-gray-700">{audio.name}</span>
                        {audio.duration && (
                          <span className="flex-shrink-0 inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                            {audio.duration}s
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSelectedAudios([audio.id])}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-600 transition hover:bg-red-50"
                        aria-label="Deletar áudio"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de reprodução de vídeo */}
      {isMounted && videoModalItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setVideoModalItem(null)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center justify-center">
            <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl">
              {/* Header do modal */}
              <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
                <h3 className="text-base sm:text-lg font-semibold text-white truncate mr-4">{videoModalItem.avatarLabel}</h3>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/api/video/download?id=${videoModalItem.id}`;
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-3 py-2 text-xs sm:px-4 sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                    aria-label="Baixar vídeo"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="hidden sm:inline">Baixar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoModalItem(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
                    aria-label="Fechar"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Player de vídeo - tamanho controlado e compacto */}
              <div className="relative video-modal-player">
                <Plyr
                  source={{
                    type: 'video',
                    sources: [
                      {
                        src: videoModalItem.localVideoPath || videoModalItem.remoteVideoUrl || '',
                        type: 'video/mp4',
                      },
                    ],
                  }}
                  options={{
                    controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'],
                    hideControls: false,
                    clickToPlay: true,
                  }}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AuthenticatedShell>
  );
}

