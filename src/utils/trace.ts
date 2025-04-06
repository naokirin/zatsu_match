import { APIGatewayProxyEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';

export function generateTraceId(): string {
  return randomUUID();
}

export function getTraceIdFromEvent(event: APIGatewayProxyEvent): string | undefined {
  return event.headers?.['x-trace-id'];
} 