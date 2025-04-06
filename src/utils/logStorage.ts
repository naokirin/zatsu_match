import { LogLevel } from './logger';
import { Config } from '../types/config';
import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
}

export class LogStorage {
  private static instance: LogStorage | null = null;
  private readonly logDir: string;
  private readonly maxFileSize: number;
  private readonly maxFiles: number;
  private currentFile: string;

  private constructor(config: Config) {
    this.logDir = config.logging.logDir || 'logs';
    this.maxFileSize = config.logging.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = config.logging.maxFiles || 5;
    this.currentFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);

    this.ensureLogDirectory();
  }

  public static getInstance(config?: Config): LogStorage {
    if (!LogStorage.instance) {
      if (!config) {
        throw new Error('LogStorage must be initialized with config');
      }
      LogStorage.instance = new LogStorage(config);
    }
    return LogStorage.instance;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private rotateLogFile(): void {
    const files = fs.readdirSync(this.logDir)
      .filter(file => file.startsWith('app-') && file.endsWith('.log'))
      .sort();

    if (files.length >= this.maxFiles) {
      const oldestFile = path.join(this.logDir, files[0]);
      fs.unlinkSync(oldestFile);
    }

    this.currentFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  private checkFileSize(): void {
    if (fs.existsSync(this.currentFile)) {
      const stats = fs.statSync(this.currentFile);
      if (stats.size >= this.maxFileSize) {
        this.rotateLogFile();
      }
    }
  }

  public writeLog(entry: LogEntry): void {
    this.checkFileSize();
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.currentFile, logLine);
  }

  public getLogs(date?: string): LogEntry[] {
    const targetFile = date
      ? path.join(this.logDir, `app-${date}.log`)
      : this.currentFile;

    if (!fs.existsSync(targetFile)) {
      return [];
    }

    return fs.readFileSync(targetFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  public clearLogs(): void {
    const files = fs.readdirSync(this.logDir)
      .filter(file => file.startsWith('app-') && file.endsWith('.log'));

    files.forEach(file => {
      fs.unlinkSync(path.join(this.logDir, file));
    });
  }
} 