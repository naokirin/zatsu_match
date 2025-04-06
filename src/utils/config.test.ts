import { loadConfig, validateConfig, ConfigError } from './config';
import { LogLevel } from './logger';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load default values when no environment variables are set', () => {
      const config = loadConfig();
      expect(config).toEqual({
        slack: {
          botToken: '',
          signingSecret: '',
        },
        logging: {
          level: LogLevel.INFO,
        },
        matching: {
          minMembers: 2,
          maxMembers: 10,
        },
        huddle: {
          channelPrefix: 'huddle-',
          isPrivate: true,
        },
      });
    });

    it('should load values from environment variables', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
      process.env.LOG_LEVEL = LogLevel.DEBUG;
      process.env.MIN_MEMBERS = '3';
      process.env.MAX_MEMBERS = '5';
      process.env.CHANNEL_PREFIX = 'test-';
      process.env.HUDDLE_PRIVATE = 'false';

      const config = loadConfig();
      expect(config).toEqual({
        slack: {
          botToken: 'xoxb-test-token',
          signingSecret: 'test-secret',
        },
        logging: {
          level: LogLevel.DEBUG,
        },
        matching: {
          minMembers: 3,
          maxMembers: 5,
        },
        huddle: {
          channelPrefix: 'test-',
          isPrivate: false,
        },
      });
    });

    it('should throw ConfigError when required environment variables are missing', () => {
      expect(() => loadConfig()).toThrow(ConfigError);
    });
  });

  describe('validateConfig', () => {
    it('should not throw when config is valid', () => {
      const config = {
        slack: {
          botToken: 'xoxb-test-token',
          signingSecret: 'test-secret',
        },
        logging: {
          level: LogLevel.INFO,
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

      expect(() => validateConfig(config)).not.toThrow();
    });

    it('should throw ConfigError when slack.botToken is missing', () => {
      const config = {
        slack: {
          botToken: '',
          signingSecret: 'test-secret',
        },
        logging: {
          level: LogLevel.INFO,
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

      expect(() => validateConfig(config)).toThrow(ConfigError);
    });

    it('should throw ConfigError when matching.maxMembers is less than minMembers', () => {
      const config = {
        slack: {
          botToken: 'xoxb-test-token',
          signingSecret: 'test-secret',
        },
        logging: {
          level: LogLevel.INFO,
        },
        matching: {
          minMembers: 5,
          maxMembers: 3,
        },
        huddle: {
          channelPrefix: 'test-',
          isPrivate: true,
        },
      };

      expect(() => validateConfig(config)).toThrow(ConfigError);
    });
  });
}); 