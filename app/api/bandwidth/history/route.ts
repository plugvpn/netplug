import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Get bandwidth history for time series chart
 * Supports two modes:
 * - hourly: Returns download and upload rates aggregated by hour for the last N hours
 * - daily: Returns total bandwidth usage aggregated by day for the current month
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'hourly';
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    if (mode === 'daily') {
      // Get current month data
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month

      // Get all snapshots from the current month
      const snapshots = await prisma.bandwidthSnapshot.findMany({
        where: {
          timestamp: {
            gte: startOfMonth,
            lte: now,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      // Aggregate data into daily buckets (total bytes per day)
      const dailyData = new Map<string, { downloadTotal: number, uploadTotal: number, count: number, date: Date }>();

      for (const snapshot of snapshots) {
        // Round timestamp down to the day
        const dayKey = new Date(snapshot.timestamp);
        dayKey.setHours(0, 0, 0, 0);
        const dayKeyStr = dayKey.toISOString();

        if (!dailyData.has(dayKeyStr)) {
          dailyData.set(dayKeyStr, {
            downloadTotal: 0,
            uploadTotal: 0,
            count: 0,
            date: dayKey,
          });
        }

        const bucket = dailyData.get(dayKeyStr)!;
        // Accumulate total bytes (rate * time between snapshots, assuming 10s intervals)
        bucket.downloadTotal += Number(snapshot.downloadRate) * 10; // bytes/sec * 10 seconds
        bucket.uploadTotal += Number(snapshot.uploadRate) * 10;
        bucket.count++;
      }

      // Create array with all days of the month (fill missing days with 0)
      const daysInMonth = endOfMonth.getDate();
      const formattedHistory = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(now.getFullYear(), now.getMonth(), day);
        dayDate.setHours(0, 0, 0, 0);
        const dayKeyStr = dayDate.toISOString();

        const bucket = dailyData.get(dayKeyStr);

        formattedHistory.push({
          day: day,
          timestamp: dayDate.toISOString(),
          downloadTotal: bucket ? bucket.downloadTotal : 0,
          uploadTotal: bucket ? bucket.uploadTotal : 0,
          combinedTotal: bucket ? (bucket.downloadTotal + bucket.uploadTotal) : 0,
        });

        // Stop at current day
        if (day === now.getDate()) break;
      }

      const stats = {
        dataPoints: formattedHistory.length,
        month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
        totalDownload: formattedHistory.reduce((sum, h) => sum + h.downloadTotal, 0),
        totalUpload: formattedHistory.reduce((sum, h) => sum + h.uploadTotal, 0),
        totalCombined: formattedHistory.reduce((sum, h) => sum + h.combinedTotal, 0),
      };

      return NextResponse.json({
        history: formattedHistory,
        stats,
        mode: 'daily',
      });
    }

    // Default hourly mode
    // Calculate cutoff time (N hours ago)
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get all snapshots from the last N hours
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
      mode: 'hourly',
    });
  } catch (error) {
    console.error('Error getting bandwidth history:', error);
    return NextResponse.json(
      { error: 'Failed to get bandwidth history' },
      { status: 500 }
    );
  }
}
