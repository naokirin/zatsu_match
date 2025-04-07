// モックを変数に入れて先に定義
const mockHandleSlackCommand = jest.fn();

// モックをインポートより前に設定
jest.mock("../../slack-event-handler/commandHandler", () => {
  const originalModule = jest.requireActual(
    "../../slack-event-handler/commandHandler",
  );
  return {
    ...originalModule,
    handleSlackCommand: mockHandleSlackCommand,
  };
});

import { handleSlackEvent } from "../../slack-event-handler/eventHandler";
import type { SlackEvent } from "../../types/slack";

describe("Slack Event Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleSlackEvent", () => {
    it("should handle message event", async () => {
      const mockEvent: SlackEvent = {
        type: "event_callback",
        event: {
          type: "message",
          user: "test-user",
          text: "<@1AUG9KI> test message",
          channel: "test-channel",
          ts: "1234567890",
        },
      };

      await handleSlackEvent(mockEvent, { traceId: "test-trace-id" });

      expect(mockHandleSlackCommand).toHaveBeenCalledTimes(1);
    });

    it("should not create huddles when there are no members", async () => {
      const mockEvent: SlackEvent = {
        type: "event_callback",
        event: {
          type: "message",
          user: "test-user",
          text: "test message",
          channel: "test-channel",
          ts: "1234567890",
        },
      };

      await handleSlackEvent(mockEvent, { traceId: "test-trace-id" });

      expect(mockHandleSlackCommand).not.toHaveBeenCalled();
    });

    it("should not handle non-message events", async () => {
      const mockEvent: SlackEvent = {
        type: "event_callback",
        event: {
          type: "non_message",
          user: "test-user",
          text: "test message",
          channel: "test-channel",
          ts: "1234567890",
        },
      };

      await handleSlackEvent(mockEvent, { traceId: "test-trace-id" });

      expect(mockHandleSlackCommand).not.toHaveBeenCalled();
    });

    it("should not handle message events without user or channel", async () => {
      const mockEvent: SlackEvent = {
        type: "event_callback",
        event: {
          type: "message",
          user: "",
          text: "test message",
          channel: "",
          ts: "1234567890",
        },
      };

      await handleSlackEvent(mockEvent, { traceId: "test-trace-id" });

      expect(mockHandleSlackCommand).not.toHaveBeenCalled();
    });
  });
});
