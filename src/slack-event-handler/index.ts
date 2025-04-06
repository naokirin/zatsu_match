import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleSlackEvent } from './eventHandler';
import { handleSlackCommand } from './commandHandler';
import { SlackEvent, SlackCommand } from '../types/slack';
import { SlackError, ValidationError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { generateTraceId, getTraceIdFromEvent } from '../utils/trace';
import { loadConfig, validateConfig, ConfigError } from '../utils/config';

interface SlackUrlVerification {
  type: 'url_verification';
  challenge: string;
}

type SlackRequestBody = SlackUrlVerification | SlackEvent | SlackCommand;

let config: ReturnType<typeof loadConfig>;

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const traceId = getTraceIdFromEvent(event) || generateTraceId();
  const context = { traceId };

  try {
    // Initialize configuration
    if (!config) {
      config = loadConfig();
      validateConfig(config);
    }

    const logger = Logger.getInstance();

    logger.info('Received request', { ...context, event });

    if (!event.body) {
      logger.warn('Missing request body', context);
      throw new ValidationError('Missing request body');
    }

    const body = JSON.parse(event.body) as SlackRequestBody;

    // URL Verification
    if (isUrlVerification(body)) {
      logger.debug('Handling URL verification', context);
      return createSuccessResponse({ challenge: body.challenge });
    }

    // Handle Slack Events
    if (isEventCallback(body)) {
      logger.info('Handling event callback', { ...context, eventType: body.event.type });
      await handleSlackEvent(body, context);
      return createSuccessResponse({ message: 'Event processed successfully' });
    }

    // Handle Slack Commands
    if (isCommandRequest(body)) {
      logger.info('Handling command request', { ...context, command: body.command });
      await handleSlackCommand(body, context);
      return createSuccessResponse({ message: 'Command processed successfully' });
    }

    logger.warn('Invalid request type', context);
    throw new ValidationError('Invalid request type');
  } catch (error) {
    const logger = Logger.getLogger();
    logger.error('Error processing request', error as Error, { traceId: context.traceId });

    if (error instanceof ConfigError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Configuration error',
          details: error.errors,
        }),
      };
    }

    return handleError(error);
  }
}

function isUrlVerification(body: SlackRequestBody): body is SlackUrlVerification {
  return 'type' in body && body.type === 'url_verification';
}

function isEventCallback(body: SlackRequestBody): body is SlackEvent {
  return 'type' in body && body.type === 'event_callback';
}

function isCommandRequest(body: SlackRequestBody): body is SlackCommand {
  return 'command' in body;
}

function createSuccessResponse(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    body: JSON.stringify(body),
  };
}

function handleError(error: unknown): APIGatewayProxyResult {
  if (error instanceof SlackError) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({
        error: error.message,
        details: error.details,
      }),
    };
  }

  return {
    statusCode: 500,
    body: JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }),
  };
} 