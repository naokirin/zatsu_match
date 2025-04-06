import { LogLevel } from '../utils/logger';

export interface Config {
  slack: {
    botToken: string;
    signingSecret: string;
  };
  logging: {
    level: LogLevel;
    logDir?: string;
    maxFileSize?: number;
    maxFiles?: number;
  };
  matching: {
    minMembers: number;
    maxMembers: number;
  };
  huddle: {
    channelPrefix: string;
    isPrivate: boolean;
  };
}

export interface ConfigValidationError {
  field: string;
  message: string;
} 