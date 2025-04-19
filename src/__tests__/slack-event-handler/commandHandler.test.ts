// モックを変数に入れて先に定義
const mockSlackFunctions = {
  sendSlackEphemeralMessage: jest.fn(),
};

const mockRegisterAvailability = jest.fn();
const mockGetUserAvailabilities = jest.fn();
const mockDeleteAvailability = jest.fn();
const mockDeleteAllUserAvailabilities = jest.fn();

// モックをインポートより前に設定
jest.mock("../../services/slack", () => mockSlackFunctions);
jest.mock("../../repositories/availability", () => {
  const originalModule = jest.requireActual("../../repositories/availability");

  return {
    ...originalModule,
    registerAvailability: mockRegisterAvailability,
    getUserAvailabilities: mockGetUserAvailabilities,
    deleteAvailability: mockDeleteAvailability,
    deleteAllUserAvailabilities: mockDeleteAllUserAvailabilities,
  };
});

import { handleSlackCommand } from "../../lambdas/slack-event-handler/commandHandler";
import type { SlackCommand } from "../../types/slack";
import { sendSlackEphemeralMessage } from "../../services/slack";

describe("Slack Command Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisterAvailability.mockResolvedValue(true);
  });

  describe("handleSlackCommand", () => {
    it("should handle /zatsu_match command", async () => {
      const mockCommand: SlackCommand = {
        command: "/zatsu_match",
        user_id: "test-user",
        channel_id: "test-channel",
        text: "register 2024-01-02 10:00-11:00",
        response_url: "https://test.com",
      };

      await handleSlackCommand(mockCommand, { traceId: "test-trace-id" });

      expect(mockRegisterAvailability).toHaveBeenCalledTimes(2);
      expect(mockRegisterAvailability).toHaveBeenCalledWith(
        "test-user",
        "2024-01-02T10:00",
        "test-channel",
      );
      expect(mockRegisterAvailability).toHaveBeenCalledWith(
        "test-user",
        "2024-01-02T10:30",
        "test-channel",
      );
    });

    it("should handle 30 minute interval registration", async () => {
      const mockCommand: SlackCommand = {
        command: "/zatsu_match",
        user_id: "test-user",
        channel_id: "test-channel",
        text: "register 2024-01-02 10:30-12:00",
        response_url: "https://test.com",
      };

      await handleSlackCommand(mockCommand, { traceId: "test-trace-id" });

      expect(mockRegisterAvailability).toHaveBeenCalledTimes(3);
      expect(mockRegisterAvailability).toHaveBeenCalledWith(
        "test-user",
        "2024-01-02T10:30",
        "test-channel",
      );
      expect(mockRegisterAvailability).toHaveBeenCalledWith(
        "test-user",
        "2024-01-02T11:00",
        "test-channel",
      );
      expect(mockRegisterAvailability).toHaveBeenCalledWith(
        "test-user",
        "2024-01-02T11:30",
        "test-channel",
      );
    });

    it("should handle unknown command", async () => {
      const mockCommand: SlackCommand = {
        command: "/unknown",
        user_id: "test-user",
        channel_id: "test-channel",
        text: "",
        response_url: "https://test.com",
      };

      await handleSlackCommand(mockCommand, { traceId: "test-trace-id" });

      expect(sendSlackEphemeralMessage).toHaveBeenCalledWith(
        "test-channel",
        "test-user",
        "Unknown command: /unknown",
      );
    });
  });

  describe("handle delete command", () => {
    it("should handle delete with time range", async () => {
      const mockCommand: SlackCommand = {
        command: "/zatsu_match",
        user_id: "test-user",
        channel_id: "test-channel",
        text: "delete 2024-01-02 10:30-11:30",
        response_url: "https://test.com",
      };

      await handleSlackCommand(mockCommand, { traceId: "test-trace-id" });

      expect(mockDeleteAvailability).toHaveBeenCalledTimes(2);
      expect(mockDeleteAvailability).toHaveBeenCalledWith(
        "test-user",
        "2024-01-02T10:30",
      );
      expect(mockDeleteAvailability).toHaveBeenCalledWith(
        "test-user",
        "2024-01-02T11:00",
      );
    });

    it("should handle delete all command", async () => {
      const mockCommand: SlackCommand = {
        command: "/zatsu_match",
        user_id: "test-user",
        channel_id: "test-channel",
        text: "delete all",
        response_url: "https://test.com",
      };

      await handleSlackCommand(mockCommand, { traceId: "test-trace-id" });

      expect(mockDeleteAllUserAvailabilities).toHaveBeenCalledWith("test-user");
    });
  });

  describe("handle list command", () => {
    it("should format availabilities with both hour and half-hour intervals", async () => {
      const mockCommand: SlackCommand = {
        command: "/zatsu_match",
        user_id: "test-user",
        channel_id: "test-channel",
        text: "list",
        response_url: "https://test.com",
      };

      // 30分間隔と1時間間隔が混在したデータ
      mockGetUserAvailabilities.mockResolvedValue([
        {
          userId: "test-user",
          timestamp: "2024-01-02T10:00",
          channelId: "test-channel",
        },
        {
          userId: "test-user",
          timestamp: "2024-01-02T10:30",
          channelId: "test-channel",
        },
        {
          userId: "test-user",
          timestamp: "2024-01-02T13:00",
          channelId: "test-channel",
        },
        {
          userId: "test-user",
          timestamp: "2024-01-03T14:30",
          channelId: "test-channel",
        },
      ]);

      await handleSlackCommand(mockCommand, { traceId: "test-trace-id" });

      // 期待されるメッセージの形式をチェック
      expect(sendSlackEphemeralMessage).toHaveBeenCalledWith(
        "test-channel",
        "test-user",
        expect.stringContaining(
          "2024-01-02: 10:00-10:30, 10:30-11:00, 13:00-13:30",
        ),
      );

      expect(sendSlackEphemeralMessage).toHaveBeenCalledWith(
        "test-channel",
        "test-user",
        expect.stringContaining("2024-01-03: 14:30-15:00"),
      );
    });

    it("should inform when no availabilities are found", async () => {
      const mockCommand: SlackCommand = {
        command: "/zatsu_match",
        user_id: "test-user",
        channel_id: "test-channel",
        text: "list",
        response_url: "https://test.com",
      };

      // 空のリストを返す
      mockGetUserAvailabilities.mockResolvedValue([]);

      await handleSlackCommand(mockCommand, { traceId: "test-trace-id" });

      expect(sendSlackEphemeralMessage).toHaveBeenCalledWith(
        "test-channel",
        "test-user",
        "登録されている空き時間はありません。",
      );
    });
  });
});
