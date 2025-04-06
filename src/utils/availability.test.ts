import 'aws-sdk-client-mock-jest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  registerAvailability,
  getUserAvailabilities,
  deleteAvailability,
  deleteAllUserAvailabilities,
  parseTimeRange
} from './availability';

describe('空き時間管理機能', () => {
  const mockDynamoDB = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    mockDynamoDB.reset();

    mockDynamoDB.on(QueryCommand).resolves({ Items: [] });
    mockDynamoDB.on(PutCommand).resolves({});
    mockDynamoDB.on(DeleteCommand).resolves({});
  });

  describe('registerAvailability()', () => {
    it('空き時間を正しく登録すること', async () => {
      // テストデータ
      const userId = 'U123456';
      const timestamp = '2023-12-15T13:00';
      const channelId = 'C123456';

      // 関数実行
      await registerAvailability(userId, timestamp, channelId);

      // 検証
      expect(mockDynamoDB.calls()).toHaveLength(1);
      expect(mockDynamoDB.call(0).args[0].input).toEqual({
        TableName: process.env.DYNAMODB_TABLE,
        Item: {
          userId,
          timestamp,
          channelId,
          createdAt: expect.any(String)
        }
      });
    });
  });

  describe('getUserAvailabilities()', () => {
    it('ユーザーの空き時間を取得すること', async () => {
      // モックの戻り値を設定
      const mockItems = [
        { userId: 'U123456', timestamp: '2023-12-15T13:00', channelId: 'C123456', createdAt: '2023-12-01T00:00:00Z' }
      ];
      mockDynamoDB.on(QueryCommand).resolves({ Items: mockItems });

      // テストデータ
      const userId = 'U123456';

      // 関数実行
      const result = await getUserAvailabilities(userId);

      // 検証
      expect(mockDynamoDB.calls().filter(call => call.args[0] instanceof QueryCommand)).toHaveLength(1);
      const queryCall = mockDynamoDB.calls().find(call => call.args[0] instanceof QueryCommand);
      expect(queryCall?.args[0].input).toEqual({
        TableName: process.env.DYNAMODB_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      });
      expect(result).toEqual(mockItems);
    });
  });

  describe('deleteAvailability()', () => {
    it('特定の空き時間を削除すること', async () => {
      // テストデータ
      const userId = 'U123456';
      const timestamp = '2023-12-15T13:00';

      // 関数実行
      await deleteAvailability(userId, timestamp);

      // 検証
      expect(mockDynamoDB.calls().filter(call => call.args[0] instanceof DeleteCommand)).toHaveLength(1);
      const deleteCall = mockDynamoDB.calls().find(call => call.args[0] instanceof DeleteCommand);
      expect(deleteCall?.args[0].input).toEqual({
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
          userId,
          timestamp
        }
      });
    });
  });

  describe('deleteAllUserAvailabilities()', () => {
    it('ユーザーの全ての空き時間を削除すること', async () => {
      // モックの戻り値を設定
      const mockItems = [
        { userId: 'U123456', timestamp: '2023-12-15T13:00', channelId: 'C123456', createdAt: '2023-12-01T00:00:00Z' },
        { userId: 'U123456', timestamp: '2023-12-15T14:00', channelId: 'C123456', createdAt: '2023-12-01T00:00:00Z' }
      ];
      mockDynamoDB.on(QueryCommand).resolves({ Items: mockItems });

      // テストデータ
      const userId = 'U123456';

      // 関数実行
      await deleteAllUserAvailabilities(userId);

      // 検証
      const queryCalls = mockDynamoDB.calls().filter(call => call.args[0] instanceof QueryCommand);
      expect(queryCalls).toHaveLength(1);

      const deleteCalls = mockDynamoDB.calls().filter(call => call.args[0] instanceof DeleteCommand);
      expect(deleteCalls).toHaveLength(2);

      expect(deleteCalls[0].args[0].input).toEqual({
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
          userId: 'U123456',
          timestamp: '2023-12-15T13:00'
        }
      });

      expect(deleteCalls[1].args[0].input).toEqual({
        TableName: process.env.DYNAMODB_TABLE,
        Key: {
          userId: 'U123456',
          timestamp: '2023-12-15T14:00'
        }
      });
    });
  });

  describe('parseTimeRange()', () => {
    it('時間範囲を正しくパースすること', () => {
      const dateStr = '2023-12-15';
      const timeRange = '13:00-15:00';

      const result = parseTimeRange(dateStr, timeRange);

      expect(result).toEqual([
        '2023-12-15T13:00',
        '2023-12-15T14:00'
      ]);
    });

    it('不正な時間範囲でエラーをスローすること（フォーマットエラー）', () => {
      const dateStr = '2023-12-15';
      const timeRange = '13:00';

      expect(() => {
        parseTimeRange(dateStr, timeRange);
      }).toThrow('Invalid time range format: 13:00. Expected format: HH:MM-HH:MM');
    });

    it('不正な時間範囲でエラーをスローすること（開始時間が終了時間より後）', () => {
      const dateStr = '2023-12-15';
      const timeRange = '15:00-13:00';

      expect(() => {
        parseTimeRange(dateStr, timeRange);
      }).toThrow('Invalid time range: 15:00-13:00. End time must be later than start time.');
    });

    it('不正な時間範囲でエラーをスローすること（同じ時間）', () => {
      const dateStr = '2023-12-15';
      const timeRange = '13:00-13:00';

      expect(() => {
        parseTimeRange(dateStr, timeRange);
      }).toThrow('Invalid time range: 13:00-13:00. End time must be later than start time.');
    });
  });
}); 