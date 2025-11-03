export interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

export interface Counter {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

export interface Histogram {
  name: string;
  buckets: Map<number, number>;
  labels?: Record<string, string>;
}

export class Metrics {
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private gauges: Map<string, number> = new Map();

  /**
   * Increment a counter
   */
  increment(name: string, labels?: Record<string, string>, value: number = 1): void {
    const key = this.getKey(name, labels);
    const counter = this.counters.get(key) || { name, value: 0, labels };
    counter.value += value;
    this.counters.set(key, counter);
  }

  /**
   * Decrement a counter
   */
  decrement(name: string, labels?: Record<string, string>, value: number = 1): void {
    this.increment(name, labels, -value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getKey(name, labels);
    let histogram = this.histograms.get(key);
    
    if (!histogram) {
      histogram = {
        name,
        buckets: new Map(),
        labels,
      };
      this.histograms.set(key, histogram);
    }

    // Simple histogram: count values in buckets
    const bucket = this.getBucket(value);
    const count = histogram.buckets.get(bucket) || 0;
    histogram.buckets.set(bucket, count + 1);
  }

  /**
   * Get bucket for value
   */
  private getBucket(value: number): number {
    // Buckets: 0, 10, 50, 100, 500, 1000, 5000, 10000, +Inf
    const buckets = [0, 10, 50, 100, 500, 1000, 5000, 10000, Infinity];
    for (const bucket of buckets) {
      if (value <= bucket) {
        return bucket;
      }
    }
    return Infinity;
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const counter of this.counters.values()) {
      const labelStr = this.formatLabels(counter.labels);
      lines.push(`# TYPE ${counter.name} counter`);
      lines.push(`${counter.name}${labelStr} ${counter.value}`);
    }

    // Gauges
    for (const [name, value] of this.gauges.entries()) {
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    }

    // Histograms
    for (const histogram of this.histograms.values()) {
      lines.push(`# TYPE ${histogram.name} histogram`);
      
      for (const [bucket, count] of histogram.buckets.entries()) {
        const bucketLabels = this.formatLabels({
          ...histogram.labels,
          le: bucket === Infinity ? '+Inf' : bucket.toString(),
        });
        lines.push(`${histogram.name}_bucket${bucketLabels} ${count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format labels for Prometheus
   */
  private formatLabels(_labels?: Record<string, string>): string {
    if (!_labels || Object.keys(_labels).length === 0) {
      return '';
    }

    const pairs = Object.entries(_labels)
      .map(([key, value]) => `${key}="${value}"`);
    
    return `{${pairs.join(',')}}`;
  }

  /**
   * Get key for metric with labels
   */
  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  /**
   * Get all counters
   */
  getCounters(): Counter[] {
    return Array.from(this.counters.values());
  }

  /**
   * Get all gauges
   */
  getGauges(): Map<string, number> {
    return new Map(this.gauges);
  }

  /**
   * Get all histograms
   */
  getHistograms(): Histogram[] {
    return Array.from(this.histograms.values());
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

