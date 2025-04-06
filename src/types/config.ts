export interface Config {
  slack: {
    botToken: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
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