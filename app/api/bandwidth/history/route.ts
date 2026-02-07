import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Get bandwidth history for time series chart
 * Returns download and upload rates aggregated by hour for the last 24 hours
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // Calculate cutoff time (24 hours ago)
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get all snapshots from the last 24 hours
    const snapshots = await prisma.bandwidthSnapshot.findMany({
      where: {
        timestamp: {
          gte: cutoffTime,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Aggregate data into hourly buckets
    const hourlyData = new Map<string, { downloadRates: number[], uploadRates: number[], timestamp: Date }>();

    for (const snapshot of snapshots) {
      // Round timestamp down to the hour
      const hourKey = new Date(snapshot.timestamp);
      hourKey.setMinutes(0, 0, 0);
      const hourKeyStr = hourKey.toISOString();

      if (!hourlyData.has(hourKeyStr)) {
        hourlyData.set(hourKeyStr, {
          downloadRates: [],
          uploadRates: [],
          timestamp: hourKey,
        });
      }

      const bucket = hourlyData.get(hourKeyStr)!;
      bucket.downloadRates.push(Number(snapshot.downloadRate));
      bucket.uploadRates.push(Number(snapshot.uploadRate));
    }

    // Calculate average rate for each hour
    const formattedHistory = Array.from(hourlyData.values()).map((bucket) => ({
      timestamp: bucket.timestamp.toISOString(),
      downloadRate: bucket.downloadRates.reduce((a, b) => a + b, 0) / bucket.downloadRates.length,
      uploadRate: bucket.uploadRates.reduce((a, b) => a + b, 0) / bucket.uploadRates.length,
    }));

    // Calculate stats
    const downloadRates = formattedHistory.map(h => h.downloadRate);
    const uploadRates = formattedHistory.map(h => h.uploadRate);

    const stats = {
      dataPoints: formattedHistory.length,
      oldestTimestamp: formattedHistory[0]?.timestamp || null,
      newestTimestamp: formattedHistory[formattedHistory.length - 1]?.timestamp || null,
      avgDownloadRate: downloadRates.length > 0 ? downloadRates.reduce((a, b) => a + b, 0) / downloadRates.length : 0,
      avgUploadRate: uploadRates.length > 0 ? uploadRates.reduce((a, b) => a + b, 0) / uploadRates.length : 0,
      maxDownloadRate: downloadRates.length > 0 ? Math.max(...downloadRates) : 0,
      maxUploadRate: uploadRates.length > 0 ? Math.max(...uploadRates) : 0,
    };

    return NextResponse.json({
      history: formattedHistory,
      stats,
    });
  } catch (error) {
    console.error('Error getting bandwidth history:', error);
    return NextResponse.json(
      { error: 'Failed to get bandwidth history' },
      { status: 500 }
    );
  }
}
