import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

const dynamodb: DynamoDBDocument = DynamoDBDocument.from(new DynamoDB());
const TABLE_NAME = process.env.DYNAMODB_TABLE!;

export interface Availability {
  userId: string;
  timestamp: string;
  channelId: string;
}

export interface AvailabilityRecord extends Availability {
  createdAt: string;
}

/**
 * 空き時間を登録する
 */
export async function registerAvailability(
  userId: string,
  timestamp: string,
  channelId: string
): Promise<boolean> {
  // 既存の登録がないか確認
  const existingAvailability = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      userId,
      timestamp
    }
  });

  // 既に同じ時間に登録がある場合は登録しない
  if (existingAvailability.Item) {
    return false;
  }

  const item: AvailabilityRecord = {
    userId,
    timestamp,
    channelId,
    createdAt: new Date().toISOString()
  };

  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: item
  });

  return true;
}

/**
 * 特定のユーザーの空き時間を取得する
 */
export async function getUserAvailabilities(userId: string): Promise<AvailabilityRecord[]> {
  const result = await dynamodb.query({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });

  return result.Items as AvailabilityRecord[];
}

/**
 * 特定の空き時間を削除する
 */
export async function deleteAvailability(userId: string, timestamp: string): Promise<void> {
  await dynamodb.delete({
    TableName: TABLE_NAME,
    Key: {
      userId,
      timestamp
    }
  });
}

/**
 * ユーザーの全ての空き時間を削除する
 */
export async function deleteAllUserAvailabilities(userId: string): Promise<void> {
  const availabilities = await getUserAvailabilities(userId);

  const deletePromises = availabilities.map(availability => {
    return dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        userId: availability.userId,
        timestamp: availability.timestamp
      }
    });
  });

  await Promise.all(deletePromises);
}

/**
 * 日付文字列と時間範囲からタイムスタンプの配列を生成する
 * 例: parseTimeRange('2023-12-15', '13:00-15:00') => ['2023-12-15T13:00', '2023-12-15T13:30', '2023-12-15T14:00', '2023-12-15T14:30']
 */
export function parseTimeRange(dateStr: string, timeRange: string): string[] {
  const [startTime, endTime] = timeRange.split('-');

  if (!startTime || !endTime) {
    throw new Error(`Invalid time range format: ${timeRange}. Expected format: HH:MM-HH:MM`);
  }

  // 時間と分を分解
  const [startHourStr, startMinStr = '00'] = startTime.split(':');
  const [endHourStr, endMinStr = '00'] = endTime.split(':');

  const startHour = parseInt(startHourStr);
  const startMin = parseInt(startMinStr);
  const endHour = parseInt(endHourStr);
  const endMin = parseInt(endMinStr);

  if (isNaN(startHour) || isNaN(endHour) || isNaN(startMin) || isNaN(endMin)) {
    throw new Error(`Invalid time format: ${timeRange}. Expected format: HH:MM-HH:MM`);
  }

  // 開始時間と終了時間を分単位に変換して比較
  const startTimeInMinutes = startHour * 60 + startMin;
  const endTimeInMinutes = endHour * 60 + endMin;

  if (startTimeInMinutes >= endTimeInMinutes) {
    throw new Error(`Invalid time range: ${timeRange}. End time must be later than start time.`);
  }

  const timestamps: string[] = [];
  // 30分間隔でタイムスタンプを生成
  for (let timeInMinutes = startTimeInMinutes; timeInMinutes < endTimeInMinutes; timeInMinutes += 30) {
    const hour = Math.floor(timeInMinutes / 60);
    const minute = timeInMinutes % 60;
    timestamps.push(
      `${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    );
  }

  return timestamps;
}

/**
 * 現在時刻より前の不要な登録データを削除する
 */
export async function deletePastAvailabilities(): Promise<number> {
  try {
    // 現在時刻を取得
    const now = new Date();
    const currentTimestamp = now.toISOString().slice(0, 16);

    // 全ユーザーの空き時間を取得
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
    });

    const availabilities = result.Items as AvailabilityRecord[];

    // 現在時刻より過去の不要な登録データをフィルタリング
    const pastAvailabilities = availabilities.filter(
      (availability) => availability.timestamp < currentTimestamp
    );

    // 削除対象がなければ0を返す
    if (pastAvailabilities.length === 0) {
      return 0;
    }

    // 削除処理（バッチ処理）
    const deletePromises = pastAvailabilities.map((item) => {
      return dynamodb.delete({
        TableName: TABLE_NAME,
        Key: {
          userId: item.userId,
          timestamp: item.timestamp,
        },
      });
    });

    await Promise.all(deletePromises);

    // 削除したデータの件数を返す
    return pastAvailabilities.length;
  } catch (error) {
    console.error('過去の登録データ削除中にエラーが発生しました:', error);
    throw error;
  }
} 