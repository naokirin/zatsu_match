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
  const [startTime, endTime] = splitTimeRange(timeRange);
  const [startTimeInMinutes, endTimeInMinutes] = convertTimeToMinutes(
    startTime,
    endTime,
  );
  validateTimeRange(startTimeInMinutes, endTimeInMinutes, timeRange);
  return generateTimestamps(dateStr, startTimeInMinutes, endTimeInMinutes);
}

function splitTimeRange(timeRange: string): [string, string] {
  const [startTime, endTime] = timeRange.split("-");
  if (!startTime || !endTime) {
    throw new Error(
      `Invalid time range format: ${timeRange}. Expected format: HH:MM-HH:MM`,
    );
  }
  return [startTime, endTime];
}

function convertTimeToMinutes(
  startTime: string,
  endTime: string,
): [number, number] {
  const [startHour, startMin] = parseHourAndMinute(startTime);
  const [endHour, endMin] = parseHourAndMinute(endTime);
  return [startHour * 60 + startMin, endHour * 60 + endMin];
}

function parseHourAndMinute(time: string): [number, number] {
  const [hourStr, minStr = "00"] = time.split(":");
  const hour = Number.parseInt(hourStr);
  const minute = Number.parseInt(minStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid time format: ${time}. Expected format: HH:MM`);
  }
  return [hour, minute];
}

function validateTimeRange(
  startTimeInMinutes: number,
  endTimeInMinutes: number,
  timeRange: string,
): void {
  if (startTimeInMinutes >= endTimeInMinutes) {
    throw new Error(
      `Invalid time range: ${timeRange}. End time must be later than start time.`,
    );
  }
}

function generateTimestamps(
  dateStr: string,
  startTimeInMinutes: number,
  endTimeInMinutes: number,
): string[] {
  const timestamps: string[] = [];
  for (
    let timeInMinutes = startTimeInMinutes;
    timeInMinutes < endTimeInMinutes;
    timeInMinutes += 30
  ) {
    const hour = Math.floor(timeInMinutes / 60);
    const minute = timeInMinutes % 60;
    timestamps.push(
      `${dateStr}T${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`,
    );
  }
  return timestamps;
}

export async function deletePastAvailabilities(): Promise<number> {
  try {
    const availabilities = await fetchAllAvailabilities();
    const pastAvailabilities = filterPastAvailabilities(availabilities);
    await deleteAvailabilities(pastAvailabilities);
    return pastAvailabilities.length;
  } catch (error) {
    console.error("過去の登録データ削除中にエラーが発生しました:", error);
    throw error;
  }
}

async function fetchAllAvailabilities(): Promise<AvailabilityRecord[]> {
  const result = await dynamodb.scan({
    TableName: TABLE_NAME,
  });
  return result.Items as AvailabilityRecord[];
}

function filterPastAvailabilities(
  availabilities: AvailabilityRecord[],
): AvailabilityRecord[] {
  const now = new Date();
  const currentTimestamp = now.toISOString().slice(0, 16);
  return availabilities.filter(
    (availability) => availability.timestamp < currentTimestamp,
  );
}

async function deleteAvailabilities(
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

export async function createMatches(targetTimestamp: string): Promise<Match[]> {
  try {
    const availabilities = await fetchAvailabilities(targetTimestamp);
    const timestampGroups = groupAvailabilitiesByTimestamp(
      availabilities,
      targetTimestamp,
    );
    return flattenMatches(timestampGroups);
  } catch (error) {
    console.error("マッチング作成中にエラーが発生しました:", error);
    throw error;
  }
}

async function fetchAvailabilities(
  targetTimestamp: string,
): Promise<Availability[]> {
  const result = await dynamodb.scan({
    TableName: TABLE_NAME,
  });
  return result.Items as Availability[];
}

function groupAvailabilitiesByTimestamp(
  availabilities: Availability[],
  targetTimestamp: string,
): Map<string, Match[]> {
  const timestampGroups = new Map<string, Match[]>();
  const MAX_USERS_PER_MATCH = process.env.MAX_USERS_PER_MATCH
    ? Number.parseInt(process.env.MAX_USERS_PER_MATCH)
    : 5;

  for (const availability of availabilities) {
    if (availability.timestamp === targetTimestamp) {
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

  return timestampGroups;
}

function flattenMatches(timestampGroups: Map<string, Match[]>): Match[] {
  const allMatches: Match[] = [];
  for (const matches of timestampGroups.values()) {
    allMatches.push(...matches);
  }
  return allMatches;
}

export interface Match {
  timestamp: string;
  users: string[];
  channelIds: string[];
}
