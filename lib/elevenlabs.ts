const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_API_URL?.trim() || 'https://api.elevenlabs.io';

export class ElevenLabsApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ElevenLabsApiError';
    this.status = status;
    this.details = details;
  }
}

function getElevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();

  if (!key) {
    throw new Error(
      'ELEVENLABS_API_KEY não configurada. Defina a variável de ambiente ELEVENLABS_API_KEY com a sua chave da ElevenLabs.',
    );
  }

  return key;
}

type ElevenLabsRequestOptions = RequestInit & {
  expectBinary?: boolean;
};

async function elevenLabsRequest(path: string, { expectBinary = false, ...init }: ElevenLabsRequestOptions = {}) {
  const url = `${ELEVENLABS_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: HeadersInit = {
    'xi-api-key': getElevenLabsApiKey(),
    Accept: expectBinary ? 'audio/mpeg' : 'application/json',
    ...init.headers,
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let details: unknown = null;
    const contentType = response.headers.get('content-type') ?? '';

    try {
      details = contentType.includes('application/json') ? await response.json() : await response.text();
    } catch (error) {
      details = { parseError: error instanceof Error ? error.message : String(error) };
    }

    console.error('[ElevenLabs API Error]', {
      url,
      status: response.status,
      statusText: response.statusText,
      contentType,
      details,
    });

    throw new ElevenLabsApiError(
      `Falha na requisição ElevenLabs (${response.status} ${response.statusText})`,
      response.status,
      details,
    );
  }

  if (expectBinary) {
    return response.arrayBuffer();
  }

  return response.json();
}

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  preview_url?: string | null;
  labels?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  samples?: Array<{
    sample_id: string;
    file_name?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
  }>;
};

export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const data = await elevenLabsRequest('/v1/voices');

  if (!data || typeof data !== 'object' || !Array.isArray((data as { voices?: unknown }).voices)) {
    throw new Error('Resposta inesperada da ElevenLabs ao listar vozes.');
  }

  return (data as { voices: ElevenLabsVoice[] }).voices;
}

type CloneVoiceRequest = {
  name: string;
  description?: string;
  files: Array<{ buffer: ArrayBuffer; fileName: string; mimeType?: string }>;
  labels?: Record<string, unknown>;
  makePublic?: boolean;
  removeBackgroundNoise?: boolean; // Remove ruído de fundo (padrão: true)
};

type CloneVoiceResponse = {
  voice_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  preview_url?: string | null;
};

export async function cloneElevenLabsVoice(payload: CloneVoiceRequest): Promise<CloneVoiceResponse> {
  if (!payload.files || payload.files.length === 0) {
    throw new Error('Envie pelo menos um arquivo de áudio para clonar a voz.');
  }

  const formData = new FormData();
  formData.set('name', payload.name);

  if (payload.description) {
    formData.set('description', payload.description);
  }

  if (payload.labels) {
    formData.set('labels', JSON.stringify(payload.labels));
  }

  if (payload.makePublic !== undefined) {
    formData.set('make_public', payload.makePublic ? 'true' : 'false');
  }

  // Remove ruído de fundo automaticamente (padrão: true)
  if (payload.removeBackgroundNoise !== false) {
    formData.set('remove_background_noise', 'true');
  }

  payload.files.forEach((file, index) => {
    const blob = new Blob([file.buffer], { type: file.mimeType ?? 'audio/mpeg' });
    formData.append('files', blob, file.fileName ?? `sample-${index + 1}.mp3`);
  });

  const data = await elevenLabsRequest('/v1/voices/add', {
    method: 'POST',
    body: formData,
  });

  if (!data || typeof data !== 'object' || !('voice_id' in data)) {
    throw new Error('Resposta inesperada da ElevenLabs ao clonar voz.');
  }

  return data as CloneVoiceResponse;
}

type SynthesizeSpeechOptions = {
  voiceId: string;
  text: string;
  modelId?: string;
  voiceSettings?: Record<string, unknown>;
  responseFormat?: 'mp3_44100_128' | 'mp3_44100_64' | 'pcm_16000';
};

export async function synthesizeSpeech(options: SynthesizeSpeechOptions): Promise<ArrayBuffer> {
  if (!options.text || options.text.trim().length === 0) {
    throw new Error('Informe um texto para gerar áudio.');
  }

  const body = {
    text: options.text,
    model_id: options.modelId ?? 'eleven_multilingual_v2',
    voice_settings: options.voiceSettings ?? undefined,
    response_format: options.responseFormat ?? 'mp3_44100_128',
  };

  return elevenLabsRequest(`/v1/text-to-speech/${options.voiceId}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    expectBinary: true,
  });
}

export async function fetchVoicePreview(voiceId: string) {
  return elevenLabsRequest(`/v1/voices/${voiceId}`);
}


