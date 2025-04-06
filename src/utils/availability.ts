import { DynamoDB } from 'aws-sdk';

const dynamodb = new DynamoDB.DocumentClient();
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
): Promise<void> {
  const item: AvailabilityRecord = {
    userId,
    timestamp,
    channelId,
    createdAt: new Date().toISOString()
  };

  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: item
  }).promise();
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
  }).promise();

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
  }).promise();
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
    }).promise();
  });

  await Promise.all(deletePromises);
}

/**
 * 日付文字列と時間範囲からタイムスタンプの配列を生成する
 * 例: parseTimeRange('2023-12-15', '13:00-15:00') => ['2023-12-15T13:00', '2023-12-15T14:00']
 */
export function parseTimeRange(dateStr: string, timeRange: string): string[] {
  const [startTime, endTime] = timeRange.split('-');

  if (!startTime || !endTime) {
    throw new Error(`Invalid time range format: ${timeRange}. Expected format: HH:MM-HH:MM`);
  }

  const startHour = parseInt(startTime.split(':')[0]);
  const endHour = parseInt(endTime.split(':')[0]);

  if (isNaN(startHour) || isNaN(endHour) || startHour >= endHour) {
    throw new Error(`Invalid time range: ${timeRange}. End time must be later than start time.`);
  }

  const timestamps: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    timestamps.push(`${dateStr}T${hour.toString().padStart(2, '0')}:00`);
  }

  return timestamps;
} 