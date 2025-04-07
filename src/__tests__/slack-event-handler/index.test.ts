// モックを変数に入れて先に定義
const mockSlackFunctions = {
  sendSlackEphemeralMessage: jest.fn(),
};

const mockHandleSlackCommand = jest.fn();

// モックをインポートより前に設定
jest.mock("../../utils/slack", () => mockSlackFunctions);
jest.mock("../../slack-event-handler/commandHandler", () => {
  const originalModule = jest.requireActual(
    "../../slack-event-handler/commandHandler",
  );
  return {
    ...originalModule,
    handleSlackCommand: mockHandleSlackCommand,
  };
});

import type {
  APIGatewayEventRequestContext,
  APIGatewayProxyEvent,
} from "aws-lambda";
import { handler } from "../../slack-event-handler";

describe("Slack Event Handler", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SLACK_BOT_TOKEN = "xoxb-test-token";
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("URL Verification", () => {
    it("should handle URL verification challenge", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          type: "url_verification",
          challenge: "test-challenge",
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        challenge: "test-challenge",
      });
    });
  });

  describe("Event Callback", () => {
    it("should handle event callback", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          type: "event_callback",
          event: {
            type: "message",
            user: "test-user",
            channel: "test-channel",
            text: "test message",
            ts: "1234567890",
          },
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: "Event processed successfully",
      });
    });
  });

  describe("Command Request", () => {
    it("should handle command request", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          command: "/match",
          user_id: "test-user",
          channel_id: "test-channel",
          text: "test command",
          response_url: "https://test.com",
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        message: "Command processed successfully",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle missing request body", async () => {
      const event = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: "POST",
        isBase64Encoded: false,
        path: "/",
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as APIGatewayEventRequestContext,
        resource: "",
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: "Missing request body",
        details: undefined,
      });
    });

    it("should handle invalid request type", async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          invalid: "request",
        }),
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: "Invalid request type",
        details: undefined,
      });
    });

    it("should handle JSON parse error", async () => {
      const event: APIGatewayProxyEvent = {
        body: "invalid json",
      } as APIGatewayProxyEvent;

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toEqual({
        error: "Internal server error",
        details: expect.any(String),
      });
    });
  });
});
