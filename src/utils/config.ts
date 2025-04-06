import { Config, ConfigValidationError } from '../types/config';
import { LogLevel } from './logger';

const DEFAULT_CONFIG: Config = {
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
};

export class ConfigError extends Error {
  constructor(public readonly errors: ConfigValidationError[]) {
    super('Configuration validation failed');
    this.name = 'ConfigError';
  }
}

export function loadConfig(): Config {
  const config = { ...DEFAULT_CONFIG };
  const errors: ConfigValidationError[] = [];

  // Slack configuration
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    errors.push({
      field: 'SLACK_BOT_TOKEN',
      message: 'Slack bot token is required',
    });
  } else {
    config.slack.botToken = botToken;
  }

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    errors.push({
      field: 'SLACK_SIGNING_SECRET',
      message: 'Slack signing secret is required',
    });
  } else {
    config.slack.signingSecret = signingSecret;
  }

  // Logging configuration
  const logLevel = process.env.LOG_LEVEL as LogLevel;
  if (logLevel && Object.values(LogLevel).includes(logLevel)) {
    config.logging.level = logLevel;
  }

  // Matching configuration
  const minMembers = parseInt(process.env.MIN_MEMBERS || '2', 10);
  if (!isNaN(minMembers) && minMembers > 0) {
    config.matching.minMembers = minMembers;
  }

  const maxMembers = parseInt(process.env.MAX_MEMBERS || '10', 10);
  if (!isNaN(maxMembers) && maxMembers > 0 && maxMembers >= minMembers) {
    config.matching.maxMembers = maxMembers;
  }

  // Huddle configuration
  const channelPrefix = process.env.CHANNEL_PREFIX;
  if (channelPrefix) {
    config.huddle.channelPrefix = channelPrefix;
  }

  const isPrivate = process.env.HUDDLE_PRIVATE !== 'false';
  config.huddle.isPrivate = isPrivate;

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }

  return config;
}

export function validateConfig(config: Config): void {
  const errors: ConfigValidationError[] = [];

  // Validate Slack configuration
  if (!config.slack.botToken) {
    errors.push({
      field: 'slack.botToken',
      message: 'Slack bot token is required',
    });
  }

  if (!config.slack.signingSecret) {
    errors.push({
      field: 'slack.signingSecret',
      message: 'Slack signing secret is required',
    });
  }

  // Validate Matching configuration
  if (config.matching.minMembers <= 0) {
    errors.push({
      field: 'matching.minMembers',
      message: 'Minimum members must be greater than 0',
    });
  }

  if (config.matching.maxMembers <= 0) {
    errors.push({
      field: 'matching.maxMembers',
      message: 'Maximum members must be greater than 0',
    });
  }

  if (config.matching.maxMembers < config.matching.minMembers) {
    errors.push({
      field: 'matching.maxMembers',
      message: 'Maximum members must be greater than or equal to minimum members',
    });
  }

  // Validate Huddle configuration
  if (!config.huddle.channelPrefix) {
    errors.push({
      field: 'huddle.channelPrefix',
      message: 'Channel prefix is required',
    });
  }

  if (errors.length > 0) {
    throw new ConfigError(errors);
  }
} 