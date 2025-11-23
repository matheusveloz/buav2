// lib/rate-limiter.ts
interface RequestRecord {
  timestamp: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class SimpleRateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();

  private configs: Record<string, RateLimitConfig> = {
    'sora-2': {
      maxRequests: 120, // Deixar margem de segurança (125 - 5)
      windowMs: 60000, // 1 minuto
    },
    'sora-2-pro': {
      maxRequests: 45, // Deixar margem de segurança (50 - 5)
      windowMs: 60000,
    },
    'gpt-image-1': {
      maxRequests: 45, // Deixar margem de segurança (50 - 5)
      windowMs: 60000, // 1 minuto
    },
  };

  async checkLimit(model: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetIn: number;
  }> {
    const config = this.configs[model];
    if (!config) {
      return { allowed: true, remaining: 999, resetIn: 0 };
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Obter ou criar array de requests para este modelo
    if (!this.requests.has(model)) {
      this.requests.set(model, []);
    }

    const modelRequests = this.requests.get(model)!;

    // Limpar requests antigas
    const recentRequests = modelRequests.filter(
      (req) => req.timestamp > windowStart
    );
    this.requests.set(model, recentRequests);

    const remaining = config.maxRequests - recentRequests.length;
    const allowed = remaining > 0;

    // Calcular quando resetará
    let resetIn = 0;
    if (recentRequests.length > 0) {
      const oldestRequest = recentRequests[0];
      resetIn = config.windowMs - (now - oldestRequest.timestamp);
    }

    return {
      allowed,
      remaining: Math.max(0, remaining),
      resetIn: Math.max(0, resetIn),
    };
  }

  recordRequest(model: string): void {
    if (!this.requests.has(model)) {
      this.requests.set(model, []);
    }

    this.requests.get(model)!.push({
      timestamp: Date.now(),
    });
  }

  getStats() {
    const stats: Record<string, { used: number; limit: number; remaining: number }> = {};

    for (const [model, config] of Object.entries(this.configs)) {
      const requests = this.requests.get(model) || [];
      const now = Date.now();
      const windowStart = now - config.windowMs;
      const recentCount = requests.filter((r) => r.timestamp > windowStart).length;

      stats[model] = {
        used: recentCount,
        limit: config.maxRequests,
        remaining: config.maxRequests - recentCount,
      };
    }

    return stats;
  }

  // Limpar memória periodicamente
  cleanup(): void {
    const now = Date.now();
    for (const [model, requests] of this.requests.entries()) {
      const config = this.configs[model];
      if (!config) continue;

      const windowStart = now - config.windowMs;
      const filtered = requests.filter((r) => r.timestamp > windowStart);
      this.requests.set(model, filtered);
    }
  }
}

// Singleton global
let rateLimiterInstance: SimpleRateLimiter | null = null;

export function getRateLimiter(): SimpleRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new SimpleRateLimiter();
    
    // Limpar a cada 30 segundos
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        rateLimiterInstance?.cleanup();
      }, 30000);
    }
  }
  return rateLimiterInstance;
}

export const rateLimiter = getRateLimiter();

