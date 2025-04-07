import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent } from "aws-lambda";

export function generateTraceId(): string {
  return randomUUID();
}

export function getTraceIdFromEvent(
  event: APIGatewayProxyEvent,
): string | undefined {
  return event.headers?.["x-trace-id"];
}
