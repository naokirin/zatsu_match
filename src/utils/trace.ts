import { v4 as uuidv4 } from 'uuid';

export function generateTraceId(): string {
  return uuidv4();
}

export function getTraceIdFromEvent(event: unknown): string | undefined {
  if (typeof event === 'object' && event !== null) {
    const headers = (event as { headers?: Record<string, string> }).headers;
    if (headers) {
      return headers['x-trace-id'] || headers['X-Trace-ID'];
    }
  }
  return undefined;
} 