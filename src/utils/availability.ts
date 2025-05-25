import {
  Availability,
  AvailabilityRecord,
  fetchAllAvailabilities,
  fetchAvailabilities,
  deleteAvailabilities,
} from "../repositories/availability";

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

function filterPastAvailabilities(
  availabilities: AvailabilityRecord[],
): AvailabilityRecord[] {
  const now = new Date();
  const currentTimestamp = now.toISOString().slice(0, 16);
  return availabilities.filter(
    (availability) => availability.timestamp < currentTimestamp,
  );
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

export function isWithinTwoWeeks(dateStr: string): boolean {
  const inputDate = new Date(dateStr);
  const today = new Date();
  const twoWeeksLater = new Date();
  twoWeeksLater.setDate(today.getDate() + 14);

  return inputDate >= today && inputDate <= twoWeeksLater;
}
