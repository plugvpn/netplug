/**
 * Bandwidth History Service
 * Tracks bandwidth usage over time for time series charts
 */

export interface BandwidthSnapshot {
  timestamp: Date;
  downloadRate: number; // bytes per second
  uploadRate: number;   // bytes per second
}

class BandwidthHistoryService {
  private history: BandwidthSnapshot[] = [];
  private maxDataPoints = 360; // Keep 1 hour of data (360 * 10 seconds = 3600 seconds = 1 hour)

  /**
   * Add a bandwidth snapshot to the history
   */
  addSnapshot(downloadRate: bigint, uploadRate: bigint) {
    const snapshot: BandwidthSnapshot = {
      timestamp: new Date(),
      downloadRate: Number(downloadRate),
      uploadRate: Number(uploadRate),
    };

    this.history.push(snapshot);

    // Remove old data points to keep memory bounded
    if (this.history.length > this.maxDataPoints) {
      this.history.shift();
    }
  }

  /**
   * Get bandwidth history for the last N minutes
   */
  getHistory(minutes: number = 60): BandwidthSnapshot[] {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    return this.history.filter(snapshot => snapshot.timestamp >= cutoffTime);
  }

  /**
   * Get all history
   */
  getAllHistory(): BandwidthSnapshot[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clear() {
    this.history = [];
  }

  /**
   * Get statistics
   */
  getStats() {
    if (this.history.length === 0) {
      return {
        dataPoints: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
        avgDownloadRate: 0,
        avgUploadRate: 0,
        maxDownloadRate: 0,
        maxUploadRate: 0,
      };
    }

    const downloadRates = this.history.map(s => s.downloadRate);
    const uploadRates = this.history.map(s => s.uploadRate);

    return {
      dataPoints: this.history.length,
      oldestTimestamp: this.history[0].timestamp,
      newestTimestamp: this.history[this.history.length - 1].timestamp,
      avgDownloadRate: downloadRates.reduce((a, b) => a + b, 0) / downloadRates.length,
      avgUploadRate: uploadRates.reduce((a, b) => a + b, 0) / uploadRates.length,
      maxDownloadRate: Math.max(...downloadRates),
      maxUploadRate: Math.max(...uploadRates),
    };
  }
}

// Export singleton instance
export const bandwidthHistory = new BandwidthHistoryService();
