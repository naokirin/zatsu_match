import "aws-sdk-client-mock-jest";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

import {
  getUserAvailabilities,
  registerAvailability,
} from "../../repositories/availability";

describe("空き時間管理機能", () => {
  const mockDynamoDB = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    mockDynamoDB.reset();

    mockDynamoDB.on(QueryCommand).resolves({ Items: [] });
    mockDynamoDB.on(PutCommand).resolves({});
    mockDynamoDB.on(DeleteCommand).resolves({});
    mockDynamoDB.on(GetCommand).resolves({ Item: undefined });
  });

  describe("registerAvailability()", () => {
    it("空き時間を正しく登録し、trueを返すこと", async () => {
      // テストデータ
      const userId = "U123456";
      const timestamp = "2023-12-15T13:00";
      const channelId = "C123456";

      // GetCommandで既存の登録がないことをモック
      mockDynamoDB.on(GetCommand).resolves({ Item: undefined });

      // 関数実行
      const result = await registerAvailability(userId, timestamp, channelId);

      // 検証
      expect(result).toBe(true);

      // GetCommandが呼ばれたことを確認
      const getCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof GetCommand);
      expect(getCalls).toHaveLength(1);
      expect(getCalls[0].args[0].input).toEqual({
        TableName: "zatsumatchs",
        Key: {
          userId,
          timestamp,
        },
      });

      // PutCommandが呼ばれたことを確認
      const putCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof PutCommand);
      expect(putCalls).toHaveLength(1);
      expect(putCalls[0].args[0].input).toEqual({
        TableName: "zatsumatchs",
        Item: {
          userId,
          timestamp,
          channelId,
          createdAt: expect.any(String),
        },
      });
    });

    it("既に登録されている場合は登録せず、falseを返すこと", async () => {
      // テストデータ
      const userId = "U123456";
      const timestamp = "2023-12-15T13:00";
      const channelId = "C123456";

      // 既存の登録があることをモック
      mockDynamoDB.on(GetCommand).resolves({
        Item: {
          userId,
          timestamp,
          channelId,
          createdAt: "2023-12-01T00:00:00Z",
        },
      });

      // 関数実行
      const result = await registerAvailability(userId, timestamp, channelId);

      // 検証
      expect(result).toBe(false);

      // GetCommandが呼ばれたことを確認
      const getCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof GetCommand);
      expect(getCalls).toHaveLength(1);

      // PutCommandが呼ばれていないことを確認
      const putCalls = mockDynamoDB
        .calls()
        .filter((call) => call.args[0] instanceof PutCommand);
      expect(putCalls).toHaveLength(0);
    });
  });

  describe("getUserAvailabilities()", () => {
    it("ユーザーの空き時間を取得すること", async () => {
      // モックの戻り値を設定
      const mockItems = [
        {
          userId: "U123456",
          timestamp: "2023-12-15T13:00",
          channelId: "C123456",
          createdAt: "2023-12-01T00:00:00Z",
        },
      ];
      mockDynamoDB.on(QueryCommand).resolves({ Items: mockItems });

      // テストデータ
      const userId = "U123456";

      // 関数実行
      const result = await getUserAvailabilities(userId);

      // 検証
      expect(
        mockDynamoDB
          .calls()
          .filter((call) => call.args[0] instanceof QueryCommand),
      ).toHaveLength(1);
      const queryCall = mockDynamoDB
        .calls()
        .find((call) => call.args[0] instanceof QueryCommand);
      expect(queryCall?.args[0].input).toEqual({
        TableName: "zatsumatchs",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      });
      expect(result).toEqual(mockItems);
    });
  });
});
