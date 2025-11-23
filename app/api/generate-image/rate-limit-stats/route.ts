import { NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = rateLimiter.getStats();
    
    // Filtrar apenas stats de imagens
    const imageStats = {
      'gpt-image-1': stats['gpt-image-1'] || { used: 0, limit: 45, remaining: 45 },
    };
    
    return NextResponse.json({
      success: true,
      stats: imageStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Erro ao obter stats:', error);
    return NextResponse.json(
      { error: 'Erro ao obter estatísticas' },
      { status: 500 }
    );
  }
}

