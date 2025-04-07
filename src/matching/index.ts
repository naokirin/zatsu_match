import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { Match } from '../types/match';
import { deletePastAvailabilities } from '../utils/availability';

const dynamodb = DynamoDBDocument.from(new DynamoDB());

interface Availability {
  userId: string;
  timestamp: string;
  channelId: string;
}

export const handler = async (): Promise<Match[]> => {
  try {
    // 現在時刻から30分後の時刻を取得
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60000);
    const targetTimestamp = thirtyMinutesLater.toISOString().slice(0, 16);

    // 全ユーザーの空き時間を取得
    const result = await dynamodb.scan({
      TableName: process.env.DYNAMODB_TABLE!,
    });

    const availabilities = result.Items as Availability[];

    // タイムスタンプでグループ化
    const timestampGroups = new Map<string, Match>();

    availabilities.forEach((availability) => {
      if (availability.timestamp === targetTimestamp) {
        const match = timestampGroups.get(availability.timestamp) || {
          timestamp: availability.timestamp,
          users: [],
          channelIds: [],
        };

        match.users.push(availability.userId);
        match.channelIds.push(availability.channelId);
        timestampGroups.set(availability.timestamp, match);
      }
    });

    // 過去の不要な登録データを削除
    try {
      const deletedCount = await deletePastAvailabilities();
      if (deletedCount > 0) {
        console.log(`${deletedCount}件の過去の登録データを削除しました`);
      }
    } catch (error) {
      console.error('過去データの削除処理中にエラーが発生しました:', error);
      // エラーが発生してもマッチング処理は続行
    }

    // マッチング結果を返す
    return Array.from(timestampGroups.values());
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}; 