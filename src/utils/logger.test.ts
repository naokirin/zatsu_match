import { Logger, LogLevel } from './logger';
import { Config } from '../types/config';
import { Metrics } from './metrics';
import { LogStorage } from './logStorage';

jest.mock('./metrics');
jest.mock('./logStorage');

describe('Logger', () => {
  let mockConfig: Config;
  let mockMetrics: jest.Mocked<Metrics>;
  let mockStorage: jest.Mocked<LogStorage>;

  beforeEach(() => {
    mockConfig = {
      slack: {
        botToken: 'xoxb-test-token',
        signingSecret: 'test-secret',
      },
      logging: {
        level: LogLevel.INFO,
        logDir: 'test-logs',
        maxFileSize: 100,
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

    mockMetrics = {
      recordLog: jest.fn(),
      getMetrics: jest.fn(),
      reset: jest.fn(),
    } as unknown as jest.Mocked<Metrics>;

    mockStorage = {
      writeLog: jest.fn(),
      getLogs: jest.fn(),
      clearLogs: jest.fn(),
    } as unknown as jest.Mocked<LogStorage>;

    (Metrics.getInstance as jest.Mock).mockReturnValue(mockMetrics);
    (LogStorage.getInstance as jest.Mock).mockReturnValue(mockStorage);
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      const logger = Logger.getInstance(mockConfig);
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should throw error when initialized without config', () => {
      expect(() => Logger.getInstance()).toThrow('Logger must be initialized with config');
    });

    it('should return the same instance', () => {
      const instance1 = Logger.getInstance(mockConfig);
      const instance2 = Logger.getInstance(mockConfig);
      expect(instance1).toBe(instance2);
    });
  });

  describe('logging', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = Logger.getInstance(mockConfig);
    });

    it('should log message with all components', () => {
      const message = 'test message';
      const context = { traceId: 'test-trace' };

      logger.info(message, context);

      expect(mockMetrics.recordLog).toHaveBeenCalledWith(LogLevel.INFO, message, context);
      expect(mockStorage.writeLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message,
          context,
        })
      );
    });

    it('should handle error logging', () => {
      const message = 'test error';
      const error = new Error('test error');
      const context = { traceId: 'test-trace' };

      logger.error(message, error, context);

      expect(mockMetrics.recordLog).toHaveBeenCalledWith(
        LogLevel.ERROR,
        message,
        expect.objectContaining({
          ...context,
          error: {
            message: error.message,
            stack: error.stack,
          },
        })
      );
      expect(mockStorage.writeLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          message,
          context: expect.objectContaining({
            ...context,
            error: {
              message: error.message,
              stack: error.stack,
            },
          }),
        })
      );
    });

    it('should respect log level', () => {
      mockConfig.logging.level = LogLevel.WARN;
      logger = Logger.getInstance(mockConfig);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockMetrics.recordLog).toHaveBeenCalledTimes(2);
      expect(mockStorage.writeLog).toHaveBeenCalledTimes(2);
    });
  });

  describe('utility methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = Logger.getInstance(mockConfig);
    });

    it('should get metrics', () => {
      const mockMetricsData = { totalLogs: 1 };
      mockMetrics.getMetrics.mockReturnValue(mockMetricsData);

      const metrics = logger.getMetrics();
      expect(metrics).toEqual(mockMetricsData);
    });

    it('should get logs', () => {
      const mockLogs = [{ timestamp: '2024-01-01T00:00:00.000Z', level: LogLevel.INFO, message: 'test' }];
      mockStorage.getLogs.mockReturnValue(mockLogs);

      const logs = logger.getLogs();
      expect(logs).toEqual(mockLogs);
    });

    it('should clear logs', () => {
      logger.clearLogs();
      expect(mockStorage.clearLogs).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset logger and metrics', () => {
      Logger.reset();
      expect(mockMetrics.reset).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = Logger.getInstance(mockConfig);
    });

    describe('error handling', () => {
      it('should handle metrics recording failure', () => {
        mockMetrics.recordLog.mockImplementation(() => {
          throw new Error('Metrics error');
        });

        expect(() => logger.info('test message')).toThrow('Metrics error');
      });

      it('should handle storage write failure', () => {
        mockStorage.writeLog.mockImplementation(() => {
          throw new Error('Storage error');
        });

        expect(() => logger.info('test message')).toThrow('Storage error');
      });

      it('should handle both metrics and storage failures', () => {
        mockMetrics.recordLog.mockImplementation(() => {
          throw new Error('Metrics error');
        });
        mockStorage.writeLog.mockImplementation(() => {
          throw new Error('Storage error');
        });

        expect(() => logger.info('test message')).toThrow('Metrics error');
      });
    });

    describe('invalid input', () => {
      it('should handle null message', () => {
        expect(() => logger.info(null as any)).toThrow();
      });

      it('should handle undefined message', () => {
        expect(() => logger.info(undefined as any)).toThrow();
      });

      it('should handle invalid context', () => {
        const circularObj: any = { a: 1 };
        circularObj.self = circularObj;

        expect(() => logger.info('test message', circularObj)).toThrow();
      });
    });

    describe('concurrent access', () => {
      it('should handle rapid logging', () => {
        const count = 1000;
        const startTime = Date.now();

        for (let i = 0; i < count; i++) {
          logger.info(`test message ${i}`);
        }

        const duration = Date.now() - startTime;
        expect(mockMetrics.recordLog).toHaveBeenCalledTimes(count);
        expect(mockStorage.writeLog).toHaveBeenCalledTimes(count);
        expect(duration).toBeLessThan(5000); // 5秒以内に完了すること
      });

      it('should handle mixed log levels', () => {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const count = 100;

        for (let i = 0; i < count; i++) {
          const level = levels[i % levels.length];
          switch (level) {
            case LogLevel.DEBUG:
              logger.debug(`test message ${i}`);
              break;
            case LogLevel.INFO:
              logger.info(`test message ${i}`);
              break;
            case LogLevel.WARN:
              logger.warn(`test message ${i}`);
              break;
            case LogLevel.ERROR:
              logger.error(`test message ${i}`);
              break;
          }
        }

        expect(mockMetrics.recordLog).toHaveBeenCalledTimes(count);
        expect(mockStorage.writeLog).toHaveBeenCalledTimes(count);
      });
    });

    describe('resource limits', () => {
      it('should handle large messages', () => {
        const largeMessage = 'x'.repeat(1000);
        const largeContext = {
          data: 'y'.repeat(1000),
          nested: {
            data: 'z'.repeat(1000),
            array: Array(1000).fill('w'),
          },
        };

        logger.info(largeMessage, largeContext);
        expect(mockStorage.writeLog).toHaveBeenCalledWith(
          expect.objectContaining({
            message: largeMessage,
            context: largeContext,
          })
        );
      });

      it('should handle large error objects', () => {
        const error = new Error('test error');
        error.stack = 'x'.repeat(1000);
        const context = {
          data: 'y'.repeat(1000),
          error: {
            message: 'z'.repeat(1000),
            stack: 'w'.repeat(1000),
          },
        };

        logger.error('test message', error, context);
        expect(mockStorage.writeLog).toHaveBeenCalledWith(
          expect.objectContaining({
            level: LogLevel.ERROR,
            context: expect.objectContaining({
              ...context,
              error: {
                message: error.message,
                stack: error.stack,
              },
            }),
          })
        );
      });
    });

    describe('configuration changes', () => {
      it('should handle log level changes', () => {
        mockConfig.logging.level = LogLevel.DEBUG;
        logger = Logger.getInstance(mockConfig);
        logger.debug('debug message');
        expect(mockMetrics.recordLog).toHaveBeenCalledWith(LogLevel.DEBUG, 'debug message');

        mockConfig.logging.level = LogLevel.ERROR;
        logger = Logger.getInstance(mockConfig);
        logger.debug('debug message');
        expect(mockMetrics.recordLog).toHaveBeenCalledTimes(1);
      });

      it('should handle storage configuration changes', () => {
        mockConfig.logging.maxFileSize = 50;
        logger = Logger.getInstance(mockConfig);
        const entry = {
          timestamp: '2024-01-01T00:00:00.000Z',
          level: LogLevel.INFO,
          message: 'test message',
        };

        mockStorage.writeLog.mockImplementation(() => {
          throw new Error('File too large');
        });

        expect(() => logger.info('test message')).toThrow('File too large');
      });
    });
  });
}); 