import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const dynamodb: DynamoDBDocument = DynamoDBDocument.from(new DynamoDB());
const TABLE_NAME = process.env.DYNAMODB_TABLE ?? "zatsumaches";

export interface Availability {
  userId: string;
  timestamp: string;
  channelId: string;
}

export interface AvailabilityRecord extends Availability {
  createdAt: string;
}

export async function registerAvailability(
  userId: string,
  timestamp: string,
  channelId: string,
): Promise<boolean> {
  const existingAvailability = await dynamodb.get({
    TableName: TABLE_NAME,
    Key: {
      userId,
      timestamp,
    },
  });

  if (existingAvailability.Item) {
    return false;
  }

  const item: AvailabilityRecord = {
    userId,
    timestamp,
    channelId,
    createdAt: new Date().toISOString(),
  };

  await dynamodb.put({
    TableName: TABLE_NAME,
    Item: item,
  });

  return true;
}

export async function getUserAvailabilities(
  userId: string,
): Promise<AvailabilityRecord[]> {
  const result = await dynamodb.query({
    TableName: TABLE_NAME,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  });

  return result.Items as AvailabilityRecord[];
}

export async function fetchAllAvailabilities(): Promise<AvailabilityRecord[]> {
  const result = await dynamodb.scan({
    TableName: TABLE_NAME,
  });
  return result.Items as AvailabilityRecord[];
}

export async function deleteAvailabilities(
  availabilities: AvailabilityRecord[],
): Promise<void> {
  const deletePromises = availabilities.map((item) => {
    return dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        userId: item.userId,
        timestamp: item.timestamp,
      },
    });
  });
  await Promise.all(deletePromises);
}

export async function fetchAvailabilities(
  targetTimestamp: string,
): Promise<Availability[]> {
  const result = await dynamodb.scan({
    TableName: TABLE_NAME,
  });
  return result.Items as Availability[];
}

export async function deleteAllUserAvailabilities(
  userId: string,
): Promise<void> {
  const availabilities = await getUserAvailabilities(userId);

  const deletePromises = availabilities.map((availability) => {
    return dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        userId: availability.userId,
        timestamp: availability.timestamp,
      },
    });
  });

  await Promise.all(deletePromises);
}

export async function deleteAvailability(
  userId: string,
  timestamp: string,
): Promise<void> {
  await dynamodb.delete({
    TableName: TABLE_NAME,
    Key: {
      userId,
      timestamp,
    },
  });
}
