import { Metrics } from './metrics';
import { LogLevel } from './logger';

describe('Metrics', () => {
  let metrics: Metrics;

  beforeEach(() => {
    metrics = Metrics.getInstance();
    metrics.reset();
  });

  describe('recordLog', () => {
    it('should increment total logs count', () => {
      metrics.recordLog(LogLevel.INFO, 'test message');
      expect(metrics.getMetrics().totalLogs).toBe(1);
    });

    it('should increment logs by level count', () => {
      metrics.recordLog(LogLevel.INFO, 'test message');
      metrics.recordLog(LogLevel.ERROR, 'error message');
      const metricsData = metrics.getMetrics();
      expect(metricsData.logsByLevel[LogLevel.INFO]).toBe(1);
      expect(metricsData.logsByLevel[LogLevel.ERROR]).toBe(1);
    });

    it('should record error details when logging error', () => {
      const errorMessage = 'test error';
      const context = { traceId: 'test-trace' };
      metrics.recordLog(LogLevel.ERROR, errorMessage, context);
      const lastError = metrics.getMetrics().lastError;
      expect(lastError).toBeDefined();
      expect(lastError?.message).toBe(errorMessage);
      expect(lastError?.context).toEqual(context);
      expect(lastError?.timestamp).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return a copy of metrics', () => {
      metrics.recordLog(LogLevel.INFO, 'test message');
      const metrics1 = metrics.getMetrics();
      const metrics2 = metrics.getMetrics();
      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2);
    });
  });

  describe('reset', () => {
    it('should reset all metrics to initial values', () => {
      metrics.recordLog(LogLevel.INFO, 'test message');
      metrics.recordLog(LogLevel.ERROR, 'error message');
      metrics.reset();
      const metricsData = metrics.getMetrics();
      expect(metricsData.totalLogs).toBe(0);
      expect(metricsData.logsByLevel[LogLevel.INFO]).toBe(0);
      expect(metricsData.logsByLevel[LogLevel.ERROR]).toBe(0);
      expect(metricsData.errors).toBe(0);
      expect(metricsData.lastError).toBeUndefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Metrics.getInstance();
      const instance2 = Metrics.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      metrics = Metrics.getInstance();
      metrics.reset();
    });

    describe('invalid input', () => {
      it('should handle invalid log level', () => {
        expect(() => metrics.recordLog('INVALID_LEVEL' as LogLevel, 'test message')).toThrow();
      });

      it('should handle null message', () => {
        expect(() => metrics.recordLog(LogLevel.INFO, null as any)).toThrow();
      });

      it('should handle undefined message', () => {
        expect(() => metrics.recordLog(LogLevel.INFO, undefined as any)).toThrow();
      });
    });

    describe('large data', () => {
      it('should handle large context object', () => {
        const largeContext = {
          data: 'x'.repeat(1000),
          nested: {
            data: 'y'.repeat(1000),
            array: Array(1000).fill('z'),
          },
        };

        metrics.recordLog(LogLevel.INFO, 'test message', largeContext);
        const lastError = metrics.getMetrics().lastError;
        expect(lastError).toBeUndefined();
      });

      it('should handle large error stack trace', () => {
        const error = new Error('test error');
        error.stack = 'x'.repeat(1000);
        const context = { traceId: 'test-trace' };

        metrics.recordLog(LogLevel.ERROR, 'test message', { error, ...context });
        const lastError = metrics.getMetrics().lastError;
        expect(lastError?.context?.error.stack).toBe(error.stack);
      });
    });

    describe('concurrent access', () => {
      it('should handle rapid log recording', () => {
        const count = 1000;
        for (let i = 0; i < count; i++) {
          metrics.recordLog(LogLevel.INFO, `test message ${i}`);
        }

        const metricsData = metrics.getMetrics();
        expect(metricsData.totalLogs).toBe(count);
        expect(metricsData.logsByLevel[LogLevel.INFO]).toBe(count);
      });

      it('should handle mixed log levels', () => {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const count = 100;

        for (let i = 0; i < count; i++) {
          const level = levels[i % levels.length];
          metrics.recordLog(level, `test message ${i}`);
        }

        const metricsData = metrics.getMetrics();
        expect(metricsData.totalLogs).toBe(count);
        levels.forEach(level => {
          expect(metricsData.logsByLevel[level]).toBe(count / levels.length);
        });
      });
    });

    describe('error handling', () => {
      it('should handle error with circular reference', () => {
        const circularObj: any = { a: 1 };
        circularObj.self = circularObj;

        metrics.recordLog(LogLevel.ERROR, 'test message', { data: circularObj });
        const lastError = metrics.getMetrics().lastError;
        expect(lastError?.context?.data).toBeDefined();
      });

      it('should handle error with non-serializable data', () => {
        const nonSerializable = {
          func: () => { },
          symbol: Symbol('test'),
        };

        metrics.recordLog(LogLevel.ERROR, 'test message', { data: nonSerializable });
        const lastError = metrics.getMetrics().lastError;
        expect(lastError?.context?.data).toBeDefined();
      });
    });

    describe('memory management', () => {
      it('should handle multiple reset operations', () => {
        for (let i = 0; i < 100; i++) {
          metrics.recordLog(LogLevel.INFO, `test message ${i}`);
          metrics.reset();
        }

        const metricsData = metrics.getMetrics();
        expect(metricsData.totalLogs).toBe(0);
        expect(metricsData.logsByLevel[LogLevel.INFO]).toBe(0);
      });

      it('should handle long-running operations', () => {
        const startTime = Date.now();
        const duration = 1000; // 1秒
        let count = 0;

        while (Date.now() - startTime < duration) {
          metrics.recordLog(LogLevel.INFO, `test message ${count++}`);
        }

        const metricsData = metrics.getMetrics();
        expect(metricsData.totalLogs).toBe(count);
      });
    });
  });
}); 