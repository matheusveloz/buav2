import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// ==================== TESTE: VERIFICAR TASKS PENDENTES ====================
// Endpoint para testar se há tasks pendentes esperando processamento
// Acesse: /api/cron/test
// ==========================================================================

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [TEST] Verificando tasks pendentes...');

    const supabase = createSupabaseAdminClient();

    // Buscar tasks em 'processing'
    const { data: pendingTasks, error: fetchError } = await supabase
      .from('generated_images')
      .select('*')
      .eq('status', 'processing')
      .in('model', [
        'gemini-2.5-flash-image-preview',
        'gemini-2.5-flash-image-edit',
        'gemini-3-pro-image-preview',
        'gemini-3-pro-image-edit',
      ])
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('❌ [TEST] Erro ao buscar tasks:', fetchError);
      return NextResponse.json({ error: 'Erro ao buscar tasks', details: fetchError }, { status: 500 });
    }

    console.log(`📋 [TEST] ${pendingTasks?.length || 0} task(s) pendente(s) encontrada(s)`);

    // Agrupar por modelo
    const tasksByModel = pendingTasks?.reduce((acc: any, task: any) => {
      const model = task.model;
      if (!acc[model]) {
        acc[model] = [];
      }
      acc[model].push({
        taskId: task.task_id,
        userEmail: task.user_email,
        createdAt: task.created_at,
        prompt: task.prompt?.substring(0, 50) + '...',
        numImages: task.num_images,
      });
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      totalPending: pendingTasks?.length || 0,
      tasksByModel: tasksByModel || {},
      tasks: pendingTasks?.map((task: any) => ({
        taskId: task.task_id,
        model: task.model,
        userEmail: task.user_email,
        createdAt: task.created_at,
        numImages: task.num_images,
        prompt: task.prompt?.substring(0, 50) + '...',
      })) || [],
    });

  } catch (error) {
    console.error('❌ [TEST] Erro crítico:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

