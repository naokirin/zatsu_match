export class SlackError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SlackError';
  }
}

export class ValidationError extends SlackError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
    this.name = 'ValidationError';
  }
}

export class SlackApiError extends SlackError {
  constructor(message: string, details?: unknown) {
    super(message, 500, details);
    this.name = 'SlackApiError';
  }
}

export class CommandError extends SlackError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
    this.name = 'CommandError';
  }
} 