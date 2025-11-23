import { NextResponse } from 'next/server';
import { rateLimiter } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = rateLimiter.getStats();
    
    return NextResponse.json({
      success: true,
      stats,
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

