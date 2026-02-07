import { NextResponse } from 'next/server';
import { logCapture } from '@/lib/log-capture';

/**
 * GET /api/activity-logs
 * Retrieve captured server logs with optional filtering
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const level = searchParams.get('level') as 'stdout' | 'stderr' | null;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined;

    // Get logs with filters
    const logs = logCapture.getLogs({
      level: level || undefined,
      category,
      search,
      limit,
    });

    // Get stats
    const stats = logCapture.getStats();

    return NextResponse.json({
      logs,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Error fetching activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity logs' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/activity-logs
 * Clear all captured logs
 */
export async function DELETE() {
  try {
    logCapture.clearLogs();

    return NextResponse.json({
      success: true,
      message: 'Activity logs cleared',
    });
  } catch (error) {
    console.error('[API] Error clearing activity logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear activity logs' },
      { status: 500 }
    );
  }
}
