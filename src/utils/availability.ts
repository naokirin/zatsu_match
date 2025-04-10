import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const dynamodb: DynamoDBDocument = DynamoDBDocument.from(new DynamoDB());
const TABLE_NAME = process.env.DYNAMODB_TABLE ?? "";

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

export function parseTimeRange(dateStr: string, timeRange: string): string[] {
  const [startTime, endTime] = timeRange.split("-");

  if (!startTime || !endTime) {
    throw new Error(
      `Invalid time range format: ${timeRange}. Expected format: HH:MM-HH:MM`,
    );
  }

  const [startHourStr, startMinStr = "00"] = startTime.split(":");
  const [endHourStr, endMinStr = "00"] = endTime.split(":");

  const startHour = Number.parseInt(startHourStr);
  const startMin = Number.parseInt(startMinStr);
  const endHour = Number.parseInt(endHourStr);
  const endMin = Number.parseInt(endMinStr);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(endHour) ||
    Number.isNaN(startMin) ||
    Number.isNaN(endMin)
  ) {
    throw new Error(
      `Invalid time format: ${timeRange}. Expected format: HH:MM-HH:MM`,
    );
  }

  const startTimeInMinutes = startHour * 60 + startMin;
  const endTimeInMinutes = endHour * 60 + endMin;

  if (startTimeInMinutes >= endTimeInMinutes) {
    throw new Error(
      `Invalid time range: ${timeRange}. End time must be later than start time.`,
    );
  }

  const timestamps: string[] = [];
  for (
    let timeInMinutes = startTimeInMinutes;
    timeInMinutes < endTimeInMinutes;
    timeInMinutes += 30
  ) {
    const hour = Math.floor(timeInMinutes / 60);
    const minute = timeInMinutes % 60;
    timestamps.push(
      `${dateStr}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
    );
  }

  return timestamps;
}

export async function deletePastAvailabilities(): Promise<number> {
  try {
    const now = new Date();
    const currentTimestamp = now.toISOString().slice(0, 16);

    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
    });

    const availabilities = result.Items as AvailabilityRecord[];

    const pastAvailabilities = availabilities.filter(
      (availability) => availability.timestamp < currentTimestamp,
    );

    if (pastAvailabilities.length === 0) {
      return 0;
    }

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

    return pastAvailabilities.length;
  } catch (error) {
    console.error("過去の登録データ削除中にエラーが発生しました:", error);
    throw error;
  }
}

export async function createMatches(targetTimestamp: string): Promise<Match[]> {
  try {
    const timeToMatch = targetTimestamp;

    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
    });

    const availabilities = result.Items as Availability[];

    const timestampGroups = new Map<string, Match[]>();

    const MAX_USERS_PER_MATCH = process.env.MAX_USERS_PER_MATCH
      ? Number.parseInt(process.env.MAX_USERS_PER_MATCH)
      : 5;

    for (const availability of availabilities) {
      if (availability.timestamp === timeToMatch) {
        if (!timestampGroups.has(availability.timestamp)) {
          timestampGroups.set(availability.timestamp, []);
        }

        const matches = timestampGroups.get(availability.timestamp) ?? [];

        let matchFound = false;
        for (const match of matches) {
          if (match.users.length < MAX_USERS_PER_MATCH) {
            match.users.push(availability.userId);
            match.channelIds.push(availability.channelId);
            matchFound = true;
            break;
          }
        }

        if (!matchFound) {
          matches.push({
            timestamp: availability.timestamp,
            users: [availability.userId],
            channelIds: [availability.channelId],
          });
        }
      }
    }

    const allMatches: Match[] = [];
    for (const matches of timestampGroups.values()) {
      allMatches.push(...matches);
    }

    return allMatches;
  } catch (error) {
    console.error("マッチング作成中にエラーが発生しました:", error);
    throw error;
  }
}

export interface Match {
  timestamp: string;
  users: string[];
  channelIds: string[];
}
