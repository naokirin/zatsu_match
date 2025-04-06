import { LogLevel } from './logger';

interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  errors: number;
  lastError?: {
    message: string;
    timestamp: string;
    context?: unknown;
  };
}

export class Metrics {
  private static instance: Metrics | null = null;
  private metrics: LogMetrics;

  private constructor() {
    this.metrics = {
      totalLogs: 0,
      logsByLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0,
      },
      errors: 0,
    };
  }

  public static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  public recordLog(level: LogLevel, message: string, context?: unknown): void {
    this.metrics.totalLogs++;
    this.metrics.logsByLevel[level]++;

    if (level === LogLevel.ERROR) {
      this.metrics.errors++;
      this.metrics.lastError = {
        message,
        timestamp: new Date().toISOString(),
        context,
      };
    }
  }

  public getMetrics(): LogMetrics {
    return { ...this.metrics };
  }

  public reset(): void {
    this.metrics = {
      totalLogs: 0,
      logsByLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0,
      },
      errors: 0,
    };
  }
} 