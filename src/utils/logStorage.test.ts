import { LogStorage } from './logStorage';
import { LogLevel } from './logger';
import { Config } from '../types/config';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('LogStorage', () => {
  let storage: LogStorage;
  let mockConfig: Config;
  const mockLogDir = 'test-logs';

  beforeEach(() => {
    mockConfig = {
      slack: {
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      },
      logging: {
        level: LogLevel.INFO,
        logDir: mockLogDir,
        maxFileSize: 100, // 小さいサイズに設定してテストを容易にする
        maxFiles: 2,
      },
      matching: {
        minMembers: 2,
        maxMembers: 10,
      },
      huddle: {
        channelPrefix: 'test-',
        isPrivate: true,
      },
    };

    // モックのリセット
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => undefined);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 0 });
    (fs.appendFileSync as jest.Mock).mockImplementation(() => undefined);
    (fs.unlinkSync as jest.Mock).mockImplementation(() => undefined);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('constructor', () => {
    it('should create log directory if it does not exist', () => {
      storage = LogStorage.getInstance(mockConfig);
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockLogDir, { recursive: true });
    });

    it('should not create log directory if it exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      storage = LogStorage.getInstance(mockConfig);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('writeLog', () => {
    beforeEach(() => {
      storage = LogStorage.getInstance(mockConfig);
    });

    it('should write log entry to file', () => {
      const entry = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'test message',
        context: { traceId: 'test-trace' },
      };

      storage.writeLog(entry);
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.stringContaining('app-'),
        expect.stringContaining(JSON.stringify(entry))
      );
    });

    it('should rotate file when size limit is reached', () => {
      (fs.statSync as jest.Mock).mockReturnValue({ size: 101 });
      (fs.readdirSync as jest.Mock).mockReturnValue(['app-2024-01-01.log']);

      const entry = {
        timestamp: '2024-01-01T00:00:00.000Z',
        level: LogLevel.INFO,
        message: 'test message',
      };

      storage.writeLog(entry);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('getLogs', () => {
    beforeEach(() => {
      storage = LogStorage.getInstance(mockConfig);
    });

    it('should return empty array when file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      const logs = storage.getLogs();
      expect(logs).toEqual([]);
    });

    it('should return parsed logs from file', () => {
      const mockLogs = [
        { timestamp: '2024-01-01T00:00:00.000Z', level: LogLevel.INFO, message: 'test1' },
        { timestamp: '2024-01-01T00:00:01.000Z', level: LogLevel.ERROR, message: 'test2' },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        mockLogs.map(log => JSON.stringify(log)).join('\n')
      );

      const logs = storage.getLogs();
      expect(logs).toEqual(mockLogs);
    });
  });

  describe('clearLogs', () => {
    beforeEach(() => {
      storage = LogStorage.getInstance(mockConfig);
    });

    it('should delete all log files', () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'app-2024-01-01.log',
        'app-2024-01-02.log',
      ]);

      storage.clearLogs();
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = LogStorage.getInstance(mockConfig);
      const instance2 = LogStorage.getInstance(mockConfig);
      expect(instance1).toBe(instance2);
    });

    it('should throw error when initialized without config', () => {
      expect(() => LogStorage.getInstance()).toThrow(
        'LogStorage must be initialized with config'
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      storage = LogStorage.getInstance(mockConfig);
    });

    describe('file system errors', () => {
      it('should handle directory creation failure', () => {
        (fs.mkdirSync as jest.Mock).mockImplementation(() => {
          throw new Error('Permission denied');
        });

        expect(() => LogStorage.getInstance(mockConfig)).toThrow('Permission denied');
      });

      it('should handle file write failure', () => {
        const entry = {
          timestamp: '2024-01-01T00:00:00.000Z',
          level: LogLevel.INFO,
          message: 'test message',
        };

        (fs.appendFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('Disk full');
        });

        expect(() => storage.writeLog(entry)).toThrow('Disk full');
      });

      it('should handle file read failure', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('File corrupted');
        });

        expect(() => storage.getLogs()).toThrow('File corrupted');
      });

      it('should handle file deletion failure', () => {
        (fs.readdirSync as jest.Mock).mockReturnValue(['app-2024-01-01.log']);
        (fs.unlinkSync as jest.Mock).mockImplementation(() => {
          throw new Error('File locked');
        });

        expect(() => storage.clearLogs()).toThrow('File locked');
      });
    });

    describe('invalid input', () => {
      it('should handle invalid log entry', () => {
        const invalidEntry = {
          timestamp: 'invalid-date',
          level: 'INVALID_LEVEL',
          message: null,
        };

        expect(() => storage.writeLog(invalidEntry as any)).toThrow();
      });

      it('should handle malformed log file', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('invalid json\n{invalid}\n');

        const logs = storage.getLogs();
        expect(logs).toEqual([]);
      });

      it('should handle empty log file', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('');

        const logs = storage.getLogs();
        expect(logs).toEqual([]);
      });
    });

    describe('concurrent access', () => {
      it('should handle multiple write operations', () => {
        const entries = Array.from({ length: 10 }, (_, i) => ({
          timestamp: new Date().toISOString(),
          level: LogLevel.INFO,
          message: `test message ${i}`,
        }));

        entries.forEach(entry => storage.writeLog(entry));
        expect(fs.appendFileSync).toHaveBeenCalledTimes(10);
      });

      it('should handle file rotation during write', () => {
        (fs.statSync as jest.Mock).mockReturnValue({ size: 101 });
        (fs.readdirSync as jest.Mock).mockReturnValue(['app-2024-01-01.log']);

        const entry = {
          timestamp: '2024-01-01T00:00:00.000Z',
          level: LogLevel.INFO,
          message: 'test message',
        };

        storage.writeLog(entry);
        expect(fs.unlinkSync).toHaveBeenCalled();
        expect(fs.appendFileSync).toHaveBeenCalled();
      });
    });

    describe('resource limits', () => {
      it('should handle maximum file size limit', () => {
        const largeEntry = {
          timestamp: '2024-01-01T00:00:00.000Z',
          level: LogLevel.INFO,
          message: 'x'.repeat(1000),
          context: { data: 'x'.repeat(1000) },
        };

        storage.writeLog(largeEntry);
        expect(fs.appendFileSync).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining(largeEntry.message)
        );
      });

      it('should handle maximum number of files', () => {
        const files = Array.from({ length: 3 }, (_, i) => `app-2024-01-${i + 1}.log`);
        (fs.readdirSync as jest.Mock).mockReturnValue(files);

        storage.clearLogs();
        expect(fs.unlinkSync).toHaveBeenCalledTimes(2); // maxFiles = 2
      });
    });
  });
}); 