'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  DragEvent,
} from 'react';
import Link from 'next/link';
import { AuthenticatedShell } from '@/components/authenticated-shell';
import type { Profile } from '@/lib/profile';
import type { AvatarLibraryItem } from '@/lib/avatar-library';

type AvatarOption = AvatarLibraryItem & { createdAt?: string };

type AudioItem = {
  id: string;
  name: string;
  url: string;
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
};

interface AvatarVideoClientProps {
  initialProfile: Profile;
  userEmail: string;
  builtinAvatars: AvatarOption[];
  userAvatars: AvatarOption[];
  userAudios: AudioItem[];
  initialHistory: HistoryItem[];
}

const MAX_POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 4000;

const createClientId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

export default function AvatarVideoClient({
  initialProfile,
  userEmail,
  builtinAvatars,
  userAvatars,
  userAudios,
  initialHistory,
}: AvatarVideoClientProps) {
  const [uploadedAvatars, setUploadedAvatars] = useState<AvatarOption[]>(userAvatars);
  const [selectedEntries, setSelectedEntries] = useState<AvatarEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [audioLibrary, setAudioLibrary] = useState<AudioItem[]>(userAudios);
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarModalSelection, setAvatarModalSelection] = useState<Set<string>>(new Set());

  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [pendingAudioEntryId, setPendingAudioEntryId] = useState<string | null>(null);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const avatarUploadInputRef = useRef<HTMLInputElement>(null);
  const audioUploadInputRef = useRef<HTMLInputElement>(null);

  const allAvatars = useMemo<AvatarOption[]>(() => {
    const uploadedIds = new Set(uploadedAvatars.map((avatar) => avatar.id));
    const filteredBuiltin = builtinAvatars.filter((avatar) => !uploadedIds.has(avatar.id));
    return [...uploadedAvatars, ...filteredBuiltin];
  }, [uploadedAvatars, builtinAvatars]);

  const activeEntry = activeEntryId
    ? selectedEntries.find((entry) => entry.id === activeEntryId) ?? null
    : null;

  const previewSource = activeEntry?.avatar.videoUrl ?? '';

  useEffect(() => {
    if (selectedEntries.length === 0) {
      setActiveEntryId(null);
      return;
    }
    if (!activeEntryId || !selectedEntries.some((entry) => entry.id === activeEntryId)) {
      setActiveEntryId(selectedEntries[0].id);
    }
  }, [selectedEntries, activeEntryId]);

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
      setIsUploadingAvatar(true);
      setErrorMessage(null);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/avatar/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Não foi possível enviar o avatar.');
        }

        const payload = (await response.json()) as {
          avatar: AvatarOption & { createdAt?: string };
        };

        if (!payload.avatar) {
          throw new Error('Resposta inesperada ao enviar avatar.');
        }

        setUploadedAvatars((prev) => [payload.avatar, ...prev]);
        setAvatarModalSelection((prev) => {
          const next = new Set(prev);
          next.add(payload.avatar.id);
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao enviar avatar.';
        setErrorMessage(message);
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [],
  );

  const uploadAudioFile = useCallback(
    async (file: File, targetEntryId: string) => {
      if (!targetEntryId) {
        setErrorMessage('Selecione um avatar antes de enviar o áudio.');
        throw new Error('Entrada nao selecionada');
      }

      setIsUploadingAudio(true);
      setErrorMessage(null);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/audio/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Não foi possível enviar o áudio.');
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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao enviar áudio.';
        setErrorMessage(message);
        throw error;
      } finally {
        setIsUploadingAudio(false);
      }
    },
    [assignAudioToEntry],
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

  const handleAudioDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!activeEntryId) {
        setErrorMessage('Selecione um avatar antes de vincular áudio.');
        return;
      }
      const files = event.dataTransfer.files;
      if (!files || files.length === 0) {
        setErrorMessage('Solte um arquivo de áudio válido.');
        return;
      }
      try {
        await uploadAudioFile(files[0], activeEntryId);
      } catch {
        // erro ja tratado
      }
    },
    [activeEntryId, uploadAudioFile],
  );

  const handleAudioSelection = useCallback(
    (audioId: string) => {
      if (!pendingAudioEntryId) return;
      const audio = audioLibrary.find((item) => item.id === audioId);
      if (!audio) return;
      assignAudioToEntry(pendingAudioEntryId, audio);
      setIsAudioModalOpen(false);
      setPendingAudioEntryId(null);
    },
    [audioLibrary, pendingAudioEntryId, assignAudioToEntry],
  );

  const pollTaskUntilComplete = useCallback(
    async (taskId: string, entryId: string, avatarLabel: string) => {
      let attempt = 0;

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
          continue;
        }

        if (payload.status === 'failed') {
          updateEntry(entryId, (entry) => ({ ...entry, status: 'failed' }));
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

        updateEntry(entryId, (entry) => ({ ...entry, status: 'completed' }));
        setStatusMessage(`Avatar "${avatarLabel}" gerado com sucesso!`);
        return;
      }

      updateEntry(entryId, (entry) => ({ ...entry, status: 'failed' }));
      throw new Error('Tempo limite ao processar o vídeo. Tente novamente em instantes.');
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

    const entriesToProcess = selectedEntries;

    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage('Iniciando geração dos avatares selecionados...');

    for (const entry of entriesToProcess) {
      const audio = entry.audio;
      if (!audio) continue;

      updateEntry(entry.id, (current) => ({ ...current, status: 'processing' }));

      try {
        const response = await fetch('/api/lipsync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srcVideoUrl: toAbsoluteUrl(entry.avatar.videoUrl),
            audioUrl: toAbsoluteUrl(audio.url),
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Não foi possível iniciar a geração.');
        }

        const payload = (await response.json()) as { taskId?: string };
        if (!payload.taskId) {
          throw new Error('Task criada, mas nao recebemos o identificador.');
        }

        updateEntry(entry.id, (current) => ({ ...current, taskId: payload.taskId }));
        await pollTaskUntilComplete(payload.taskId, entry.id, entry.avatar.label);
      } catch (error) {
        updateEntry(entry.id, (current) => ({ ...current, status: 'failed' }));
        const message =
          error instanceof Error
            ? error.message
            : `Falha ao gerar "${entry.avatar.label}".`;
        setErrorMessage(message);
      }
    }

    setIsGenerating(false);
    setStatusMessage('Processamento finalizado.');
  }, [pollTaskUntilComplete, selectedEntries, toAbsoluteUrl, updateEntry]);

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

  return (
    <AuthenticatedShell initialProfile={initialProfile} userEmail={userEmail}>
      <div className="space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/home"
              aria-label="Voltar para a home"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-400 via-emerald-500 to-green-600 text-white shadow-lg transition hover:scale-110 hover:shadow-xl"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="space-y-1.5">
              <p className="text-sm font-medium uppercase tracking-widest text-green-500">Avatar Vídeo</p>
              <h1 className="text-3xl font-semibold text-gray-900">Criação de avatar em vídeo</h1>
              <p className="max-w-2xl text-sm text-gray-600">
                Selecione um ou mais avatares, vincule os respectivos áudios e gere vídeos com sincronização labial em poucos cliques.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {statusMessage ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                {statusMessage}
              </span>
            ) : null}
            {errorMessage ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-medium text-red-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856C19.403 19 20 18.403 20 17.657V6.343C20 5.597 19.403 5 18.657 5H5.343C4.597 5 4 5.597 4 6.343v11.314C4 18.403 4.597 19 5.343 19z" />
                </svg>
                {errorMessage}
              </span>
            ) : null}
          </div>
        </div>

        <input
          ref={avatarUploadInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
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

        <section className="space-y-6 rounded-3xl border border-gray-200 bg-white/90 p-8 shadow-sm">
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
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Selecionar avatares
              </button>
              {selectedEntries.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!activeEntryId) {
                      setErrorMessage('Selecione um avatar na lista para abrir a biblioteca.');
                      return;
                    }
                    setPendingAudioEntryId(activeEntryId);
                    setIsAudioModalOpen(true);
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-2v13M9 10l12-2" />
                  </svg>
                  Biblioteca de áudios
                </button>
              ) : null}
            </div>
          </div>

          {selectedEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              Nenhum avatar selecionado ate o momento.
            </div>
          ) : (
            <>
              {activeEntry ? (
                <div className="space-y-3">
                  <div
                    className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-900/80"
                    onDrop={handleAudioDrop}
                    onDragOver={(event) => event.preventDefault()}
                  >
                    <div className="aspect-video w-full">
                      <video
                        key={previewSource}
                        src={previewSource}
                        muted
                        loop
                        autoPlay
                        playsInline
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 hidden place-items-center bg-black/60 text-white transition group-hover:grid">
                      <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-widest">
                        Solte o áudio aqui
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                    <div className="grow">
                      <p className="text-sm font-semibold text-gray-900">{activeEntry.avatar.label}</p>
                      <p className="text-xs text-gray-500">
                        Áudio:{' '}
                        {activeEntry.audio ? (
                            <span className="font-medium text-gray-700">
                              {truncateText(activeEntry.audio.name, 40)}
                            </span>
                        ) : (
                          <span className="italic text-gray-400">não atribuído</span>
                        )}
                      </p>
                    </div>
                    {activeEntry.status !== 'idle' ? (
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                          activeEntry.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : activeEntry.status === 'failed'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {activeEntry.status === 'completed'
                          ? 'Concluído'
                          : activeEntry.status === 'failed'
                            ? 'Falhou'
                            : 'Processando'}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {selectedEntries.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Avatares em foco</p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {selectedEntries.map((entry) => {
                      const isActive = entry.id === activeEntryId;
                      return (
                        <button
                          key={`quick-${entry.id}`}
                          type="button"
                          onClick={() => setActiveEntryId(entry.id)}
                          className={`group/quick relative flex min-w-[140px] items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                            isActive
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-gray-200 bg-white hover:border-emerald-200 hover:text-emerald-600'
                          }`}
                        >
                          <span className="relative flex h-12 w-12 overflow-hidden rounded-xl bg-gray-900">
                            <video
                              src={entry.avatar.videoUrl}
                              muted
                              loop
                              autoPlay
                              playsInline
                              className="h-full w-full object-contain"
                            />
                            {entry.status !== 'idle' ? (
                              <span
                                className={`absolute -bottom-1 right-1 inline-flex items-center rounded-full px-2 py-[2px] text-[10px] font-semibold text-white shadow ${
                                  entry.status === 'completed'
                                    ? 'bg-emerald-500'
                                    : entry.status === 'failed'
                                      ? 'bg-red-500'
                                      : 'bg-yellow-500'
                                }`}
                              >
                                {entry.status === 'completed'
                                  ? 'OK'
                                  : entry.status === 'failed'
                                    ? 'Falhou'
                                    : 'Gerando'}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-xs font-semibold">{entry.avatar.label}</span>
                            <span className="truncate text-[11px] text-gray-500">
                              {entry.audio ? truncateText(entry.audio.name, 28) : 'Sem áudio'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                      className={`group flex cursor-pointer flex-col overflow-hidden rounded-3xl border bg-white/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                        isActive
                          ? 'border-emerald-500 ring-2 ring-emerald-200'
                          : hasAudio
                            ? 'border-gray-200 hover:border-emerald-200'
                            : 'border-amber-300 hover:border-amber-400'
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
                        <video
                          src={entry.avatar.videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
                        />
                        <div className="absolute right-3 top-3 flex flex-col items-center gap-2">
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
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-emerald-500 hover:text-white"
                            aria-label="Duplicar avatar"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeEntry(entry.id);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-sm transition hover:bg-red-500 hover:text-white"
                            aria-label="Remover avatar"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-3h4m-9 3h14"
                              />
                            </svg>
                          </button>
                        </div>
                        {entry.status !== 'idle' ? (
                          <span
                            className={`absolute left-3 top-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white shadow ${
                              entry.status === 'completed'
                                ? 'bg-emerald-500/90'
                                : entry.status === 'failed'
                                  ? 'bg-red-500/90'
                                  : 'bg-yellow-500/90 text-gray-900'
                            }`}
                          >
                            {entry.status === 'completed'
                              ? 'Concluído'
                              : entry.status === 'failed'
                                ? 'Falhou'
                                : 'Processando'}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
                        <div className="space-y-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {entry.avatar.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            <span className="font-medium text-gray-600">Áudio:</span>{' '}
                            {entry.audio ? (
                              <span className="truncate font-medium text-gray-800">
                                {truncateText(entry.audio.name, 42)}
                              </span>
                            ) : (
                              <span className="italic text-gray-400">não atribuído</span>
                            )}
                          </p>
                        </div>
                        <div className="mt-auto flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingAudioEntryId(entry.id);
                              setIsAudioModalOpen(true);
                              setErrorMessage(null);
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-emerald-200 hover:text-emerald-600"
                          >
                            Biblioteca
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingAudioEntryId(entry.id);
                              audioUploadInputRef.current?.click();
                              setErrorMessage(null);
                            }}
                            disabled={isUploadingAudio}
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUploadingAudio ? 'Enviando...' : 'Enviar áudio'}
                          </button>
                          {entry.audio ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                assignAudioToEntry(entry.id, null);
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                            >
                              Remover áudio
                            </button>
                          ) : null}
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
                    'Gerar vídeos sincronizados'
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        <section className="space-y-6 rounded-3xl border border-gray-200 bg-white/90 p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Historico</h2>
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
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-video w-full bg-gray-100">
                    {item.localVideoPath ? (
                      <video
                        src={item.localVideoPath}
                        muted
                        loop
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : item.remoteVideoUrl ? (
                      <video
                        src={item.remoteVideoUrl}
                        muted
                        loop
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-400">
                        Prévia indisponível
                      </div>
                    )}
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/90 text-white'
                          : item.status === 'failed'
                            ? 'bg-red-500/90 text-white'
                            : 'bg-yellow-500/90 text-white'
                      }`}
                    >
                      {item.status === 'completed'
                        ? 'Concluído'
                        : item.status === 'failed'
                          ? 'Falhou'
                          : 'Processando'}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Task {item.taskId.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-gray-500">{formatDateTime(item.createdAt)}</p>
                      {item.avatarLabel ? (
                        <p className="text-xs text-gray-500">
                          Avatar: <span className="font-medium text-gray-700">{item.avatarLabel}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M5 3a2 2 0 00-2 2v3h2V5h3V3H5zm11 0v2h3v3h2V5a2 2 0 00-2-2h-3zM3 14v3a2 2 0 002 2h3v-2H5v-3H3zm16 0v3h-3v2h3a2 2 0 002-2v-3h-2z" />
                        </svg>
                        {item.creditosUtilizados ?? 0} créditos
                      </span>
                    </div>
                    <div className="mt-auto flex items-center gap-3">
                      {item.localVideoPath ? (
                        <a
                          href={item.localVideoPath}
                          download
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3" />
                          </svg>
                          Baixar
                        </a>
                      ) : null}
                      {item.remoteVideoUrl ? (
                        <a
                          href={item.remoteVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-700"
                        >
                          Assistir online
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {isAvatarModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsAvatarModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Selecionar avatares</h3>
                <p className="text-xs text-gray-500">
                  Escolha os avatares que deseja incluir na geração. Você pode enviar novos vídeos.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => avatarUploadInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {isUploadingAvatar ? 'Enviando...' : 'Enviar avatar'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Seus avatares</h4>
                <p className="text-xs text-gray-500">Videos enviados por voce ficam disponiveis apenas na sua conta.</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
                          className={`relative overflow-hidden rounded-2xl border transition ${
                            isSelected
                              ? 'border-emerald-500 ring-2 ring-emerald-200'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          <video
                            src={avatar.videoUrl}
                            muted
                            loop
                            autoPlay
                            playsInline
                            className="aspect-video w-full object-cover transition duration-500"
                          />
                          <div className="flex items-center justify-between px-4 py-3">
                            <p className="truncate text-sm font-semibold text-gray-900">{avatar.label}</p>
                            {isSelected ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M12.207 4.793a1 1 0 010 1.414L7.414 11l-.024.024a1 1 0 01-1.39-.024l-2-2a1 1 0 111.414-1.414L6.05 9.536l4.743-4.743a1 1 0 011.414 0z" />
                                </svg>
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-800">Avatares BUUA</h4>
                <p className="text-xs text-gray-500">Selecao de modelos prontos da plataforma.</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {builtinAvatars.map((avatar) => {
                    const isSelected = avatarModalSelection.has(avatar.id);
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => toggleAvatarSelection(avatar.id)}
                        className={`relative overflow-hidden rounded-2xl border transition ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-200'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <video
                          src={avatar.videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          className="aspect-video w-full object-cover transition duration-500"
                        />
                        <div className="flex items-center justify-between px-4 py-3">
                          <p className="truncate text-sm font-semibold text-gray-900">{avatar.label}</p>
                          {isSelected ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M12.207 4.793a1 1 0 010 1.414L7.414 11l-.024.024a1 1 0 01-1.39-.024l-2-2a1 1 0 111.414-1.414L6.05 9.536l4.743-4.743a1 1 0 011.414 0z" />
                              </svg>
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
              <span className="text-xs text-gray-500">
                {avatarModalSelection.size} avatar(es) selecionado(s)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmAvatarSelection}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-lg"
                >
                  Confirmar selecao
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isAudioModalOpen && pendingAudioEntryId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsAudioModalOpen(false);
              setPendingAudioEntryId(null);
            }}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Selecionar áudio</h3>
                <p className="text-xs text-gray-500">
                  Escolha um áudio existente ou envie um novo arquivo para associar ao avatar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => audioUploadInputRef.current?.click()}
                  disabled={isUploadingAudio}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {isUploadingAudio ? 'Enviando...' : 'Enviar áudio'}
                </button>
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
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-6">
              {audioLibrary.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  Nenhum áudio disponível. Utilize o botão “Enviar áudio” para adicionar um novo arquivo.
                </div>
              ) : (
                audioLibrary.map((audio) => (
                  <button
                    key={audio.id}
                    type="button"
                    onClick={() => handleAudioSelection(audio.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:border-emerald-300 hover:text-emerald-600"
                  >
                    <span className="truncate">{audio.name}</span>
                    <span className="ml-4 truncate text-xs text-gray-400">{audio.url.split('/').pop()}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </AuthenticatedShell>
  );
}

