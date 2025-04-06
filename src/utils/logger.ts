import { Config } from '../types/config';
import { Metrics } from './metrics';
import { LogStorage } from './logStorage';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

export class Logger {
  private static instance: Logger | null = null;
  private readonly logLevel: LogLevel;
  private readonly logLevelPriority: number;
  private readonly metrics: Metrics;
  private readonly storage: LogStorage;

  private constructor(config: Config) {
    this.logLevel = config.logging.level;
    this.logLevelPriority = LOG_LEVEL_PRIORITY[this.logLevel];
    this.metrics = Metrics.getInstance();
    this.storage = LogStorage.getInstance(config);
  }

  public static getInstance(config?: Config): Logger {
    if (!Logger.instance) {
      if (!config) {
        throw new Error('Logger must be initialized with config');
      }
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  public static getLogger(): Logger {
    if (!Logger.instance) {
      throw new Error('Logger must be initialized first');
    }
    return Logger.instance;
  }

  public static reset(): void {
    Logger.instance = null;
    Metrics.getInstance().reset();
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= this.logLevelPriority;
  }

  private formatMessage(level: LogLevel, message: string, context?: unknown): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: unknown): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      const formattedMessage = this.formatMessage(level, message, context);

      // コンソールに出力
      if (level === LogLevel.ERROR) {
        console.error(formattedMessage);
      } else if (level === LogLevel.WARN) {
        console.warn(formattedMessage);
      } else {
        console.log(formattedMessage);
      }

      // メトリクスを記録
      this.metrics.recordLog(level, message, context);

      // ログを永続化
      this.storage.writeLog({
        timestamp,
        level,
        message,
        context,
      });
    }
  }

  public debug(message: string, context?: unknown): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: unknown): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: unknown): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: Error | unknown, context?: unknown): void {
    const errorContext = error
      ? {
        ...(context as Record<string, unknown>),
        error: error instanceof Error
          ? {
            message: error.message,
            stack: error.stack,
          }
          : error,
      }
      : context;
    this.log(LogLevel.ERROR, message, errorContext);
  }

  public getMetrics() {
    return this.metrics.getMetrics();
  }

  public getLogs(date?: string) {
    return this.storage.getLogs(date);
  }

  public clearLogs() {
    this.storage.clearLogs();
  }
} 