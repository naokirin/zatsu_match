import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { SlackCommand, SlackEvent } from "../../types/slack";
import { ConfigError, SlackError, ValidationError } from "../../utils/errors";
import { generateTraceId, getTraceIdFromEvent } from "../../utils/trace";
import { handleSlackCommand } from "./commandHandler";
import { handleSlackEvent } from "./eventHandler";

interface SlackUrlVerification {
  type: "url_verification";
  challenge: string;
}

type SlackRequestBody = SlackUrlVerification | SlackEvent | SlackCommand;

export async function handler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const traceId = getTraceIdFromEvent(event) || generateTraceId();
  const context = { traceId };

  try {
    console.info("Received request", { ...context, event });

    if (!event.body) {
      console.warn("Missing request body", context);
      throw new ValidationError("Missing request body");
    }

    const body = JSON.parse(event.body) as SlackRequestBody;
    return processSlackRequest(body, context);
  } catch (error) {
    console.error("Error processing request", error as Error, {
      traceId: context.traceId,
    });
    return handleError(error);
  }
}

function processSlackRequest(
  body: SlackRequestBody,
  context: { traceId: string },
): APIGatewayProxyResult {
  if (isUrlVerification(body)) {
    console.debug("Handling URL verification", context);
    return createSuccessResponse({ challenge: body.challenge });
  }

  if (isEventCallback(body)) {
    console.info("Handling event callback", {
      ...context,
      eventType: body.event.type,
    });
    handleSlackEvent(body, context);
    return createSuccessResponse({ message: "Event processed successfully" });
  }

  if (isCommandRequest(body)) {
    console.info("Handling command request", {
      ...context,
      command: body.command,
    });
    handleSlackCommand(body, context);
    return createSuccessResponse({
      message: "Command processed successfully",
    });
  }

  console.warn("Invalid request type", context);
  throw new ValidationError("Invalid request type");
}

function isUrlVerification(
  body: SlackRequestBody,
): body is SlackUrlVerification {
  return "type" in body && body.type === "url_verification";
}

function isEventCallback(body: SlackRequestBody): body is SlackEvent {
  return "type" in body && body.type === "event_callback";
}

function isCommandRequest(body: SlackRequestBody): body is SlackCommand {
  return "command" in body;
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
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }),
  };
}
